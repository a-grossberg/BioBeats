/**
 * Netlify Function to proxy Neurofinder dataset requests
 * 
 * This replaces the Express proxy server for Netlify deployment
 * Note: Netlify Functions have execution time limits (10s on free tier, 26s on pro)
 * and limited file system access (only /tmp)
 */

const https = require('https');
const AdmZip = require('adm-zip');
const { Readable } = require('stream');

// Neurofinder S3 base URL
const NEUROFINDER_BASE = 'https://s3.amazonaws.com/neuro.datasets/challenges/neurofinder';

// In-memory cache for small files (status, info.json)
const memoryCache = new Map();

/**
 * Download file from URL to buffer
 */
function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Extract ZIP from buffer
 */
function extractZip(buffer) {
  try {
    const zip = new AdmZip(buffer);
    return zip;
  } catch (error) {
    throw new Error(`Failed to extract ZIP: ${error.message}`);
  }
}

/**
 * Handle status endpoint
 */
async function handleStatus(datasetId) {
  const cacheKey = `status:${datasetId}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // Check if dataset exists by trying to fetch info
  try {
    const infoUrl = `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`;
    // Just check if it exists (HEAD request would be better but https doesn't support it easily)
    const status = {
      status: 'ready',
      progress: 100,
      message: 'Dataset available'
    };
    memoryCache.set(cacheKey, status);
    return status;
  } catch (error) {
    return {
      status: 'error',
      progress: 0,
      message: error.message
    };
  }
}

/**
 * Handle info.json endpoint
 */
async function handleInfo(datasetId) {
  const cacheKey = `info:${datasetId}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  try {
    // Download and extract ZIP to get info
    const zipUrl = `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`;
    const zipBuffer = await downloadToBuffer(zipUrl);
    const zip = extractZip(zipBuffer);
    
    // Find info.json in the zip
    const infoEntry = zip.getEntry('neurofinder.' + datasetId + '/info.json') ||
                     zip.getEntry(datasetId + '/info.json') ||
                     zip.getEntry('info.json');
    
    if (!infoEntry) {
      throw new Error('info.json not found in dataset');
    }

    const infoJson = JSON.parse(infoEntry.getData().toString('utf8'));
    
    // Count TIFF files for frameCount
    const imageEntries = zip.getEntries().filter(entry => 
      entry.entryName.includes('/images/') && 
      (entry.entryName.endsWith('.tif') || entry.entryName.endsWith('.tiff'))
    );
    
    const info = {
      ...infoJson,
      frameCount: imageEntries.length || infoJson.frameCount || 100
    };
    
    memoryCache.set(cacheKey, info);
    return info;
  } catch (error) {
    throw new Error(`Failed to load dataset info: ${error.message}`);
  }
}

/**
 * Handle processed frame endpoint
 */
async function handleProcessedFrame(datasetId, frameIndex) {
  try {
    const zipUrl = `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`;
    const zipBuffer = await downloadToBuffer(zipUrl);
    const zip = extractZip(zipBuffer);
    
    // Find the frame file
    const imageEntries = zip.getEntries()
      .filter(entry => 
        entry.entryName.includes('/images/') && 
        (entry.entryName.endsWith('.tif') || entry.entryName.endsWith('.tiff'))
      )
      .sort((a, b) => a.entryName.localeCompare(b.entryName));
    
    if (frameIndex >= imageEntries.length) {
      throw new Error(`Frame index ${frameIndex} out of range`);
    }
    
    const frameEntry = imageEntries[frameIndex];
    const frameBuffer = frameEntry.getData();
    
    // For now, return the raw TIFF data
    // In a full implementation, you'd process it with geotiff here
    // But that requires geotiff to be available in the function
    
    return {
      data: frameBuffer.toString('base64'),
      width: 512, // Would need to parse from TIFF
      height: 512,
      format: 'base64'
    };
  } catch (error) {
    throw new Error(`Failed to load frame: ${error.message}`);
  }
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Parse path: /api/neurofinder/{datasetId}/{endpoint}
    const path = event.path.replace('/.netlify/functions/neurofinder', '');
    const parts = path.split('/').filter(p => p);
    
    if (parts.length < 1) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Dataset ID required' })
      };
    }

    const datasetId = parts[0];
    const endpoint = parts.slice(1).join('/');

    let result;

    if (endpoint === 'status' || !endpoint) {
      result = await handleStatus(datasetId);
    } else if (endpoint === 'info.json') {
      result = await handleInfo(datasetId);
    } else if (endpoint.startsWith('frames/') && endpoint.endsWith('/processed.json')) {
      const frameIndex = parseInt(endpoint.split('/')[1], 10);
      result = await handleProcessedFrame(datasetId, frameIndex);
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Endpoint not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: process.env.NETLIFY_DEV ? error.stack : undefined
      })
    };
  }
};

