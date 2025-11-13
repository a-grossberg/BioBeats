/**
 * Prepare datasets for GitHub Pages
 * 
 * This script downloads datasets, processes them into JSON format,
 * and prepares them for hosting on GitHub Pages.
 * 
 * Usage:
 *   node scripts/prepare-datasets.js                    # Process all 19 datasets, sample 100 frames each
 *   node scripts/prepare-datasets.js 00.00 00.01       # Process specific datasets
 *   node scripts/prepare-datasets.js --frames=500      # Process all datasets, sample 500 frames each
 *   node scripts/prepare-datasets.js --all-frames       # Process all datasets, copy ALL frames (WARNING: very large!)
 * 
 * Note: GitHub has a 100MB file size limit. Storing all frames from all 19 datasets
 * could result in a 1-4GB repository. Use --frames=N to limit frame count.
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
async function processDataset(datasetId, maxFrames = 100) {
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
    // Copy frames (sample or all based on maxFrames parameter)
    const framesToCopy = maxFrames === Infinity ? files.length : Math.min(maxFrames, files.length);
    
    for (let i = 0; i < framesToCopy; i++) {
      const src = path.join(imagesPath, files[i]);
      const dest = path.join(publicImagesPath, files[i]);
      fs.copyFileSync(src, dest);
    }
    console.log(`  ✓ Copied ${framesToCopy} ${maxFrames === Infinity ? 'frames (all)' : 'sample frames'}`);
  }
}

// All 19 available datasets
const ALL_DATASETS = [
  '00.00', '00.01', '00.02', '00.03', '00.04', '00.05', '00.06', '00.07', '00.08', '00.09', '00.10', '00.11',
  '01.00', '01.01',
  '02.00', '02.01',
  '03.00',
  '04.00', '04.01'
];

// Main
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let datasets = ALL_DATASETS; // Default: process all 19 datasets
  let maxFrames = 100; // Default: sample 100 frames per dataset
  
  // Check for --all-frames flag
  const allFramesIndex = args.indexOf('--all-frames');
  if (allFramesIndex !== -1) {
    maxFrames = Infinity; // Copy all frames
    args.splice(allFramesIndex, 1);
  }
  
  // Check for --frames=N flag
  const framesMatch = args.find(arg => arg.startsWith('--frames='));
  if (framesMatch) {
    maxFrames = parseInt(framesMatch.split('=')[1], 10) || 100;
    args = args.filter(arg => !arg.startsWith('--frames='));
  }
  
  // If specific datasets provided, use those; otherwise use all
  if (args.length > 0) {
    datasets = args;
  }
  
  console.log(`Preparing ${datasets.length} dataset(s) for GitHub Pages...`);
  if (maxFrames === Infinity) {
    console.log('⚠️  WARNING: Copying ALL frames - this will create a very large repository!');
    console.log('   Estimated size: 1-4 GB. GitHub recommends keeping repos under 1 GB.');
  } else {
    console.log(`   Sampling ${maxFrames} frames per dataset to keep repo size manageable.`);
  }
  console.log('');
  
  for (const datasetId of datasets) {
    await processDataset(datasetId, maxFrames);
  }
  
  console.log('\n✓ Done!');
  if (maxFrames !== Infinity) {
    console.log(`\nNote: Only ${maxFrames} frames per dataset were copied.`);
    console.log('To copy all frames, run with --all-frames flag (warning: very large repo size).');
  }
}

main().catch(console.error);

