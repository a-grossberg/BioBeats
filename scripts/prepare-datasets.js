/**
 * Prepare datasets for GitHub Pages
 * 
 * This script downloads datasets, processes them into JSON format,
 * and prepares them for hosting on GitHub Pages.
 * 
 * Run with: node scripts/prepare-datasets.js [dataset-id]
 * Or run without args to process all datasets
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { createWriteStream, existsSync, mkdirSync } = require('fs');
const AdmZip = require('adm-zip');

const NEUROFINDER_BASE = 'https://s3.amazonaws.com/neuro.datasets/challenges/neurofinder';
const DATASETS_DIR = path.join(__dirname, '..', 'public', 'datasets');

// Ensure datasets directory exists
if (!existsSync(DATASETS_DIR)) {
  mkdirSync(DATASETS_DIR, { recursive: true });
}

/**
 * Download file from URL
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        file.close();
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

/**
 * Process dataset: extract and convert to JSON
 */
async function processDataset(datasetId) {
  console.log(`\nProcessing dataset: ${datasetId}`);
  
  const zipPath = path.join(DATASETS_DIR, `${datasetId}.zip`);
  const extractPath = path.join(DATASETS_DIR, datasetId);
  const outputPath = path.join(DATASETS_DIR, `${datasetId}.json`);
  
  // Skip if already processed
  if (existsSync(outputPath)) {
    console.log(`  ✓ Already processed: ${datasetId}.json`);
    return;
  }
  
  // Download if needed
  if (!existsSync(zipPath)) {
    console.log(`  Downloading ${datasetId}.zip...`);
    const url = `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`;
    try {
      await downloadFile(url, zipPath);
      console.log(`  ✓ Downloaded`);
    } catch (error) {
      console.error(`  ✗ Download failed: ${error.message}`);
      return;
    }
  }
  
  // Extract
  if (!existsSync(extractPath)) {
    console.log(`  Extracting...`);
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);
      console.log(`  ✓ Extracted`);
    } catch (error) {
      console.error(`  ✗ Extraction failed: ${error.message}`);
      return;
    }
  }
  
  // Find images directory
  const possiblePaths = [
    path.join(extractPath, 'images'),
    path.join(extractPath, 'neurofinder', datasetId, 'images'),
    path.join(extractPath, `neurofinder.${datasetId}`, 'images')
  ];
  
  let imagesPath = null;
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      imagesPath = p;
      break;
    }
  }
  
  if (!imagesPath) {
    console.error(`  ✗ Images directory not found`);
    return;
  }
  
  // Get image files
  const files = fs.readdirSync(imagesPath)
    .filter(f => f.endsWith('.tif') || f.endsWith('.tiff'))
    .sort();
  
  console.log(`  Found ${files.length} frames`);
  
  // For GitHub Pages, we'll create a manifest file that points to processed frames
  // The actual processing will happen client-side or we can pre-process a sample
  const manifest = {
    datasetId,
    frameCount: files.length,
    frames: files.map((f, i) => ({
      index: i,
      filename: f,
      path: `datasets/${datasetId}/images/${f}`
    }))
  };
  
  // Find regions file
  const regionsPaths = [
    path.join(extractPath, 'regions', 'regions.json'),
    path.join(extractPath, 'neurofinder', datasetId, 'regions', 'regions.json'),
    path.join(extractPath, `neurofinder.${datasetId}`, 'regions', 'regions.json')
  ];
  
  for (const rp of regionsPaths) {
    if (existsSync(rp)) {
      const regions = JSON.parse(fs.readFileSync(rp, 'utf8'));
      manifest.regions = regions;
      break;
    }
  }
  
  // Save manifest
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`  ✓ Created manifest: ${datasetId}.json`);
  
  // Copy images to public directory for GitHub Pages
  const publicImagesPath = path.join(__dirname, '..', 'public', 'datasets', datasetId, 'images');
  if (!existsSync(publicImagesPath)) {
    mkdirSync(publicImagesPath, { recursive: true });
    
    console.log(`  Copying images to public directory...`);
    // Copy first 100 frames as a sample (to keep repo size manageable)
    const sampleSize = Math.min(100, files.length);
    for (let i = 0; i < sampleSize; i++) {
      const src = path.join(imagesPath, files[i]);
      const dest = path.join(publicImagesPath, files[i]);
      fs.copyFileSync(src, dest);
    }
    console.log(`  ✓ Copied ${sampleSize} sample frames`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const datasets = args.length > 0 
    ? args 
    : ['00.00', '00.01', '00.02', '01.00', '02.00']; // Process a few key datasets
  
  console.log(`Preparing ${datasets.length} dataset(s) for GitHub Pages...`);
  
  for (const datasetId of datasets) {
    await processDataset(datasetId);
  }
  
  console.log('\n✓ Done!');
}

main().catch(console.error);

