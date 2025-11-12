/**
 * K-means clustering implementation
 * Clusters neurons based on their PCA-reduced features
 */

import { seededRandom, seededRandomInt } from './seededRandom';

export interface Cluster {
  id: number;
  centroid: number[];
  neurons: number[]; // Indices of neurons in this cluster
}

/**
 * Compute Euclidean distance between two points
 */
function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

/**
 * Initialize centroids using k-means++ algorithm
 */
function initializeCentroids(data: number[][], k: number): number[][] {
  const centroids: number[][] = [];
  const n = data.length;
  
  // First centroid: random point (deterministic if seeded)
  centroids.push([...data[seededRandomInt(0, n)]]);
  
  // Subsequent centroids: choose points far from existing centroids
  for (let i = 1; i < k; i++) {
    const distances = data.map(point => {
      const minDist = Math.min(
        ...centroids.map(centroid => distance(point, centroid))
      );
      return minDist * minDist; // Square for probability weighting
    });
    
    // Choose point with probability proportional to distance squared (deterministic if seeded)
    const sum = distances.reduce((a, b) => a + b, 0);
    let rand = seededRandom() * sum;
    let idx = 0;
    for (let j = 0; j < distances.length; j++) {
      rand -= distances[j];
      if (rand <= 0) {
        idx = j;
        break;
      }
    }
    centroids.push([...data[idx]]);
  }
  
  return centroids;
}

/**
 * Assign each point to nearest centroid
 */
function assignClusters(data: number[][], centroids: number[][]): number[] {
  return data.map(point => {
    let minDist = Infinity;
    let cluster = 0;
    for (let i = 0; i < centroids.length; i++) {
      const dist = distance(point, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        cluster = i;
      }
    }
    return cluster;
  });
}

/**
 * Update centroids to be mean of assigned points
 */
function updateCentroids(
  data: number[][],
  assignments: number[],
  k: number
): number[][] {
  const clusters: number[][] = Array(k).fill(0).map(() => []);
  const counts = new Array(k).fill(0);
  
  // Sum points in each cluster
  for (let i = 0; i < data.length; i++) {
    const cluster = assignments[i];
    if (clusters[cluster].length === 0) {
      clusters[cluster] = new Array(data[i].length).fill(0);
    }
    for (let j = 0; j < data[i].length; j++) {
      clusters[cluster][j] += data[i][j];
    }
    counts[cluster]++;
  }
  
  // Compute means
  return clusters.map((cluster, i) => {
    if (counts[i] === 0) {
      // If cluster is empty, keep old centroid or use random point (deterministic if seeded)
      return data[seededRandomInt(0, data.length)];
    }
    return cluster.map(val => val / counts[i]);
  });
}

/**
 * Perform k-means clustering
 */
export function kMeans(
  data: number[][],
  k: number,
  maxIterations: number = 100,
  tolerance: number = 1e-6
): Cluster[] {
  if (data.length === 0) {
    return [];
  }
  
  if (k > data.length) {
    k = data.length;
  }
  
  // Initialize centroids
  let centroids = initializeCentroids(data, k);
  let assignments: number[] = [];
  let prevCentroids: number[][];
  
  // Iterate until convergence
  for (let iter = 0; iter < maxIterations; iter++) {
    prevCentroids = centroids.map(c => [...c]);
    
    // Assign points to clusters
    assignments = assignClusters(data, centroids);
    
    // Update centroids
    centroids = updateCentroids(data, assignments, k);
    
    // Check convergence
    let converged = true;
    for (let i = 0; i < centroids.length; i++) {
      if (distance(centroids[i], prevCentroids[i]) > tolerance) {
        converged = false;
        break;
      }
    }
    
    if (converged) {
      break;
    }
  }
  
  // Build cluster objects
  const clusters: Cluster[] = centroids.map((centroid, i) => ({
    id: i,
    centroid,
    neurons: []
  }));
  
  for (let i = 0; i < assignments.length; i++) {
    clusters[assignments[i]].neurons.push(i);
  }
  
  return clusters;
}

/**
 * Calculate silhouette score for a clustering
 * Higher score = better clustering (range: -1 to 1)
 */
function silhouetteScore(data: number[][], clusters: Cluster[]): number {
  if (clusters.length < 2 || data.length < 2) return 0;
  
  let totalScore = 0;
  let count = 0;
  
  for (let i = 0; i < data.length; i++) {
    // Find which cluster this point belongs to
    let ownCluster = -1;
    for (let c = 0; c < clusters.length; c++) {
      if (clusters[c].neurons.includes(i)) {
        ownCluster = c;
        break;
      }
    }
    
    if (ownCluster === -1) continue;
    
    // Calculate average distance to points in own cluster
    const ownClusterPoints = clusters[ownCluster].neurons.filter(idx => idx !== i);
    let avgDistOwn = 0;
    if (ownClusterPoints.length > 0) {
      avgDistOwn = ownClusterPoints.reduce((sum, idx) => sum + distance(data[i], data[idx]), 0) / ownClusterPoints.length;
    }
    
    // Calculate minimum average distance to other clusters
    let minAvgDistOther = Infinity;
    for (let c = 0; c < clusters.length; c++) {
      if (c === ownCluster || clusters[c].neurons.length === 0) continue;
      
      const avgDist = clusters[c].neurons.reduce((sum, idx) => sum + distance(data[i], data[idx]), 0) / clusters[c].neurons.length;
      if (avgDist < minAvgDistOther) {
        minAvgDistOther = avgDist;
      }
    }
    
    if (minAvgDistOther === Infinity) continue;
    
    // Silhouette score for this point
    const maxDist = Math.max(avgDistOwn, minAvgDistOther);
    const score = maxDist > 0 ? (minAvgDistOther - avgDistOwn) / maxDist : 0;
    totalScore += score;
    count++;
  }
  
  return count > 0 ? totalScore / count : 0;
}

/**
 * Determine optimal number of clusters using elbow method and silhouette score
 * Returns suggested k value and analysis data
 */
export function suggestOptimalK(
  data: number[][], 
  maxK: number = 10
): { optimalK: number; inertias: number[]; silhouetteScores: number[] } {
  if (data.length < 2) return { optimalK: 1, inertias: [], silhouetteScores: [] };
  if (data.length < 4) return { optimalK: Math.min(2, data.length), inertias: [], silhouetteScores: [] };
  
  maxK = Math.min(maxK, Math.floor(data.length / 2));
  
  const inertias: number[] = [];
  const silhouetteScores: number[] = [];
  
  // Calculate inertias and silhouette scores for different k values
  for (let k = 1; k <= maxK; k++) {
    const clusters = kMeans(data, k, 50);
    
    // Calculate inertia (within-cluster sum of squares)
    let inertia = 0;
    for (const cluster of clusters) {
      for (const neuronIdx of cluster.neurons) {
        inertia += Math.pow(distance(data[neuronIdx], cluster.centroid), 2);
      }
    }
    inertias.push(inertia);
    
    // Calculate silhouette score (only for k >= 2)
    if (k >= 2) {
      const score = silhouetteScore(data, clusters);
      silhouetteScores.push(score);
    } else {
      silhouetteScores.push(0);
    }
  }
  
  // Method 1: Elbow method - find largest percentage decrease
  let bestKElbow = 2;
  let maxPercentDecrease = 0;
  
  for (let k = 1; k < inertias.length; k++) {
    if (inertias[k - 1] > 0) {
      const percentDecrease = (inertias[k - 1] - inertias[k]) / inertias[k - 1];
      if (percentDecrease > maxPercentDecrease) {
        maxPercentDecrease = percentDecrease;
        bestKElbow = k + 1;
      }
    }
  }
  
  // Method 2: Silhouette score - find k with highest score
  let bestKSilhouette = 2;
  let maxSilhouette = -1;
  
  for (let k = 0; k < silhouetteScores.length; k++) {
    if (silhouetteScores[k] > maxSilhouette) {
      maxSilhouette = silhouetteScores[k];
      bestKSilhouette = k + 2; // k+2 because we start from k=2
    }
  }
  
  // Combine both methods: prefer silhouette if it's good (>0.3), otherwise use elbow
  const optimalK = maxSilhouette > 0.3 ? bestKSilhouette : bestKElbow;
  
  return {
    optimalK: Math.max(2, Math.min(optimalK, 8)), // Between 2 and 8 clusters
    inertias,
    silhouetteScores
  };
}

