import { TIFFFrame } from './tiffLoader';
import { Neuron, CalciumDataset } from '../types';

/**
 * Extract calcium traces from TIFF image sequence
 * 
 * This function identifies neurons (ROIs) and extracts their fluorescence
 * intensity over time from the image sequence.
 */

export interface ROI {
  id: number;
  coordinates: number[][];
  mask: boolean[][];
}

/**
 * Extract ROIs from ground truth regions (if available)
 */
export function extractROIsFromRegions(regions: any[]): ROI[] {
  return regions.map((region, index) => {
    const coordinates = region.coordinates || [];
    // Create a bounding box and mask for the ROI
    const xs = coordinates.map((c: number[]) => c[0]);
    const ys = coordinates.map((c: number[]) => c[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Simple rectangular mask (could be improved with polygon filling)
    const mask: boolean[][] = [];
    for (let y = minY; y <= maxY; y++) {
      mask[y] = [];
      for (let x = minX; x <= maxX; x++) {
        // Check if point is inside polygon (simplified)
        mask[y][x] = coordinates.some((c: number[]) => 
          Math.abs(c[0] - x) < 2 && Math.abs(c[1] - y) < 2
        );
      }
    }

    return {
      id: index,
      coordinates,
      mask
    };
  });
}

/**
 * Extract calcium trace for a single ROI from frame sequence
 */
export function extractTraceForROI(
  frames: TIFFFrame[],
  roi: ROI,
  width: number,
  height: number
): number[] {
  const trace: number[] = [];

  for (const frame of frames) {
    let sum = 0;
    let count = 0;

    // Sample pixels within the ROI
    for (const coord of roi.coordinates) {
      const x = Math.floor(coord[0]);
      const y = Math.floor(coord[1]);
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const index = y * width + x;
        if (index < frame.data.length) {
          sum += frame.data[index];
          count++;
        }
      }
    }

    // Average intensity for this frame
    const avgIntensity = count > 0 ? sum / count : 0;
    trace.push(avgIntensity);
  }

  return trace;
}

/**
 * Auto-detect ROIs using simple peak detection
 * This is a fallback when ground truth regions are not available
 */
export function detectROIsAuto(
  frames: TIFFFrame[],
  numROIs: number = 20,
  width: number,
  height: number
): ROI[] {
  // Calculate temporal variance for each pixel
  const variance = new Float32Array(width * height);
  
  // First pass: calculate mean for each pixel
  const means = new Float32Array(width * height);
  for (const frame of frames) {
    for (let i = 0; i < frame.data.length; i++) {
      means[i] += frame.data[i];
    }
  }
  for (let i = 0; i < means.length; i++) {
    means[i] /= frames.length;
  }

  // Second pass: calculate variance
  for (const frame of frames) {
    for (let i = 0; i < frame.data.length; i++) {
      const diff = frame.data[i] - means[i];
      variance[i] += diff * diff;
    }
  }
  for (let i = 0; i < variance.length; i++) {
    variance[i] /= frames.length;
  }

  // Find peaks (high variance pixels)
  const threshold = Array.from(variance).sort((a, b) => b - a)[numROIs * 10];
  const peaks: { x: number; y: number; variance: number }[] = [];

  for (let y = 5; y < height - 5; y++) {
    for (let x = 5; x < width - 5; x++) {
      const idx = y * width + x;
      if (variance[idx] > threshold) {
        // Check if this is a local maximum
        let isLocalMax = true;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = (y + dy) * width + (x + dx);
            if (variance[nIdx] > variance[idx]) {
              isLocalMax = false;
              break;
            }
          }
          if (!isLocalMax) break;
        }

        if (isLocalMax) {
          peaks.push({ x, y, variance: variance[idx] });
        }
      }
    }
  }

  // Sort by variance and take top N, ensuring minimum distance
  peaks.sort((a, b) => b.variance - a.variance);
  const selectedPeaks: { x: number; y: number }[] = [];
  const minDistance = 10;

  for (const peak of peaks) {
    if (selectedPeaks.length >= numROIs) break;
    
    const tooClose = selectedPeaks.some(p => {
      const dist = Math.sqrt(
        Math.pow(p.x - peak.x, 2) + Math.pow(p.y - peak.y, 2)
      );
      return dist < minDistance;
    });

    if (!tooClose) {
      selectedPeaks.push({ x: peak.x, y: peak.y });
    }
  }

  // Create ROIs around detected peaks
  return selectedPeaks.map((peak, index) => {
    const radius = 3;
    const coordinates: number[][] = [];
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          coordinates.push([peak.x + dx, peak.y + dy]);
        }
      }
    }

    return {
      id: index,
      coordinates,
      mask: [] // Not needed for coordinate-based extraction
    };
  });
}

/**
 * Normalize calcium traces (baseline subtraction and normalization)
 */
export function normalizeTraces(traces: number[][]): number[][] {
  return traces.map(trace => {
    // Calculate baseline (percentile)
    const sorted = [...trace].sort((a, b) => a - b);
    const baseline = sorted[Math.floor(sorted.length * 0.1)]; // 10th percentile
    
    // Subtract baseline and normalize
    const max = Math.max(...trace.map(v => v - baseline));
    if (max === 0) return trace.map(() => 0);
    
    return trace.map(v => Math.max(0, (v - baseline) / max));
  });
}

/**
 * Convert TIFF frames to CalciumDataset
 */
export async function framesToCalciumDataset(
  frames: TIFFFrame[],
  regions?: any[],
  metadata?: { datasetName?: string; region?: string; condition?: 'control' | 'disease' | 'unknown' }
): Promise<CalciumDataset> {
  if (frames.length === 0) {
    throw new Error('No frames provided');
  }

  const width = frames[0].width;
  const height = frames[0].height;

  // Extract ROIs
  let rois: ROI[];
  if (regions && regions.length > 0) {
    rois = extractROIsFromRegions(regions);
  } else {
    // Auto-detect ROIs
    rois = detectROIsAuto(frames, 20, width, height);
  }

  // Extract traces
  const rawTraces = rois.map(roi => 
    extractTraceForROI(frames, roi, width, height)
  );

  // Normalize traces
  const normalizedTraces = normalizeTraces(rawTraces);

  // Create neurons
  const neurons: Neuron[] = normalizedTraces.map((trace, i) => {
    // Calculate oscillation properties
    const mean = trace.reduce((a, b) => a + b, 0) / trace.length;
    const variance = trace.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / trace.length;
    
    return {
      id: i,
      name: `Neuron ${i + 1}`,
      trace,
      coordinates: rois[i].coordinates,
      amplitude: Math.sqrt(variance),
      baseline: mean
    };
  });

  return {
    neurons,
    frames: frames.length,
    fps: 10, // Default, should be configurable
    datasetName: metadata?.datasetName,
    imageWidth: width,
    imageHeight: height,
    frameImages: frames, // Store frames for visualization
    metadata
  };
}

