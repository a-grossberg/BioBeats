/**
 * Netlify Function to proxy Neurofinder dataset requests
 * 
 * This replaces the Express proxy server for Netlify deployment
 * Note: Returns direct S3 URLs where possible to avoid timeout issues
 */

const https = require('https');

// Neurofinder S3 base URL
const NEUROFINDER_BASE = 'https://s3.amazonaws.com/neuro.datasets/challenges/neurofinder';

/**
 * Download file from URL to buffer (with timeout)
 */
function downloadToBuffer(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    https.get(url, (response) => {
      clearTimeout(timeoutId);
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Handle status endpoint - just return ready status
 */
async function handleStatus(datasetId) {
  return {
    status: 'ready',
    progress: 100,
    message: 'Dataset available via S3'
  };
}

/**
 * Handle info.json endpoint - download and extract just the info file
 */
async function handleInfo(datasetId) {
  try {
    // Try to get info.json directly from S3 (if available)
    // Otherwise, we'd need to download the ZIP which is too slow
    // For now, return a basic info structure
    const AdmZip = require('adm-zip');
    
    const zipUrl = `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`;
    
    // Download just enough to read the info.json (streaming would be better but AdmZip needs full buffer)
    // This will timeout for large files, so we'll use a fallback
    try {
      const zipBuffer = await downloadToBuffer(zipUrl, 5000); // 5 second timeout
      const zip = new AdmZip(zipBuffer);
      
      const infoEntry = zip.getEntry(`neurofinder.${datasetId}/info.json`) ||
                       zip.getEntry(`${datasetId}/info.json`) ||
                       zip.getEntry('info.json');
      
      if (infoEntry) {
        const infoJson = JSON.parse(infoEntry.getData().toString('utf8'));
        
        // Count TIFF files
        const imageEntries = zip.getEntries().filter(entry => 
          entry.entryName.includes('/images/') && 
          (entry.entryName.endsWith('.tif') || entry.entryName.endsWith('.tiff'))
        );
        
        return {
          ...infoJson,
          frameCount: imageEntries.length || infoJson.frameCount || 100
        };
      }
    } catch (timeoutError) {
      // If download times out, return default info
      console.warn(`Timeout downloading ${datasetId}, using defaults`);
    }
    
    // Fallback: return default info structure
    return {
      frameCount: 100,
      datasetId: datasetId,
      note: 'Using default frame count. Full dataset info unavailable due to size limits.'
    };
  } catch (error) {
    throw new Error(`Failed to load dataset info: ${error.message}`);
  }
}

/**
 * Handle processed frame endpoint - return direct S3 URL
 * The browser will handle the download
 */
async function handleProcessedFrame(datasetId, frameIndex) {
  // Return a structure that tells the client to fetch directly from S3
  // This avoids downloading the entire ZIP in the function
  return {
    directUrl: `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`,
    frameIndex: frameIndex,
    note: 'Use direct S3 URL - function cannot process large files',
    useDirectFetch: true
  };
}

/**
 * Handle images endpoint - return direct S3 URL
 */
async function handleImage(datasetId, filename) {
  // Return direct S3 URL - browser will handle CORS if allowed
  return {
    directUrl: `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`,
    filename: filename,
    note: 'Dataset is in ZIP format. Use direct S3 access or local proxy for full functionality.'
  };
}

/**
 * Handle regions endpoint
 */
async function handleRegions(datasetId) {
  try {
    const AdmZip = require('adm-zip');
    const zipUrl = `${NEUROFINDER_BASE}/neurofinder.${datasetId}.zip`;
    
    try {
      const zipBuffer = await downloadToBuffer(zipUrl, 5000);
      const zip = new AdmZip(zipBuffer);
      
      const regionsEntry = zip.getEntry(`neurofinder.${datasetId}/regions/regions.json`) ||
                          zip.getEntry(`${datasetId}/regions/regions.json`) ||
                          zip.getEntry('regions.json');
      
      if (regionsEntry) {
        return JSON.parse(regionsEntry.getData().toString('utf8'));
      }
    } catch (timeoutError) {
      console.warn(`Timeout downloading regions for ${datasetId}`);
    }
    
    return { regions: [], note: 'Regions unavailable - dataset too large for function processing' };
  } catch (error) {
    throw new Error(`Failed to load regions: ${error.message}`);
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
    // Netlify redirects /api/neurofinder/* to /.netlify/functions/neurofinder/:splat
    // The :splat parameter can be in event.path or event.queryStringParameters.splat
    let path = event.path || '';
    
    // Check for splat in query parameters (from redirect)
    if (event.queryStringParameters && event.queryStringParameters.splat) {
      path = '/' + event.queryStringParameters.splat;
    }
    
    // Remove function path prefix if present
    if (path.startsWith('/.netlify/functions/neurofinder')) {
      path = path.replace('/.netlify/functions/neurofinder', '');
    } else if (path.startsWith('/api/neurofinder')) {
      path = path.replace('/api/neurofinder', '');
    }
    
    // Remove leading slash
    path = path.replace(/^\/+/, '');
    
    const parts = path.split('/').filter(p => p);
    
    if (parts.length < 1) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Dataset ID required', receivedPath: event.path, parsedPath: path })
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
    } else if (endpoint.startsWith('images/')) {
      const filename = endpoint.replace('images/', '');
      result = await handleImage(datasetId, filename);
    } else if (endpoint === 'regions.json') {
      result = await handleRegions(datasetId);
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Endpoint not found', 
          endpoint: endpoint,
          originalPath: event.path,
          parsedPath: path,
          parts: parts
        })
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
