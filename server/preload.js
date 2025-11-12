/**
 * Pre-load Script for Neurofinder Datasets
 * 
 * Run this script to pre-download and cache datasets:
 * node server/preload.js [dataset-id]
 * 
 * Or download all: node server/preload.js all
 */

const https = require('https');
const { createWriteStream, existsSync, mkdirSync, readdirSync } = require('fs');
const { join } = require('path');
const AdmZip = require('adm-zip');

const NEUROFINDER_BASE = 'https://s3.amazonaws.com/neuro.datasets/challenges/neurofinder';
const CACHE_DIR = join(__dirname, '../data/cache');

// Available datasets
const DATASETS = [
  '00.00', '00.01', '00.02', '00.03', '00.04', '00.05',
  '00.06', '00.07', '00.08', '00.09', '00.10', '00.11',
  '01.00', '01.01', '02.00', '02.01', '03.00', '04.00', '04.01'
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    const file = createWriteStream(dest);
    let downloadedSize = 0;
    let totalSize = 0;
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        totalSize = parseInt(response.headers['content-length'] || '0', 10);
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
            process.stdout.write(`\rProgress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB / ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
          }
        });
        
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('\n✓ Download complete');
          resolve();
        });
      } else {
        file.close();
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

async function downloadAndExtract(datasetId) {
  const zipPath = join(CACHE_DIR, `${datasetId}.zip`);
  const extractPath = join(CACHE_DIR, datasetId);
  
  // Check if already extracted
  if (existsSync(extractPath)) {
    const imagesPath = join(extractPath, 'images');
    if (existsSync(imagesPath)) {
      const files = readdirSync(imagesPath).filter(f => f.endsWith('.tif') || f.endsWith('.tiff'));
      if (files.length > 0) {
        console.log(`✓ Dataset ${datasetId} already cached (${files.length} frames)`);
        return;
      }
    }
  }
  
  // Create cache directory
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  // Download if not exists
  if (!existsSync(zipPath)) {
    const url = `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`;
    try {
      await downloadFile(url, zipPath);
    } catch (error) {
      console.error(`✗ Failed to download ${datasetId}:`, error.message);
      if (existsSync(zipPath)) {
        const fs = require('fs');
        fs.unlinkSync(zipPath);
      }
      throw error;
    }
  } else {
    console.log(`✓ ZIP file already exists for ${datasetId}`);
  }
  
  // Extract
  console.log(`Extracting ${datasetId}...`);
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    
    // Verify
    const imagesPath = join(extractPath, 'images');
    if (existsSync(imagesPath)) {
      const files = readdirSync(imagesPath).filter(f => f.endsWith('.tif') || f.endsWith('.tiff'));
      console.log(`✓ Extracted ${datasetId}: ${files.length} frames`);
    } else {
      console.log(`⚠ Warning: No images/ directory found for ${datasetId}`);
    }
  } catch (error) {
    console.error(`✗ Failed to extract ${datasetId}:`, error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || 'all';
  
  console.log('Neurofinder Dataset Pre-loader\n');
  
  if (target === 'all') {
    console.log(`Pre-loading all ${DATASETS.length} datasets...\n`);
    for (const datasetId of DATASETS) {
      try {
        await downloadAndExtract(datasetId);
        console.log(''); // Blank line between datasets
      } catch (error) {
        console.error(`Skipping ${datasetId} due to error\n`);
      }
    }
    console.log('✓ All datasets pre-loaded!');
  } else if (DATASETS.includes(target)) {
    await downloadAndExtract(target);
    console.log('✓ Done!');
  } else {
    console.error(`Unknown dataset: ${target}`);
    console.log(`Available datasets: ${DATASETS.join(', ')}`);
    console.log('Or use "all" to download all datasets');
    process.exit(1);
  }
}

main().catch(console.error);


