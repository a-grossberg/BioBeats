import { CalciumDataset } from '../types';

/**
 * Calculate cross-correlation between two traces
 * Returns correlation coefficient (-1 to 1)
 */
function crossCorrelation(trace1: number[], trace2: number[]): number {
  const minLength = Math.min(trace1.length, trace2.length);
  const t1 = trace1.slice(0, minLength);
  const t2 = trace2.slice(0, minLength);

  // Calculate means
  const mean1 = t1.reduce((a, b) => a + b, 0) / minLength;
  const mean2 = t2.reduce((a, b) => a + b, 0) / minLength;

  // Calculate covariance and variances
  let covariance = 0;
  let variance1 = 0;
  let variance2 = 0;

  for (let i = 0; i < minLength; i++) {
    const diff1 = t1[i] - mean1;
    const diff2 = t2[i] - mean2;
    covariance += diff1 * diff2;
    variance1 += diff1 * diff1;
    variance2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(variance1 * variance2);
  if (denominator === 0) return 0;

  return covariance / denominator;
}

/**
 * Calculate temporal synchronization between datasets
 * Measures how often neurons fire together
 */
function calculateSynchronization(
  dataset1: CalciumDataset,
  dataset2: CalciumDataset
): number {
  const minNeurons = Math.min(dataset1.neurons.length, dataset2.neurons.length);
  const minFrames = Math.min(dataset1.frames, dataset2.frames);

  let totalSync = 0;
  let count = 0;

  for (let i = 0; i < minNeurons; i++) {
    const trace1 = dataset1.neurons[i].trace.slice(0, minFrames);
    const trace2 = dataset2.neurons[i].trace.slice(0, minFrames);

    // Count frames where both are active (above threshold)
    const threshold = 0.1;
    let syncFrames = 0;
    for (let f = 0; f < minFrames; f++) {
      const bothActive = (trace1[f] > threshold && trace2[f] > threshold);
      const bothInactive = (trace1[f] <= threshold && trace2[f] <= threshold);
      if (bothActive || bothInactive) {
        syncFrames++;
      }
    }
    totalSync += syncFrames / minFrames;
    count++;
  }

  return count > 0 ? totalSync / count : 0;
}

/**
 * Calculate harmonic similarity
 * Measures how similar the frequency/amplitude patterns are
 */
function calculateHarmonicSimilarity(
  dataset1: CalciumDataset,
  dataset2: CalciumDataset
): number {
  const minNeurons = Math.min(dataset1.neurons.length, dataset2.neurons.length);
  const minFrames = Math.min(dataset1.frames, dataset2.frames);

  let totalCorrelation = 0;
  let count = 0;

  for (let i = 0; i < minNeurons; i++) {
    const trace1 = dataset1.neurons[i].trace.slice(0, minFrames);
    const trace2 = dataset2.neurons[i].trace.slice(0, minFrames);
    
    const correlation = crossCorrelation(trace1, trace2);
    totalCorrelation += correlation;
    count++;
  }

  return count > 0 ? totalCorrelation / count : 0;
}

/**
 * Calculate activity pattern similarity
 * Compares overall activity patterns across time
 */
function calculateActivityPatternSimilarity(
  dataset1: CalciumDataset,
  dataset2: CalciumDataset
): number {
  const minFrames = Math.min(dataset1.frames, dataset2.frames);

  // Calculate average activity per frame for each dataset
  const activity1: number[] = [];
  const activity2: number[] = [];

  for (let f = 0; f < minFrames; f++) {
    const avg1 = dataset1.neurons.reduce((sum, n) => sum + (n.trace[f] || 0), 0) / dataset1.neurons.length;
    const avg2 = dataset2.neurons.reduce((sum, n) => sum + (n.trace[f] || 0), 0) / dataset2.neurons.length;
    activity1.push(avg1);
    activity2.push(avg2);
  }

  return crossCorrelation(activity1, activity2);
}

/**
 * Calculate overall musical concordance/discordance
 * Returns a score from -1 (completely discordant) to 1 (completely concordant)
 */
export interface MusicalConcordance {
  overallScore: number; // -1 to 1, where 1 = perfectly concordant, -1 = perfectly discordant
  synchronization: number; // 0 to 1, how often neurons fire together
  harmonicSimilarity: number; // -1 to 1, correlation of activity patterns
  activityPatternSimilarity: number; // -1 to 1, similarity of overall activity over time
  interpretation: string; // Human-readable interpretation
}

export function calculateMusicalConcordance(
  dataset1: CalciumDataset,
  dataset2: CalciumDataset
): MusicalConcordance {
  const synchronization = calculateSynchronization(dataset1, dataset2);
  const harmonicSimilarity = calculateHarmonicSimilarity(dataset1, dataset2);
  const activityPatternSimilarity = calculateActivityPatternSimilarity(dataset1, dataset2);

  // Weighted average to get overall score
  // Synchronization is most important for musical concordance
  const overallScore = (
    synchronization * 0.4 +
    (harmonicSimilarity + 1) / 2 * 0.3 + // Normalize -1 to 1 -> 0 to 1
    (activityPatternSimilarity + 1) / 2 * 0.3
  ) * 2 - 1; // Scale back to -1 to 1

  // Generate interpretation
  let interpretation: string;
  if (overallScore > 0.7) {
    interpretation = 'Highly Concordant - Datasets have very similar activity patterns. They would sound harmonious when played together.';
  } else if (overallScore > 0.3) {
    interpretation = 'Moderately Concordant - Datasets share some similarities but have notable differences.';
  } else if (overallScore > -0.3) {
    interpretation = 'Neutral - Datasets are neither particularly similar nor dissimilar.';
  } else if (overallScore > -0.7) {
    interpretation = 'Moderately Discordant - Datasets have different activity patterns. Differences would be audible.';
  } else {
    interpretation = 'Highly Discordant - Datasets have very different activity patterns. They would sound quite different when played.';
  }

  return {
    overallScore,
    synchronization,
    harmonicSimilarity,
    activityPatternSimilarity,
    interpretation
  };
}

/**
 * Calculate what the difference operation reveals
 * Analyzes the subtracted dataset to understand differences
 */
export interface DifferenceAnalysis {
  averageDifference: number; // Average magnitude of differences
  maxDifference: number; // Maximum difference found
  differenceVariance: number; // How variable the differences are
  interpretation: string;
}

export function analyzeDifference(differenceDataset: CalciumDataset): DifferenceAnalysis {
  const allDifferences: number[] = [];

  // Collect all differences (we need to work with normalized 0-1 values)
  // Since the difference dataset is already normalized, we can analyze it directly
  differenceDataset.neurons.forEach(neuron => {
    neuron.trace.forEach(value => {
      // Values are normalized 0-1, but represent differences
      // Values near 0.5 = no difference, values near 0 or 1 = large differences
      const diff = Math.abs(value - 0.5) * 2; // Scale to 0-1 where 1 = max difference
      allDifferences.push(diff);
    });
  });

  if (allDifferences.length === 0) {
    return {
      averageDifference: 0,
      maxDifference: 0,
      differenceVariance: 0,
      interpretation: 'No differences detected (datasets are identical)'
    };
  }

  const avg = allDifferences.reduce((a, b) => a + b, 0) / allDifferences.length;
  const max = Math.max(...allDifferences);
  const variance = allDifferences.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / allDifferences.length;

  let interpretation: string;
  if (avg < 0.1) {
    interpretation = 'Minimal differences - Datasets are very similar. The subtraction reveals only minor variations.';
  } else if (avg < 0.3) {
    interpretation = 'Moderate differences - Some notable differences exist between datasets, particularly in timing or amplitude.';
  } else if (avg < 0.5) {
    interpretation = 'Significant differences - Datasets differ substantially in their activity patterns.';
  } else {
    interpretation = 'Major differences - Datasets have fundamentally different activity patterns. The difference reveals distinct neural behaviors.';
  }

  return {
    averageDifference: avg,
    maxDifference: max,
    differenceVariance: variance,
    interpretation
  };
}

