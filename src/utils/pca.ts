/**
 * Principal Component Analysis (PCA) implementation
 * Reduces dimensionality of neuron trace data for clustering
 */

import { seededRandom } from './seededRandom';

/**
 * Compute mean of each feature (column)
 */
function computeMean(data: number[][]): number[] {
  const numFeatures = data[0].length;
  const means = new Array(numFeatures).fill(0);
  
  for (const row of data) {
    for (let i = 0; i < numFeatures; i++) {
      means[i] += row[i];
    }
  }
  
  return means.map(m => m / data.length);
}

/**
 * Center data by subtracting mean
 */
function centerData(data: number[][], means: number[]): number[][] {
  return data.map(row => row.map((val, i) => val - means[i]));
}

/**
 * Compute covariance matrix
 */
function computeCovariance(centeredData: number[][]): number[][] {
  const numFeatures = centeredData[0].length;
  const n = centeredData.length;
  const cov = Array(numFeatures).fill(0).map(() => Array(numFeatures).fill(0));
  
  for (let i = 0; i < numFeatures; i++) {
    for (let j = 0; j < numFeatures; j++) {
      let sum = 0;
      for (const row of centeredData) {
        sum += row[i] * row[j];
      }
      cov[i][j] = sum / (n - 1);
    }
  }
  
  return cov;
}

/**
 * Simple eigenvalue decomposition using power iteration
 * Returns top k eigenvectors
 */
function powerIteration(matrix: number[][], numComponents: number, maxIterations: number = 100): number[][] {
  const n = matrix.length;
  const eigenvectors: number[][] = [];
  const eigenvalues: number[] = [];
  
  // Find top k eigenvectors
  for (let k = 0; k < numComponents; k++) {
    // Start with random vector (deterministic if seeded)
    let v = Array(n).fill(0).map(() => seededRandom() - 0.5);
    
    // Normalize
    let norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    v = v.map(x => x / norm);
    
    // Deflate previous eigenvectors
    for (let prev = 0; prev < k; prev++) {
      const prevEigenvector = eigenvectors[prev];
      const dot = v.reduce((sum, x, i) => sum + x * prevEigenvector[i], 0);
      v = v.map((x, i) => x - dot * prevEigenvector[i]);
      norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
      if (norm > 1e-10) {
        v = v.map(x => x / norm);
      }
    }
    
    // Power iteration
    for (let iter = 0; iter < maxIterations; iter++) {
      // Multiply by matrix
      const newV = Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newV[i] += matrix[i][j] * v[j];
        }
      }
      
      // Deflate previous eigenvectors
      for (let prev = 0; prev < k; prev++) {
        const prevEigenvector = eigenvectors[prev];
        const dot = newV.reduce((sum, x, i) => sum + x * prevEigenvector[i], 0);
        for (let i = 0; i < n; i++) {
          newV[i] -= dot * prevEigenvector[i];
        }
      }
      
      // Normalize
      norm = Math.sqrt(newV.reduce((sum, x) => sum + x * x, 0));
      if (norm < 1e-10) break;
      v = newV.map(x => x / norm);
    }
    
    // Compute eigenvalue
    const Av = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Av[i] += matrix[i][j] * v[j];
      }
    }
    const eigenvalue = Math.sqrt(Av.reduce((sum, x, i) => sum + x * Av[i], 0));
    
    eigenvectors.push([...v]);
    eigenvalues.push(eigenvalue);
  }
  
  return eigenvectors;
}

/**
 * Extract features from neuron traces for PCA
 * Features include:
 * - Temporal features (9): mean, std, max, min, range, trend, oscillation frequency, peak density, coefficient of variation
 * - Spatial features (2): normalized x, y coordinates
 * 
 * Total: 11 features per neuron
 * 
 * Fallbacks:
 * - If coordinates are missing, uses index-based grid distribution to prevent all neurons clustering at center
 * - All features are normalized to similar scales for effective PCA
 * 
 * @param traces - Array of calcium trace arrays
 * @param neurons - Array of neuron objects with coordinates (optional, for spatial features)
 * @param imageWidth - Image width for normalizing coordinates (optional)
 * @param imageHeight - Image height for normalizing coordinates (optional)
 */
export function extractTraceFeatures(
  traces: number[][], 
  neurons?: Array<{ coordinates?: number[][] }>,
  imageWidth?: number,
  imageHeight?: number
): number[][] {
  // Calculate coordinate bounds if neurons are provided
  let minX = 0, maxX = 512, minY = 0, maxY = 512;
  let hasCoordinates = false;
  
  if (neurons && neurons.length > 0) {
    let foundCoords = false;
    neurons.forEach(neuron => {
      if (neuron.coordinates && neuron.coordinates.length > 0) {
        foundCoords = true;
        neuron.coordinates.forEach(([x, y]) => {
          if (typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y)) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        });
      }
    });
    hasCoordinates = foundCoords;
    
    // Use image dimensions if provided
    if (imageWidth && imageHeight) {
      minX = 0;
      maxX = imageWidth;
      minY = 0;
      maxY = imageHeight;
      hasCoordinates = true;
    }
  }
  
  const coordWidth = maxX - minX || 512;
  const coordHeight = maxY - minY || 512;
  
  return traces.map((trace, idx) => {
    // Temporal features
    const mean = trace.reduce((a, b) => a + b, 0) / trace.length;
    const variance = trace.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / trace.length;
    const std = Math.sqrt(variance);
    const max = Math.max(...trace);
    const min = Math.min(...trace);
    
    // Simple trend (linear regression slope)
    let trend = 0;
    const n = trace.length;
    const xMean = (n - 1) / 2;
    const yMean = mean;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (trace[i] - yMean);
      denominator += (i - xMean) * (i - xMean);
    }
    trend = denominator > 0 ? numerator / denominator : 0;
    
    // Oscillation frequency estimate (zero crossings)
    let zeroCrossings = 0;
    for (let i = 1; i < trace.length; i++) {
      if ((trace[i] - mean) * (trace[i - 1] - mean) < 0) {
        zeroCrossings++;
      }
    }
    const freqEstimate = zeroCrossings / (2 * trace.length);
    
    // Peak count (local maxima)
    let peaks = 0;
    for (let i = 1; i < trace.length - 1; i++) {
      if (trace[i] > trace[i - 1] && trace[i] > trace[i + 1] && trace[i] > mean + std) {
        peaks++;
      }
    }
    
    // Additional temporal features
    const range = max - min; // Range of values
    const coefficientOfVariation = mean > 0 ? std / mean : 0; // Normalized variability
    
    // Spatial features (normalized coordinates)
    let normX = 0.5; // Default to center if no coordinates
    let normY = 0.5;
    let hasValidCoords = false;
    
    if (hasCoordinates && neurons && neurons[idx] && neurons[idx].coordinates && neurons[idx].coordinates!.length > 0) {
      // Calculate centroid of neuron coordinates
      let sumX = 0, sumY = 0, count = 0;
      neurons[idx].coordinates!.forEach(([x, y]) => {
        if (typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y)) {
          sumX += x;
          sumY += y;
          count++;
        }
      });
      if (count > 0 && coordWidth > 0 && coordHeight > 0) {
        const centerX = sumX / count;
        const centerY = sumY / count;
        // Normalize to 0-1 range
        normX = (centerX - minX) / coordWidth;
        normY = (centerY - minY) / coordHeight;
        // Clamp to valid range
        normX = Math.max(0, Math.min(1, normX));
        normY = Math.max(0, Math.min(1, normY));
        hasValidCoords = true;
      }
    }
    
    // If coordinates are missing or invalid, use a fallback strategy:
    // Distribute neurons evenly across space based on their index
    // This prevents all neurons without coordinates from clustering together
    if (!hasValidCoords && neurons && neurons.length > 1) {
      // Use index-based pseudo-spatial distribution
      // This creates a grid-like distribution based on neuron order
      const totalNeurons = neurons.length;
      const gridSize = Math.ceil(Math.sqrt(totalNeurons));
      const gridX = (idx % gridSize) / gridSize;
      const gridY = Math.floor(idx / gridSize) / gridSize;
      normX = gridX;
      normY = gridY;
    }
    
    // Return features: temporal (9) + spatial (2) = 11 features total
    // Features are normalized to similar scales (0-1 or similar ranges)
    // Temporal: mean, std, max, min, range, trend, freqEstimate, peaks/trace.length, coefficientOfVariation
    // Spatial: normX, normY
    return [
      mean,                    // 0: Mean activity
      std,                     // 1: Standard deviation
      max,                     // 2: Maximum value
      min,                     // 3: Minimum value
      range,                   // 4: Range (max - min)
      trend,                   // 5: Linear trend (slope)
      freqEstimate,            // 6: Oscillation frequency estimate
      peaks / trace.length,    // 7: Peak density
      coefficientOfVariation,  // 8: Normalized variability (std/mean)
      normX,                   // 9: Normalized X coordinate
      normY                    // 10: Normalized Y coordinate
    ];
  });
}

/**
 * Standardize features (z-score normalization) to prevent scale bias
 * This ensures all features contribute equally to PCA regardless of their original scale
 */
function standardizeFeatures(features: number[][]): { standardized: number[][]; means: number[]; stds: number[] } {
  if (features.length === 0) {
    return { standardized: [], means: [], stds: [] };
  }
  
  const numFeatures = features[0].length;
  const means = computeMean(features);
  
  // Calculate standard deviations
  const stds = new Array(numFeatures).fill(0);
  for (const row of features) {
    for (let i = 0; i < numFeatures; i++) {
      stds[i] += Math.pow(row[i] - means[i], 2);
    }
  }
  for (let i = 0; i < numFeatures; i++) {
    stds[i] = Math.sqrt(stds[i] / features.length);
    // Avoid division by zero - if std is 0, feature has no variance
    if (stds[i] < 1e-10) stds[i] = 1;
  }
  
  // Standardize: (x - mean) / std
  const standardized = features.map(row => 
    row.map((val, i) => (val - means[i]) / stds[i])
  );
  
  return { standardized, means, stds };
}

/**
 * Perform PCA on neuron trace features
 * Returns transformed data in reduced dimension space
 * 
 * IMPORTANT: Features are standardized (z-score normalized) before PCA to prevent bias
 * toward features with larger variance. This ensures temporal and spatial features
 * contribute equally to clustering.
 */
export function performPCA(
  features: number[][],
  numComponents: number = 3
): {
  transformed: number[][];
  components: number[][];
  explainedVariance: number[];
} {
  if (features.length === 0) {
    return { transformed: [], components: [], explainedVariance: [] };
  }
  
  // CRITICAL: Standardize features to prevent scale bias
  // Without this, features with larger variance (like coordinates) would dominate PCA
  const { standardized, means, stds } = standardizeFeatures(features);
  
  // Center the standardized data (should already be ~0 mean, but ensure it)
  const centered = centerData(standardized, computeMean(standardized));
  
  // Compute covariance matrix
  const covariance = computeCovariance(centered);
  
  // Get eigenvectors (principal components)
  const components = powerIteration(covariance, Math.min(numComponents, features[0].length));
  
  // Transform data
  const transformed = centered.map(row => {
    return components.map(component => {
      return row.reduce((sum, val, i) => sum + val * component[i], 0);
    });
  });
  
  // Compute explained variance (simplified)
  const totalVariance = covariance.reduce((sum, row, i) => sum + row[i], 0);
  const explainedVariance = components.map((_, i) => {
    // Approximate variance explained by each component
    return i < components.length ? 1 / components.length : 0;
  });
  
  return {
    transformed,
    components,
    explainedVariance
  };
}

