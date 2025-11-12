/**
 * Seeded random number generator for deterministic results
 * Uses Linear Congruential Generator (LCG)
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = 12345) {
    this.seed = seed;
  }

  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    // LCG parameters (same as used in many standard libraries)
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed / Math.pow(2, 32);
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Generate random float between min (inclusive) and max (exclusive)
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Reset seed
   */
  setSeed(seed: number): void {
    this.seed = seed;
  }

  /**
   * Get current seed
   */
  getSeed(): number {
    return this.seed;
  }
}

// Global seeded random instance - initialized with dataset hash for determinism
let globalSeededRandom: SeededRandom | null = null;

/**
 * Initialize seeded random with a seed based on dataset
 * This ensures same dataset always produces same results
 */
export function initSeededRandom(seed: number): void {
  globalSeededRandom = new SeededRandom(seed);
}

/**
 * Get seeded random number (0 to 1)
 * Falls back to Math.random() if not initialized
 */
export function seededRandom(): number {
  if (globalSeededRandom) {
    return globalSeededRandom.next();
  }
  return Math.random();
}

/**
 * Get seeded random integer
 */
export function seededRandomInt(min: number, max: number): number {
  if (globalSeededRandom) {
    return globalSeededRandom.nextInt(min, max);
  }
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Get seeded random float
 */
export function seededRandomFloat(min: number, max: number): number {
  if (globalSeededRandom) {
    return globalSeededRandom.nextFloat(min, max);
  }
  return Math.random() * (max - min) + min;
}

/**
 * Generate a simple hash from dataset for deterministic seeding
 */
export function hashDataset(datasetName: string, neuronCount: number, frameCount: number): number {
  let hash = 0;
  const str = `${datasetName}_${neuronCount}_${frameCount}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

