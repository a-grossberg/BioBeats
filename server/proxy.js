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
const { createWriteStream, existsSync, readdirSync } = require('fs');
const { join } = require('path');

const app = express();
const PORT = 3001;

// Enable CORS
app.use(cors());
app.use(express.json());

// Cache directory for downloaded datasets
const CACHE_DIR = join(__dirname, '../data/cache');

// Neurofinder S3 base URL
const NEUROFINDER_BASE = 'https://s3.amazonaws.com/neurofinder.datasets';

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
 * Proxy endpoint for dataset info
 */
app.get('/api/neurofinder/:datasetId/info.json', async (req, res) => {
  const { datasetId } = req.params;
  
  // Return basic info (in a real implementation, this would fetch from S3)
  res.json({
    datasetId,
    frameCount: 2000, // Estimate - would need to check actual dataset
    available: true
  });
});

/**
 * Proxy endpoint for individual frames
 */
app.get('/api/neurofinder/:datasetId/images/:filename', async (req, res) => {
  const { datasetId, filename } = req.params;
  
  try {
    // Check cache first
    const cachePath = join(CACHE_DIR, datasetId, 'images', filename);
    if (existsSync(cachePath)) {
      return res.sendFile(cachePath);
    }

    // Fetch from S3
    const s3Url = `${NEUROFINDER_BASE}/${datasetId}/images/${filename}`;
    
    https.get(s3Url, (s3Response) => {
      if (s3Response.statusCode === 200) {
        // Cache the file
        const file = createWriteStream(cachePath);
        s3Response.pipe(file);
        file.on('finish', () => {
          file.close();
          res.sendFile(cachePath);
        });
      } else {
        res.status(404).json({ error: 'Frame not found' });
      }
    }).on('error', (err) => {
      console.error('Error fetching from S3:', err);
      res.status(500).json({ error: 'Failed to fetch frame' });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Proxy endpoint for regions JSON
 */
app.get('/api/neurofinder/:datasetId/regions.json', async (req, res) => {
  const { datasetId } = req.params;
  
  try {
    const cachePath = join(CACHE_DIR, datasetId, 'regions.json');
    if (existsSync(cachePath)) {
      return res.sendFile(cachePath);
    }

    const s3Url = `${NEUROFINDER_BASE}/${datasetId}/regions/regions.json`;
    
    https.get(s3Url, (s3Response) => {
      if (s3Response.statusCode === 200) {
        const file = createWriteStream(cachePath);
        s3Response.pipe(file);
        file.on('finish', () => {
          file.close();
          res.sendFile(cachePath);
        });
      } else {
        res.status(404).json({ error: 'Regions file not found' });
      }
    }).on('error', (err) => {
      console.error('Error fetching regions:', err);
      res.status(500).json({ error: 'Failed to fetch regions' });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Neurofinder proxy server running on http://localhost:${PORT}`);
  console.log(`Make sure to update Vite config to proxy API requests to this server`);
});

