/**
 * TIFF Image Sequence Loader for Neurofinder Datasets
 * 
 * Neurofinder datasets consist of TIFF image sequences where each frame
 * represents a single time point in the calcium imaging movie.
 */

export interface TIFFFrame {
  data: Uint16Array | Uint8Array;
  width: number;
  height: number;
  frameIndex: number;
}

/**
 * Load a single TIFF file from a File object
 */
export async function loadTIFFFile(file: File): Promise<TIFFFrame | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Try to import geotiff (may fail in browser due to module resolution issues)
    // This is a fallback - server-side processing is preferred
    let geotiffModule;
    try {
      geotiffModule = await import('geotiff');
    } catch (importError) {
      console.warn('geotiff not available in browser. Use server-side processing instead.');
      throw new Error('geotiff module not available - use server-side processing');
    }
    
    const tiff = await geotiffModule.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();
    const width = image.getWidth();
    const height = image.getHeight();

    // Convert to appropriate format
    const data = rasters[0] as Uint16Array | Uint8Array;

    return {
      data,
      width,
      height,
      frameIndex: 0
    };
  } catch (error) {
    console.error('Error loading TIFF file:', error);
    // Return null - caller should use server-side processing instead
    return null;
  }
}

/**
 * Load multiple TIFF files as a sequence
 * Files should be named in sequential order (e.g., frame_000.tif, frame_001.tif)
 */
export async function loadTIFFSequence(files: File[]): Promise<TIFFFrame[]> {
  const frames: TIFFFrame[] = [];
  
  // Sort files by name to ensure correct order
  const sortedFiles = [...files].sort((a, b) => {
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

  return frames;
}

/**
 * Extract frame number from filename
 * Handles patterns like: frame_000.tif, 000.tif, frame000.tif, etc.
 */
function extractFrameNumber(filename: string): number {
  const match = filename.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Convert TIFF frame data to ImageData for canvas rendering
 */
export function tiffFrameToImageData(frame: TIFFFrame): ImageData {
  const { data, width, height } = frame;
  const imageData = new ImageData(width, height);
  
  // Normalize and convert to RGBA
  // Calculate max/min in a loop to avoid stack overflow with large arrays
  let max = -Infinity;
  let min = Infinity;
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (value > max) max = value;
    if (value < min) min = value;
  }
  const range = max - min || 1;

  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - min) / range;
    const pixelIndex = i * 4;
    imageData.data[pixelIndex] = normalized * 255;     // R
    imageData.data[pixelIndex + 1] = normalized * 255; // G
    imageData.data[pixelIndex + 2] = normalized * 255; // B
    imageData.data[pixelIndex + 3] = 255;              // A
  }

  return imageData;
}

/**
 * Load neurofinder dataset from a directory of TIFF files
 * Also attempts to load ground truth regions if available
 */
export async function loadNeurofinderDataset(
  tiffFiles: File[],
  regionsFile?: File
): Promise<{ frames: TIFFFrame[]; regions?: any }> {
  const frames = await loadTIFFSequence(tiffFiles);
  
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

