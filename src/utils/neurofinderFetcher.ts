/**
 * Neurofinder Dataset Fetcher
 * 
 * Fetches datasets from Neurofinder S3 bucket or local proxy
 */

import { TIFFFrame, loadTIFFFile } from './tiffLoader';

// S3 bucket base URL for Neurofinder datasets (ZIP files only)
const NEUROFINDER_S3_BASE = 'https://s3.amazonaws.com/neuro.datasets/challenges/neurofinder';

// Free CORS proxy (fallback if direct S3 access fails)
const CORS_PROXY = 'https://corsproxy.io/?';

// Use GitHub Pages for manifest/metadata only
const getBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '/BioBeats';
  }
  return '';
};

const DATASETS_BASE_URL = `${getBaseUrl()}/datasets`;
const PROXY_BASE_URL = '/api/neurofinder'; // For local dev proxy server

/**
 * Fetch dataset using proxy (for local development)
 * This assumes you have a backend proxy that fetches from S3
 */
export async function fetchDatasetViaProxy(
  datasetId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{ frames: TIFFFrame[]; regions?: any }> {
  onProgress?.(0, 'Checking dataset status...');

  try {
    // First, check if proxy is available with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const statusCheck = await fetch(`${PROXY_BASE_URL}/${datasetId}/status`, { 
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!statusCheck.ok && statusCheck.status !== 404) {
        throw new Error('Proxy server is not responding. Make sure it is running on port 3001.');
      }
    } catch (fetchError) {
      if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('aborted'))) {
        throw new Error('Proxy server timeout. Make sure the proxy is running: `npm run proxy`');
      }
      if (fetchError instanceof TypeError) {
        throw new Error('Cannot connect to proxy server. Make sure it is running: `npm run proxy`');
      }
      throw fetchError;
    }

    // Trigger the download/extraction by requesting info
    // This will start the process if not already started
    const infoResponse = await fetch(`${PROXY_BASE_URL}/${datasetId}/info.json`);
    if (!infoResponse.ok) {
      const errorText = await infoResponse.text();
      let errorMessage = 'Dataset not found or proxy not available';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Poll status until ready
    let ready = false;
    let attempts = 0;
    const maxAttempts = 600; // 5 minutes max (600 * 0.5s = 300s)
    
    while (!ready && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between checks
      
      const statusResponse = await fetch(`${PROXY_BASE_URL}/${datasetId}/status`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        
        // Update progress from server
        onProgress?.(status.progress, status.message);
        
        if (status.status === 'ready') {
          ready = true;
          break;
        } else if (status.status === 'error') {
          throw new Error(status.message);
        }
      }
      
      attempts++;
    }
    
    if (!ready) {
      throw new Error('Dataset preparation timed out. Please try again.');
    }

    // Now fetch the actual info
    const finalInfoResponse = await fetch(`${PROXY_BASE_URL}/${datasetId}/info.json`);
    const info = await finalInfoResponse.json();
    const frameCount = info.frameCount || 100; // Default estimate

        onProgress?.(10, 'Loading image frames...');

        // Fetch frames - try server-side processing first (avoids browser geotiff issues)
        const frames: TIFFFrame[] = [];
        const batchSize = 10; // Fetch in batches to avoid overwhelming

        // Load all available frames
        const maxFramesToLoad = frameCount;
        
        // Try server-side processing first
        let useServerSideProcessing = true;
        try {
          const testResponse = await fetch(`${PROXY_BASE_URL}/${datasetId}/frames/0/processed.json`);
          if (!testResponse.ok) {
            useServerSideProcessing = false;
            console.log('Server-side processing not available, falling back to client-side');
          }
        } catch (e) {
          useServerSideProcessing = false;
          console.log('Server-side processing not available, falling back to client-side');
        }
        
        if (useServerSideProcessing) {
          // Use server-side processing (avoids geotiff browser issues)
          for (let i = 0; i < maxFramesToLoad; i += batchSize) {
            const batch = [];
            for (let j = 0; j < batchSize && (i + j) < maxFramesToLoad; j++) {
              const frameNum = i + j;
              batch.push(
                fetch(`${PROXY_BASE_URL}/${datasetId}/frames/${frameNum}/processed.json`)
                  .then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch frame ${frameNum}: ${res.statusText}`);
                    return res.json();
                  })
                  .then(data => ({
                    data: new Uint16Array(data.data),
                    width: data.width,
                    height: data.height,
                    frameIndex: data.frameIndex
                  } as TIFFFrame))
                  .catch((err) => {
                    console.warn(`Failed to load frame ${frameNum}:`, err);
                    return null;
                  })
              );
            }

            const batchFrames = await Promise.all(batch);
            const validFrames = batchFrames.filter(f => f !== null) as TIFFFrame[];
            frames.push(...validFrames);

            const progress = 10 + ((i + batchSize) / maxFramesToLoad) * 80;
            onProgress?.(Math.min(progress, 90), `Loaded ${frames.length} of ${maxFramesToLoad} frames...`);
            
            if (i >= batchSize && frames.length === 0) {
              throw new Error(
                `No frames could be loaded after trying ${batchSize} frames. ` +
                `Check browser console and proxy server logs.`
              );
            }
          }
        } else {
          // Fallback to client-side processing (has geotiff browser issues)
          const framePatterns = [
            (n: number) => `image${n.toString().padStart(5, '0')}.tiff`, // image00000.tiff
            (n: number) => `image${n.toString().padStart(5, '0')}.tif`,  // image00000.tif
            (n: number) => `${n.toString().padStart(6, '0')}.tif`,        // 000000.tif
            (n: number) => `${n.toString().padStart(3, '0')}.tif`,         // 000.tif
            (n: number) => `frame_${n.toString().padStart(6, '0')}.tif`,  // frame_000000.tif
          ];
          
          for (let i = 0; i < maxFramesToLoad; i += batchSize) {
            const batch = [];
            for (let j = 0; j < batchSize && (i + j) < maxFramesToLoad; j++) {
              const frameNum = i + j;
              
              // Try each naming pattern
              const fetchPromises = framePatterns.map(pattern => {
                const filename = pattern(frameNum);
                return fetch(`${PROXY_BASE_URL}/${datasetId}/images/${filename}`)
                  .then(res => {
                    if (res.ok) return res.blob();
                    return null; // Try next pattern
                  })
                  .then(blob => {
                    if (!blob) return null;
                    const file = new File([blob], filename, { type: 'image/tiff' });
                    return loadTIFFFile(file);
                  })
                  .catch((err) => {
                    console.warn(`Failed to load frame ${frameNum} with pattern:`, err);
                    return null;
                  });
              });
              
              // Use the first successful fetch
              batch.push(
                Promise.all(fetchPromises).then(results => {
                  const frame = results.find(r => r !== null);
                  if (!frame && i === 0 && j === 0) {
                    // Log error for first frame to help debug
                    console.error(`Could not load first frame (${frameNum}). Tried patterns:`, 
                      framePatterns.map(p => p(frameNum)));
                  }
                  return frame;
                })
              );
            }

            const batchFrames = await Promise.all(batch);
            const validFrames = batchFrames.filter(f => f !== null) as TIFFFrame[];
            frames.push(...validFrames);

            const progress = 10 + ((i + batchSize) / maxFramesToLoad) * 80;
            onProgress?.(Math.min(progress, 90), `Loaded ${frames.length} of ${maxFramesToLoad} frames...`);
            
            // If we're not getting any frames after first batch, throw error
            if (i >= batchSize && frames.length === 0) {
              throw new Error(
                `No frames could be loaded after trying ${batchSize} frames. ` +
                `Check browser console and proxy server logs. ` +
                `Dataset has ${frameCount} frames according to info.json.`
              );
            }
          }
        }
    
    if (frames.length === 0) {
      throw new Error(
        `Failed to load any frames. ` +
        `Dataset reports ${frameCount} frames, but none could be loaded. ` +
        `Check that files exist in the images directory and proxy can access them.`
      );
    }

    // Sort by frame index
    frames.sort((a, b) => a.frameIndex - b.frameIndex);

    onProgress?.(90, 'Fetching regions data...');

    // Fetch regions if available
    let regions = null;
    try {
      const regionsResponse = await fetch(`${PROXY_BASE_URL}/${datasetId}/regions.json`);
      if (regionsResponse.ok) {
        regions = await regionsResponse.json();
      }
    } catch (e) {
      console.warn('Regions file not available:', e);
    }

    onProgress?.(100, 'Dataset loaded successfully!');

    return { frames, regions };
  } catch (error) {
    console.error('Error fetching dataset:', error);
    throw error;
  }
}

/**
 * Alternative: Fetch from direct S3 URLs (requires CORS)
 * This may not work due to CORS restrictions
 */
export async function fetchDatasetDirect(): Promise<{ frames: TIFFFrame[]; regions?: any }> {
  // This would attempt direct S3 access
  // Likely to fail due to CORS, but included for completeness
  throw new Error('Direct S3 access not implemented - use proxy instead');
}

/**
 * Load from local files (for development)
 */
export async function loadDatasetFromLocalFiles(
  imageFiles: File[],
  regionsFile?: File
): Promise<{ frames: TIFFFrame[]; regions?: any }> {
  const frames: TIFFFrame[] = [];
  
  // Sort files by frame number
  const sortedFiles = [...imageFiles].sort((a, b) => {
    const aNum = extractFrameNumber(a.name);
    const bNum = extractFrameNumber(b.name);
    return aNum - bNum;
  });

  for (let i = 0; i < sortedFiles.length; i++) {
    const frame = await loadTIFFFile(sortedFiles[i]);
    if (frame) {
      frame.frameIndex = i;
      frames.push(frame);
    }
  }

  let regions = null;
  if (regionsFile) {
    try {
      const text = await regionsFile.text();
      regions = JSON.parse(text);
    } catch (error) {
      console.error('Error loading regions file:', error);
    }
  }

  return { frames, regions };
}

function extractFrameNumber(filename: string): number {
  const match = filename.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Fetch dataset info/manifest (from GitHub Pages or generate from dataset metadata)
 */
async function getDatasetInfo(datasetId: string): Promise<{ frameCount: number; frameFilenames: string[]; regions?: any }> {
  // Try to load manifest from GitHub Pages first
  try {
    const manifestUrl = `${DATASETS_BASE_URL}/${datasetId}.json`;
    const manifestResponse = await fetch(manifestUrl);
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      return {
        frameCount: manifest.frameCount,
        frameFilenames: manifest.frames?.map((f: any) => f.filename) || [],
        regions: manifest.regions
      };
    }
  } catch (e) {
    // Manifest not available, will generate from dataset metadata
  }
  
  // Fallback: use dataset metadata to generate frame filenames
  const { AVAILABLE_DATASETS } = await import('./datasetLoader');
  const dataset = AVAILABLE_DATASETS.find(d => d.id === datasetId);
  if (!dataset) {
    throw new Error(`Dataset ${datasetId} not found`);
  }
  
  const frameCount = dataset.frameCount || 2000;
  // Generate frame filenames - common patterns: 000.tif, 000000.tif, image00000.tiff
  const frameFilenames: string[] = [];
  const digits = frameCount.toString().length;
  const padding = Math.max(3, digits);
  
  for (let i = 0; i < frameCount; i++) {
    // Try common naming patterns
    const padded = i.toString().padStart(padding, '0');
    frameFilenames.push(`${padded}.tif`);
    frameFilenames.push(`${padded}.tiff`);
    frameFilenames.push(`image${padded}.tif`);
    frameFilenames.push(`image${padded}.tiff`);
  }
  
  return { frameCount, frameFilenames };
}

/**
 * Fetch and extract dataset ZIP from S3 (client-side extraction)
 * This downloads the ZIP once and extracts it in the browser
 */
export async function fetchDatasetFromS3(
  datasetId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{ frames: TIFFFrame[]; regions?: any }> {
  onProgress?.(0, 'Downloading dataset ZIP from S3...');
  
  try {
    // Dynamic import of JSZip (only load when needed)
    const JSZip = (await import('jszip')).default;
    
    // Get dataset info for frame count
    const datasetInfo = await getDatasetInfo(datasetId);
    const { frameCount, regions } = datasetInfo;
    
    // Download ZIP file from S3
    const zipUrl = `${NEUROFINDER_S3_BASE}/neurofinder.${datasetId}.zip`;
    onProgress?.(10, 'Downloading ZIP file (this may take a few minutes)...');
    
    let zipBlob: Blob;
    try {
      // Try direct S3 access first
      const response = await fetch(zipUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      zipBlob = await response.blob();
    } catch (directError) {
      // Fallback to CORS proxy
      onProgress?.(15, 'Using CORS proxy for download...');
      const proxyUrl = `${CORS_PROXY}${encodeURIComponent(zipUrl)}`;
      const proxyResponse = await fetch(proxyUrl);
      if (!proxyResponse.ok) {
        throw new Error(`Failed to download ZIP: ${proxyResponse.status}`);
      }
      zipBlob = await proxyResponse.blob();
    }
    
    onProgress?.(30, 'Extracting ZIP file in browser...');
    
    // Extract ZIP in browser
    const zip = await JSZip.loadAsync(zipBlob);
    
    // Find images directory in ZIP
    const imageEntries: { name: string; entry: any }[] = [];
    zip.forEach((relativePath, file) => {
      if (relativePath.includes('/images/') && (relativePath.endsWith('.tif') || relativePath.endsWith('.tiff'))) {
        imageEntries.push({ name: relativePath, entry: file });
      }
    });
    
    // Sort by filename
    imageEntries.sort((a, b) => a.name.localeCompare(b.name));
    
    if (imageEntries.length === 0) {
      throw new Error('No image files found in ZIP');
    }
    
    onProgress?.(40, `Found ${imageEntries.length} frames. Loading...`);
    
    // Load all frames
    const frames: TIFFFrame[] = [];
    const totalFrames = imageEntries.length;
    
    for (let i = 0; i < totalFrames; i++) {
      const progress = 40 + Math.floor((i / totalFrames) * 55);
      if (i % 50 === 0 || i < 5) {
        onProgress?.(progress, `Loading frame ${i + 1}/${totalFrames}...`);
      }
      
      try {
        const { name, entry } = imageEntries[i];
        const fileBlob = await entry.async('blob');
        const filename = name.split('/').pop() || `frame_${i}.tif`;
        const file = new File([fileBlob], filename, { type: 'image/tiff' });
        const frame = await loadTIFFFile(file);
        
        if (frame) {
          frame.frameIndex = i;
          frames.push(frame);
        }
      } catch (frameError) {
        console.warn(`Failed to load frame ${i}:`, frameError);
      }
    }
    
    // Try to find regions.json in ZIP
    let regionsData = regions || null;
    try {
      const regionsEntry = zip.file(/regions\.json$/i)[0];
      if (regionsEntry) {
        const regionsText = await regionsEntry.async('string');
        regionsData = JSON.parse(regionsText);
      }
    } catch (e) {
      // Regions not found, use existing or null
    }
    
    if (frames.length === 0) {
      throw new Error('No frames could be extracted from ZIP');
    }
    
    onProgress?.(95, 'Dataset loaded successfully!');
    
    return {
      frames,
      regions: regionsData
    };
  } catch (error) {
    throw new Error(`Failed to load dataset from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Try to fetch dataset, falling back to different methods
 */
export async function fetchDataset(
  datasetId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{ frames: TIFFFrame[]; regions?: any }> {
  // Try direct S3 access first (streaming, no download needed)
  try {
    return await fetchDatasetFromS3(datasetId, onProgress);
  } catch (s3Error) {
    console.warn('Direct S3 fetch failed, trying proxy...', s3Error);
    // Fallback to proxy if available (for local dev)
    try {
      return await fetchDatasetViaProxy(datasetId, onProgress);
    } catch (proxyError) {
      throw new Error(
        `Failed to load dataset. Tried:\n` +
        `1. Direct S3 access (with CORS proxy fallback)\n` +
        `2. Local proxy server\n\n` +
        `Error: ${s3Error instanceof Error ? s3Error.message : 'Unknown error'}\n\n` +
        `Make sure:\n` +
        `- S3 bucket is publicly accessible, or\n` +
        `- A proxy server is running: npm run proxy`
      );
    }
  }
}

