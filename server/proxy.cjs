/**
 * Simple Proxy Server for Neurofinder Datasets
 * 
 * This server fetches data from Neurofinder S3 bucket and serves it
 * to the frontend, bypassing CORS restrictions.
 * 
 * Run with: node server/proxy.js
 * Then access the app at http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const { createWriteStream, existsSync, readdirSync, mkdirSync, statSync, readFileSync } = require('fs');
const { join, dirname, resolve } = require('path');
const AdmZip = require('adm-zip');

// Try to load geotiff for server-side processing (optional, won't break if not available)
let geotiff = null;
try {
  geotiff = require('geotiff');
} catch (e) {
  console.log('Note: geotiff not available for server-side processing, will serve raw files');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());
app.use(express.json());

// Cache directory for downloaded datasets
const CACHE_DIR = join(__dirname, '../data/cache');

// Track download/extraction status for each dataset
const datasetStatus = new Map();

// Neurofinder S3 base URL - correct bucket and path from GitHub README
const NEUROFINDER_BASE = 'https://s3.amazonaws.com/neuro.datasets/challenges/neurofinder';

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
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Download and extract ZIP file
 */
async function downloadAndExtractZip(datasetId, onProgress) {
  const zipPath = join(CACHE_DIR, `${datasetId}.zip`);
  const extractPath = join(CACHE_DIR, datasetId);
  
  // Check if already extracted - try multiple possible structures
  if (existsSync(extractPath)) {
    const possiblePaths = [
      join(extractPath, 'images'),
      join(extractPath, 'neurofinder', datasetId, 'images'),
      join(extractPath, `neurofinder.${datasetId}`, 'images')
    ];
    
    for (const imagesPath of possiblePaths) {
      if (existsSync(imagesPath)) {
        const files = readdirSync(imagesPath).filter(f => f.endsWith('.tif') || f.endsWith('.tiff'));
        if (files.length > 0) {
          // Return the appropriate base path
          if (imagesPath.includes(`neurofinder.${datasetId}`)) {
            return join(extractPath, `neurofinder.${datasetId}`);
          } else if (imagesPath.includes('neurofinder')) {
            return join(extractPath, 'neurofinder', datasetId);
          }
          return extractPath;
        }
      }
    }
  }
  
  // Create directories
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  // Download ZIP if not exists
  if (!existsSync(zipPath)) {
    console.log(`Downloading ${datasetId}.zip...`);
    onProgress?.(5, 'Starting download...');
    
    // Use the correct URL pattern from the GitHub README
    const primaryUrl = `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`;
    
    // Try the primary URL first, then fallback patterns if needed
    const urlPatterns = [
      primaryUrl, // Primary: correct URL from README
      `${NEUROFINDER_BASE}/${datasetId}.zip`, // Alternative pattern
    ];
    
    let downloaded = false;
    let lastError = null;
    
    for (const urlToTry of urlPatterns) {
      try {
        console.log(`Trying: ${urlToTry}`);
        onProgress?.(10, `Connecting to ${urlToTry}...`);
        await new Promise((resolve, reject) => {
          const file = createWriteStream(zipPath);
          https.get(urlToTry, (response) => {
            if (response.statusCode === 200) {
              const totalSize = parseInt(response.headers['content-length'] || '0', 10);
              let downloadedSize = 0;
              
              onProgress?.(15, 'Downloading dataset (this may take a few minutes)...');
              
              response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (totalSize > 0) {
                  const percent = 15 + Math.floor((downloadedSize / totalSize) * 70);
                  onProgress?.(percent, `Downloading: ${(downloadedSize / 1024 / 1024).toFixed(1)} MB / ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
                }
              });
              
              response.pipe(file);
              file.on('finish', () => {
                file.close();
                // Wait a moment to ensure file is fully written to disk
                setTimeout(() => {
                  console.log(`Successfully downloaded from: ${urlToTry}`);
                  downloaded = true;
                  onProgress?.(85, 'Download complete, extracting...');
                  resolve();
                }, 100);
              });
              file.on('error', (err) => {
                file.close();
                reject(err);
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
        break; // Success, exit loop
      } catch (error) {
        lastError = error;
        console.log(`Failed: ${urlToTry} - ${error.message}`);
        // Delete partial file if it exists
        if (existsSync(zipPath)) {
          const fs = require('fs');
          fs.unlinkSync(zipPath);
        }
        continue; // Try next URL
      }
    }
    
    if (!downloaded) {
      // Check if dataset is already extracted locally
      if (existsSync(extractPath)) {
        const imagesPath = join(extractPath, 'images');
        if (existsSync(imagesPath)) {
          const files = readdirSync(imagesPath).filter(f => f.endsWith('.tif') || f.endsWith('.tiff'));
          if (files.length > 0) {
            console.log(`Using existing extracted dataset at: ${extractPath}`);
            return extractPath;
          }
        }
      }
      
      throw new Error(
        `Could not download dataset ${datasetId}.zip from any URL.\n` +
        `Tried: ${urlPatterns.slice(0, 3).join(', ')}...\n` +
        `Last error: ${lastError?.message || 'Unknown'}\n\n` +
        `MANUAL DOWNLOAD INSTRUCTIONS:\n` +
        `1. Visit: https://github.com/codeneuro/neurofinder\n` +
        `2. Download the dataset ZIP file (neurofinder.${datasetId}.zip)\n` +
        `3. Place it in: ${zipPath}\n` +
        `4. Or extract it to: ${extractPath}\n` +
        `5. Then try loading the dataset again`
      );
    }
  }
  
  // Extract ZIP
  console.log(`Extracting ${datasetId}.zip...`);
  onProgress?.(85, 'Extracting ZIP file...');
  
  // Verify ZIP file is complete before extracting
  const fs = require('fs');
  const stats = fs.statSync(zipPath);
  if (stats.size === 0) {
    throw new Error('Downloaded file is empty');
  }
  
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    onProgress?.(95, 'Extraction complete, verifying...');
  } catch (zipError) {
    // If extraction fails, the ZIP might be corrupted or incomplete
    // Delete it and throw error
    if (existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    throw new Error(`Failed to extract ZIP file. It may be corrupted or incomplete. Error: ${zipError.message}`);
  }
  
  // Verify extraction - check multiple possible structures
  const possiblePaths = [
    { path: join(extractPath, 'images'), returnPath: extractPath },
    { path: join(extractPath, 'neurofinder', datasetId, 'images'), returnPath: join(extractPath, 'neurofinder', datasetId) },
    { path: join(extractPath, `neurofinder.${datasetId}`, 'images'), returnPath: join(extractPath, `neurofinder.${datasetId}`) }
  ];
  
  for (const { path: imagesPath, returnPath } of possiblePaths) {
    if (existsSync(imagesPath)) {
      const files = readdirSync(imagesPath).filter(f => f.endsWith('.tif') || f.endsWith('.tiff'));
      if (files.length > 0) {
        onProgress?.(100, `Ready! Found ${files.length} image frames`);
        return returnPath;
      }
    }
  }
  
  onProgress?.(100, 'Extraction complete');
  return extractPath;
}

/**
 * Status endpoint - check if dataset is ready
 */
app.get('/api/neurofinder/:datasetId/status', (req, res) => {
  const { datasetId } = req.params;
  const status = datasetStatus.get(datasetId) || { status: 'idle', progress: 0, message: '' };
  res.json(status);
});

/**
 * Proxy endpoint for dataset info
 */
app.get('/api/neurofinder/:datasetId/info.json', async (req, res) => {
  const { datasetId } = req.params;
  
  try {
    // Update status
    datasetStatus.set(datasetId, { status: 'checking', progress: 0, message: 'Checking dataset...' });
    
    const extractPath = await downloadAndExtractZip(datasetId, (progress, message) => {
      datasetStatus.set(datasetId, { status: 'processing', progress, message });
    });
    
    // Find images directory (could be in different locations)
    const possibleImagePaths = [
      join(extractPath, 'images'),
      join(extractPath, 'neurofinder', datasetId, 'images'),
      join(extractPath, `neurofinder.${datasetId}`, 'images')
    ];
    
    let frameCount = 0;
    let actualImagesPath = null;
    for (const imagesPath of possibleImagePaths) {
      if (existsSync(imagesPath)) {
        const files = readdirSync(imagesPath).filter(f => f.endsWith('.tif') || f.endsWith('.tiff'));
        if (files.length > 0) {
          frameCount = files.length;
          actualImagesPath = imagesPath;
          break;
        }
      }
    }
    
    // Mark as ready
    datasetStatus.set(datasetId, { status: 'ready', progress: 100, message: 'Dataset ready' });
    
    res.json({
      datasetId,
      frameCount,
      available: true,
      extracted: existsSync(extractPath)
    });
  } catch (error) {
    console.error('Error getting dataset info:', error);
    datasetStatus.set(datasetId, { status: 'error', progress: 0, message: error.message });
    res.status(500).json({ 
      error: error.message,
      datasetId,
      frameCount: 0,
      available: false
    });
  }
});

/**
 * Proxy endpoint for individual frames
 */
app.get('/api/neurofinder/:datasetId/images/:filename', async (req, res) => {
  const { datasetId, filename } = req.params;
  
  try {
    // Ensure dataset is extracted
    const extractPath = await downloadAndExtractZip(datasetId);
    
    // Try multiple possible image directory locations
    // Note: downloadAndExtractZip returns the base path, which may already include neurofinder.{datasetId}
    const possibleImageDirs = [
      join(extractPath, 'images'),
      join(extractPath, 'neurofinder', datasetId, 'images'),
      join(extractPath, `neurofinder.${datasetId}`, 'images'),
      // Also try if extractPath is already the dataset root
      join(CACHE_DIR, datasetId, 'images'),
      join(CACHE_DIR, datasetId, 'neurofinder', datasetId, 'images'),
      join(CACHE_DIR, datasetId, `neurofinder.${datasetId}`, 'images')
    ];
    
    // Debug: log what directories exist
    console.log(`Looking for ${filename} in dataset ${datasetId}`);
    console.log(`Extract path: ${extractPath}`);
    for (const imagesDir of possibleImageDirs) {
      if (existsSync(imagesDir)) {
        const files = readdirSync(imagesDir).filter(f => f.endsWith('.tif') || f.endsWith('.tiff'));
        console.log(`Found images dir: ${imagesDir} with ${files.length} files`);
        if (files.length > 0) {
          console.log(`Sample files: ${files.slice(0, 5).join(', ')}`);
        }
      }
    }
    
    // First, try exact filename match
    for (const imagesDir of possibleImageDirs) {
      if (existsSync(imagesDir)) {
        const exactPath = resolve(join(imagesDir, filename));
        if (existsSync(exactPath)) {
          console.log(`Serving frame: ${exactPath}`);
          return res.sendFile(exactPath);
        }
      }
    }
    
    // If exact match fails, try to find by frame number
    // Handle patterns like: 000.tif, 000000.tif, image00000.tiff
    const frameNumStr = filename.replace(/\.tif(f)?$/i, '').replace(/^image/i, '').replace(/^frame_/i, '').replace(/^0+/, '');
    const frameNum = frameNumStr ? parseInt(frameNumStr, 10) : null;
    
    console.log(`Trying to match frame number ${frameNum} from filename ${filename}`);
    
    for (const imagesDir of possibleImageDirs) {
      if (existsSync(imagesDir)) {
        const files = readdirSync(imagesDir).filter(f => f.endsWith('.tif') || f.endsWith('.tiff'));
        
        // Try to match by frame number
        let matchingFile = null;
        if (frameNum !== null && !isNaN(frameNum)) {
          // Try exact match first
          matchingFile = files.find(f => f === filename);
          
          // Then try by number (handle image00000.tiff pattern)
          if (!matchingFile) {
            matchingFile = files.find(f => {
              const fNumStr = f.replace(/\.tif(f)?$/i, '').replace(/^image/i, '').replace(/^frame_/i, '').replace(/^0+/, '');
              const fNum = fNumStr ? parseInt(fNumStr, 10) : null;
              return fNum === frameNum;
            });
          }
        } else {
          // Fallback: try partial match
          matchingFile = files.find(f => f.includes(filename) || filename.includes(f));
        }
        
        if (matchingFile) {
          const filePath = resolve(join(imagesDir, matchingFile));
          console.log(`Serving matched frame: ${filePath} (matched ${filename} -> ${matchingFile})`);
          return res.sendFile(filePath);
        }
      }
    }
    
    // If still not found, return 404 with helpful error
    console.error(`Frame not found: ${filename} in dataset ${datasetId}`);
    res.status(404).json({ 
      error: `Frame not found: ${filename}`,
      datasetId,
      extractPath,
      checkedDirs: possibleImageDirs.filter(d => existsSync(d))
    });
  } catch (error) {
    console.error('Error fetching frame:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Proxy endpoint for processed TIFF frame data (server-side processing)
 * This avoids browser geotiff module issues by processing on the server
 */
app.get('/api/neurofinder/:datasetId/frames/:frameIndex/processed.json', async (req, res) => {
  const { datasetId, frameIndex } = req.params;
  
  try {
    if (!geotiff) {
      return res.status(503).json({ error: 'Server-side TIFF processing not available. Install geotiff: npm install geotiff' });
    }
    
    // Ensure dataset is extracted
    const extractPath = await downloadAndExtractZip(datasetId);
    
    // Find the images directory
    const possibleImageDirs = [
      join(extractPath, 'images'),
      join(extractPath, 'neurofinder', datasetId, 'images'),
      join(extractPath, `neurofinder.${datasetId}`, 'images'),
      join(CACHE_DIR, datasetId, 'images'),
      join(CACHE_DIR, datasetId, 'neurofinder', datasetId, 'images'),
      join(CACHE_DIR, datasetId, `neurofinder.${datasetId}`, 'images')
    ];
    
    let imagesDir = null;
    for (const dir of possibleImageDirs) {
      if (existsSync(dir)) {
        const files = readdirSync(dir).filter(f => f.endsWith('.tif') || f.endsWith('.tiff'));
        if (files.length > 0) {
          imagesDir = dir;
          break;
        }
      }
    }
    
    if (!imagesDir) {
      return res.status(404).json({ error: 'Images directory not found' });
    }
    
    const files = readdirSync(imagesDir).filter(f => f.endsWith('.tif') || f.endsWith('.tiff')).sort();
    const frameNum = parseInt(frameIndex, 10);
    
    if (frameNum < 0 || frameNum >= files.length) {
      return res.status(404).json({ error: `Frame index ${frameIndex} out of range (0-${files.length - 1})` });
    }
    
    const filePath = join(imagesDir, files[frameNum]);
    const buffer = readFileSync(filePath);
    
    // Process TIFF on server
    const tiff = await geotiff.fromArrayBuffer(buffer.buffer);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();
    const width = image.getWidth();
    const height = image.getHeight();
    const data = Array.from(rasters[0]); // Convert to regular array for JSON
    
    res.json({
      width,
      height,
      data,
      frameIndex: frameNum
    });
  } catch (error) {
    console.error('Error processing frame:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Proxy endpoint for regions JSON
 */
app.get('/api/neurofinder/:datasetId/regions.json', async (req, res) => {
  const { datasetId } = req.params;
  
  try {
    // Ensure dataset is extracted
    const extractPath = await downloadAndExtractZip(datasetId);
    
    // Try different possible locations for regions file
    const possiblePaths = [
      join(extractPath, 'regions', 'regions.json'),
      join(extractPath, 'regions.json'),
      join(extractPath, 'neurofinder', datasetId, 'regions', 'regions.json'),
      join(extractPath, `neurofinder.${datasetId}`, 'regions', 'regions.json')
    ];
    
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return res.sendFile(path);
      }
    }
    
    // Regions file is optional, return empty array if not found
    res.json([]);
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Neurofinder proxy server running on http://localhost:${PORT}`);
  console.log(`Make sure to update Vite config to proxy API requests to this server`);
});

