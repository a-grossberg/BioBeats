/**
 * Neurofinder Dataset Fetcher
 * 
 * Fetches datasets from Neurofinder S3 bucket or local proxy
 */

import { TIFFFrame, loadTIFFFile } from './tiffLoader';

// S3 bucket base URL for Neurofinder datasets
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
 * Fetch a frame from S3, trying direct access first, then CORS proxy
 */
async function fetchFrameFromS3(datasetId: string, filename: string): Promise<Blob | null> {
  // Try multiple S3 URL patterns
  const s3UrlPatterns = [
    `${NEUROFINDER_S3_BASE}/neurofinder.${datasetId}/images/${filename}`,
    `${NEUROFINDER_S3_BASE}/${datasetId}/images/${filename}`,
    `${NEUROFINDER_S3_BASE}/neurofinder.${datasetId}/${filename}`,
  ];
  
  // Try direct S3 access first
  for (const s3Url of s3UrlPatterns) {
    try {
      const response = await fetch(s3Url, { mode: 'cors' });
      if (response.ok) {
        return await response.blob();
      }
    } catch (e) {
      // CORS error or not found, try next pattern
      continue;
    }
  }
  
  // If direct access fails, try with CORS proxy
  for (const s3Url of s3UrlPatterns) {
    try {
      const proxyUrl = `${CORS_PROXY}${encodeURIComponent(s3Url)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        return await response.blob();
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
}

/**
 * Fetch dataset directly from S3 (streaming, no download needed)
 */
export async function fetchDatasetFromS3(
  datasetId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{ frames: TIFFFrame[]; regions?: any }> {
  onProgress?.(0, 'Loading dataset from S3...');
  
  try {
    // Get dataset info
    onProgress?.(5, 'Getting dataset information...');
    const datasetInfo = await getDatasetInfo(datasetId);
    const { frameCount, frameFilenames, regions } = datasetInfo;
    
    onProgress?.(10, `Found ${frameCount} frames. Loading from S3...`);
    
    // Try to find the correct filename pattern by testing a few frames
    let workingPattern: string | null = null;
    const testFrames = [0, Math.floor(frameCount / 2), frameCount - 1];
    
    for (const frameIdx of testFrames) {
      for (let patternOffset = 0; patternOffset < 4; patternOffset++) {
        const filenameIdx = frameIdx * 4 + patternOffset;
        if (filenameIdx < frameFilenames.length) {
          const testFilename = frameFilenames[filenameIdx];
          const blob = await fetchFrameFromS3(datasetId, testFilename);
          if (blob) {
            workingPattern = testFilename.replace(/\d+/, '{}');
            break;
          }
        }
      }
      if (workingPattern) break;
    }
    
    if (!workingPattern) {
      // Fallback: try common patterns
      const commonPatterns = ['000.tif', '000000.tif', 'image00000.tif'];
      for (const pattern of commonPatterns) {
        const testBlob = await fetchFrameFromS3(datasetId, pattern);
        if (testBlob) {
          workingPattern = pattern;
          break;
        }
      }
    }
    
    if (!workingPattern) {
      throw new Error('Could not determine frame filename pattern. S3 bucket may not be publicly accessible.');
    }
    
    // Generate all frame filenames based on working pattern
    const basePattern = workingPattern.replace('{}', '');
    const digits = basePattern.match(/\d+/)?.[0]?.length || 3;
    const actualFilenames: string[] = [];
    
    for (let i = 0; i < frameCount; i++) {
      const padded = i.toString().padStart(digits, '0');
      actualFilenames.push(basePattern.replace(/\d+/, padded));
    }
    
    // Load all frames
    const frames: TIFFFrame[] = [];
    
    for (let i = 0; i < frameCount; i++) {
      const progress = 10 + Math.floor((i / frameCount) * 85);
      if (i % 10 === 0 || i < 5) {
        onProgress?.(progress, `Loading frame ${i + 1}/${frameCount} from S3...`);
      }
      
      const filename = actualFilenames[i];
      const blob = await fetchFrameFromS3(datasetId, filename);
      
      if (blob) {
        try {
          const file = new File([blob], filename, { type: 'image/tiff' });
          const frame = await loadTIFFFile(file);
          if (frame) {
            frame.frameIndex = i;
            frames.push(frame);
          }
        } catch (frameError) {
          console.warn(`Failed to parse frame ${i}:`, frameError);
        }
      }
    }
    
    if (frames.length === 0) {
      throw new Error('No frames could be loaded from S3');
    }
    
    onProgress?.(95, 'Dataset loaded successfully!');
    
    return {
      frames,
      regions: regions || null
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

