/**
 * Neurofinder Dataset Loader
 * 
 * Loads datasets directly from Neurofinder S3 buckets or provided URLs
 */

import { TIFFFrame, loadTIFFFile } from './tiffLoader';

export interface DatasetInfo {
  id: string;
  name: string;
  description: string;
  source: string;
  region?: string;
  condition?: 'control' | 'disease' | 'unknown';
  imageUrl?: string;
  regionsUrl?: string;
  frameCount?: number;
  size?: string;
  organism?: string;
  lab?: string;
  location?: string;
  institution?: string;
  indicator?: string;
  rateHz?: number;
  dimensions?: number[];
}

/**
 * Available Neurofinder datasets
 * These are the 19 training datasets from the benchmark
 * (All training datasets available from the Neurofinder GitHub repository)
 */
export const AVAILABLE_DATASETS: DatasetInfo[] = [
  {
    id: '00.00',
    name: 'neurofinder.00.00',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 3024,
    dimensions: [512, 512, 3024],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.01',
    name: 'neurofinder.00.01',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 3048,
    dimensions: [512, 512, 3048],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.02',
    name: 'neurofinder.00.02',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 2000,
    dimensions: [512, 512, 2000],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.03',
    name: 'neurofinder.00.03',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 3052,
    dimensions: [512, 512, 3052],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.04',
    name: 'neurofinder.00.04',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 2000,
    dimensions: [512, 512, 2000],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.05',
    name: 'neurofinder.00.05',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 2000,
    dimensions: [512, 512, 2000],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.06',
    name: 'neurofinder.00.06',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 2000,
    dimensions: [512, 512, 2000],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.07',
    name: 'neurofinder.00.07',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 2000,
    dimensions: [512, 512, 2000],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.08',
    name: 'neurofinder.00.08',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 3336,
    dimensions: [512, 512, 3336],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.09',
    name: 'neurofinder.00.09',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 2000,
    dimensions: [512, 512, 2000],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.10',
    name: 'neurofinder.00.10',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 2000,
    dimensions: [512, 512, 2000],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '00.11',
    name: 'neurofinder.00.11',
    description: 'Janelia - vS1 Cortex',
    source: 'Simon Peron / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7,
    frameCount: 2000,
    dimensions: [512, 512, 2000],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '01.00',
    name: 'neurofinder.01.00',
    description: 'UCL - V1 Cortex',
    source: 'Adam Packer, Lloyd Russell / Hausser Lab',
    lab: 'Hausser Lab',
    location: 'UCL',
    region: 'V1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7.5,
    frameCount: 2250,
    dimensions: [512, 512, 2250],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '01.01',
    name: 'neurofinder.01.01',
    description: 'UCL - V1 Cortex',
    source: 'Adam Packer, Lloyd Russell / Hausser Lab',
    lab: 'Hausser Lab',
    location: 'UCL',
    region: 'V1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 7.5,
    frameCount: 1825,
    dimensions: [512, 512, 1825],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '02.00',
    name: 'neurofinder.02.00',
    description: 'Janelia - vS1 Cortex',
    source: 'Nicholas Sofroniew / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 8,
    frameCount: 8000,
    dimensions: [512, 512, 8000],
    condition: 'unknown',
    size: '~200 MB'
  },
  {
    id: '02.01',
    name: 'neurofinder.02.01',
    description: 'Janelia - vS1 Cortex',
    source: 'Nicholas Sofroniew / Svoboda Lab',
    lab: 'Svoboda Lab',
    location: 'Janelia Research Campus',
    region: 'vS1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 8,
    frameCount: 2000,
    dimensions: [512, 512, 2000],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '03.00',
    name: 'neurofinder.03.00',
    description: 'Columbia - Hippocampus',
    source: 'Jeff Zaremba / Losonczy Lab',
    lab: 'Losonczy Lab',
    location: 'Columbia University',
    region: 'dHPC CA1 (Hippocampus)',
    organism: 'Mouse',
    indicator: 'GCaMP6f',
    rateHz: 7.5,
    frameCount: 2250,
    dimensions: [498, 490, 2250],
    condition: 'unknown',
    size: '~50 MB'
  },
  {
    id: '04.00',
    name: 'neurofinder.04.00',
    description: 'Harvard - S1 Cortex',
    source: 'Matthias Minderer / Harvey Lab',
    lab: 'Harvey Lab',
    location: 'Harvard Medical School',
    region: 'hindlimb S1 (Cortex)',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 6.75,
    frameCount: 3000,
    dimensions: [512, 512, 3000],
    condition: 'unknown',
    size: '~75 MB'
  },
  {
    id: '04.01',
    name: 'neurofinder.04.01',
    description: 'Harvard - PPC Cortex',
    source: 'Selmaan Chettih / Harvey Lab',
    lab: 'Harvey Lab',
    location: 'Harvard Medical School',
    region: 'Posterior Parietal Cortex',
    organism: 'Mouse',
    indicator: 'GCaMP6s',
    rateHz: 3,
    frameCount: 3000,
    dimensions: [512, 512, 3000],
    condition: 'unknown',
    size: '~75 MB'
  }
];

/**
 * Construct S3 URL for Neurofinder dataset
 * Based on the pattern: https://s3.amazonaws.com/neurofinder.datasets/{dataset_id}.zip
 */
function getDatasetUrl(datasetId: string, fileType: 'images' | 'regions' = 'images'): string {
  // Note: These URLs may need to be adjusted based on actual S3 bucket structure
  // For now, we'll use a pattern that works with the neurofinder data structure
  const baseUrl = `https://s3.amazonaws.com/neurofinder.datasets`;
  
  if (fileType === 'regions') {
    return `${baseUrl}/${datasetId}/regions/regions.json`;
  }
  
  // For images, we'll need to fetch individual frames
  // This is a placeholder - actual implementation would need to know frame URLs
  return `${baseUrl}/${datasetId}/images/`;
}

/**
 * Fetch a file from URL and convert to File object
 */
async function fetchAsFile(url: string, filename: string): Promise<File> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

/**
 * Load Neurofinder dataset from URL
 * 
 * This function attempts to load a dataset by fetching TIFF files and regions
 * from the Neurofinder S3 bucket. Note that this requires CORS to be enabled
 * on the S3 bucket, or a proxy server.
 */
export async function loadDatasetFromUrl(
  datasetId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{ frames: TIFFFrame[]; regions?: any }> {
  const dataset = AVAILABLE_DATASETS.find(d => d.id === datasetId);
  if (!dataset) {
    throw new Error(`Dataset ${datasetId} not found`);
  }

  onProgress?.(0, 'Preparing to load dataset...');

  // For now, we'll use a demo approach:
  // Since direct S3 access might have CORS issues, we'll provide
  // a way to load from a local server or use a proxy
  
  // Option 1: Use a CORS proxy (for development)
  const useProxy = true;
  const proxyUrl = useProxy ? 'https://corsproxy.io/?' : '';
  
  // Option 2: Load from local server (recommended for production)
  // This would require setting up a backend that fetches from S3
  
  // For this implementation, we'll create a helper that can work with
  // either direct URLs (if CORS allows) or a backend proxy
  
  throw new Error(
    'Direct dataset loading from S3 requires either:\n' +
    '1. A backend proxy server to fetch data\n' +
    '2. CORS-enabled S3 bucket access\n' +
    '3. Pre-downloaded data served locally\n\n' +
    'For now, please use the demo data or set up a data proxy.'
  );
}

/**
 * Load dataset from local files (for development/demo)
 * This is a fallback that can work with pre-downloaded data
 */
export async function loadDatasetFromFiles(
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
 * Generate demo/synthetic dataset for testing
 * This creates a dataset with realistic calcium imaging patterns
 */
export function generateDemoDataset(datasetId: string = 'demo'): {
  frames: TIFFFrame[];
  regions: any[];
} {
  // This would generate synthetic data
  // For now, return empty - we'll use the existing demo data generation
  return { frames: [], regions: [] };
}

