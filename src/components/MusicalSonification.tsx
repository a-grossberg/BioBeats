import { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, Info, Music } from 'lucide-react';
import * as Tone from 'tone';
import { CalciumDataset } from '../types';
import { extractTraceFeatures, performPCA } from '../utils/pca';
import { kMeans, suggestOptimalK, Cluster } from '../utils/clustering';
import { initSeededRandom, hashDataset } from '../utils/seededRandom';
import BrainVisualization from './BrainVisualization';
import ActivityPatternVisualization from './ActivityPatternVisualization';

interface MusicalSonificationProps {
  dataset: CalciumDataset;
  shouldPause?: number;
}

// Musical scales and chords
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]; // C major scale intervals
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]; // A minor scale intervals
const PENTATONIC = [0, 2, 4, 7, 9]; // Pentatonic scale intervals

// Common chord progressions (as scale degrees)
const CHORD_PROGRESSIONS = {
  // I - V - vi - IV (very common, sounds good)
  pop: [[0, 2, 4], [4, 6, 1], [5, 7, 9], [3, 5, 7]],
  // I - vi - IV - V
  classic: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 1]],
  // vi - IV - I - V
  emotional: [[5, 7, 9], [3, 5, 7], [0, 2, 4], [4, 6, 1]],
  // I - IV - vi - V
  uplifting: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [4, 6, 1]]
};

// Base frequency for C4
export const C4 = 261.63;

// Export scale for use in other components
export { MAJOR_SCALE };

// 8 Distinct Colors for 8 Clusters (FLUORO-POP palette)
const CLUSTER_COLORS = [
  '#FF1900', // Red
  '#FF8800', // Orange
  '#FFF400', // Yellow
  '#00FF2E', // Green
  '#057DFF', // Blue
  '#00FFE1', // Aqua
  '#9800FF', // Purple
  '#FF008C'  // Pink
];

export function getClusterColor(clusterIdx: number): string {
  return CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length];
}

/**
 * Get note frequency from scale degree
 */
export function getNoteFrequency(scaleDegree: number, octave: number = 4, scale: number[] = MAJOR_SCALE): number {
  const noteInScale = scaleDegree % scale.length;
  const semitones = scale[noteInScale] + (Math.floor(scaleDegree / scale.length) + octave - 4) * 12;
  return C4 * Math.pow(2, semitones / 12);
}

/**
 * Get chord notes from scale degrees
 */
function getChordNotes(chordDegrees: number[], rootOctave: number = 4, scale: number[] = MAJOR_SCALE): number[] {
  return chordDegrees.map(degree => getNoteFrequency(degree, rootOctave, scale));
}

/**
 * Create different instrument sounds using Tone.js with effects
 * Returns synth that should be connected to gain node
 */
export function createInstrument(type: 'piano' | 'bass' | 'strings' | 'flute' | 'guitar' | 'bell' | 'drum' | 'trumpet'): Tone.PolySynth | Tone.Synth {
  let synth: Tone.PolySynth | Tone.Synth;
  
  switch (type) {
    case 'piano':
      // Piano-like: bright attack with quick decay
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.005,
          decay: 0.2,
          sustain: 0.1,
          release: 0.4
        }
      });
      break;
    
    case 'bass':
      // Bass: low, warm, sustained
      synth = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: {
          attack: 0.01,
          decay: 0.2,
          sustain: 0.6,
          release: 0.4
        },
        // filter: {
        //   type: 'lowpass',
        //   frequency: 300,
        //   Q: 1
        // }
      });
      break;
    
    case 'strings':
      // Strings: smooth, sustained, warm
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.3,
          decay: 0.2,
          sustain: 0.8,
          release: 1.2
        }
      });
      break;
    
    case 'flute':
      // Flute: breathy, melodic, quick attack
      synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.1,
          decay: 0.2,
          sustain: 0.6,
          release: 0.5
        },
        // filter: {
        //   type: 'lowpass',
        //   frequency: 2000,
        //   Q: 1
        // }
      });
      break;
    
    case 'guitar':
      // Guitar: plucky, percussive
      synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.001,
          decay: 0.2,
          sustain: 0.1,
          release: 0.4
        },
        // filter: {
        //   type: 'lowpass',
        //   frequency: 2000,
        //   Q: 2
        // }
      });
      break;
    
    case 'bell':
      // Bell: bright, metallic, long decay
      synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.2,
          release: 1.2
        }
      });
      break;
    
    case 'drum':
      // Drum: percussive, short, punchy
      synth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0,
          release: 0.2
        },
        // filter: {
        //   type: 'lowpass',
        //   frequency: 500,
        //   Q: 3
        // }
      });
      break;
    
    case 'trumpet':
      // Trumpet: bright, brassy, quick attack
      synth = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: {
          attack: 0.01,
          decay: 0.1,
          sustain: 0.7,
          release: 0.3
        },
        // filter: {
        //   type: 'bandpass',
        //   frequency: 1000,
        //   Q: 2
        // }
      });
      break;
    
    default:
      synth = new Tone.Synth();
  }
  
  return synth;
}

// All available instrument types
export type InstrumentType = 'piano' | 'bass' | 'strings' | 'flute' | 'guitar' | 'bell' | 'drum' | 'trumpet';

/**
 * Calculate oscillation frequency from trace using autocorrelation
 * Returns dominant frequency in Hz (scaled to dataset fps)
 */
export function calculateOscillationFrequency(trace: number[], fps: number): number {
  if (trace.length < 10) return 0;
  
  // Simple autocorrelation to find period
  const maxLag = Math.min(trace.length / 2, 50);
  let maxCorrelation = 0;
  let bestPeriod = 1;
  
  for (let lag = 2; lag < maxLag; lag++) {
    let correlation = 0;
    for (let i = 0; i < trace.length - lag; i++) {
      correlation += trace[i] * trace[i + lag];
    }
    correlation /= (trace.length - lag);
    
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestPeriod = lag;
    }
  }
  
  // Convert period to frequency (frames to Hz)
  return bestPeriod > 0 ? fps / bestPeriod : 0;
}

/**
 * Calculate synchronization between neurons in cluster
 * Returns 0-1, where 1 = perfectly synchronized
 */
export function calculateSynchronization(cluster: Cluster, dataset: CalciumDataset): number {
  if (cluster.neurons.length < 2) return 0;
  
  let totalSync = 0;
  let pairs = 0;
  
  for (let i = 0; i < cluster.neurons.length; i++) {
    for (let j = i + 1; j < cluster.neurons.length; j++) {
      const neuron1 = dataset.neurons[cluster.neurons[i]];
      const neuron2 = dataset.neurons[cluster.neurons[j]];
      if (!neuron1 || !neuron1.trace || !neuron2 || !neuron2.trace) continue;
      
      const trace1 = neuron1.trace;
      const trace2 = neuron2.trace;
      const minLen = Math.min(trace1.length, trace2.length);
      
      // Calculate cross-correlation
      let correlation = 0;
      const mean1 = trace1.slice(0, minLen).reduce((a, b) => a + b, 0) / minLen;
      const mean2 = trace2.slice(0, minLen).reduce((a, b) => a + b, 0) / minLen;
      
      for (let f = 0; f < minLen; f++) {
        correlation += (trace1[f] - mean1) * (trace2[f] - mean2);
      }
      
      // Normalize to 0-1 range
      totalSync += (correlation / minLen + 1) / 2;
      pairs++;
    }
  }
  
  return pairs > 0 ? totalSync / pairs : 0;
}

/**
 * Assign instrument to cluster based on music theory, biology, and CS principles
 * 
 * Music Theory: Frequency range, harmonic role, timbre
 * Biology: Oscillation frequency, synchronization, spike patterns
 * CS: PCA dimensions, statistical properties
 */
export function assignInstrumentToCluster(
  cluster: Cluster,
  clusterIdx: number,
  dataset: CalciumDataset,
  pcaResult: ReturnType<typeof performPCA> | null
): InstrumentType {
  if (!pcaResult || cluster.neurons.length === 0) {
    const fallback: InstrumentType[] = ['piano', 'bass', 'strings', 'flute', 'guitar', 'bell', 'drum', 'trumpet'];
    return fallback[clusterIdx % fallback.length];
  }

  // === BIOLOGY: Analyze neural activity patterns ===
  let totalActivity = 0;
  let spikeCount = 0;
  let oscillationFrequencies: number[] = [];
  let variances: number[] = [];
  
  cluster.neurons.forEach(neuronIdx => {
    const neuron = dataset.neurons[neuronIdx];
    if (neuron.trace) {
      const mean = neuron.trace.reduce((a, b) => a + b, 0) / neuron.trace.length;
      const variance = neuron.trace.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / neuron.trace.length;
      const std = Math.sqrt(variance);
      
      totalActivity += mean;
      variances.push(variance);
      
      // Calculate oscillation frequency (biology: neural oscillation rate)
      const freq = calculateOscillationFrequency(neuron.trace, dataset.fps);
      if (freq > 0) oscillationFrequencies.push(freq);
      
      // Count spikes (biology: action potential firing)
      for (let i = 1; i < neuron.trace.length; i++) {
        if (neuron.trace[i] - neuron.trace[i - 1] > std * 2) {
          spikeCount++;
        }
      }
    }
  });
  
  const avgActivity = totalActivity / cluster.neurons.length;
  const spikeRate = spikeCount / (cluster.neurons.length * dataset.frames);
  const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
  const coefficientOfVariation = avgActivity > 0 ? Math.sqrt(avgVariance) / avgActivity : 0;
  
  // Average oscillation frequency (biology → music theory: maps to pitch range)
  const avgOscFreq = oscillationFrequencies.length > 0
    ? oscillationFrequencies.reduce((a, b) => a + b, 0) / oscillationFrequencies.length
    : 0;
  
  // === CS: PCA dimensions represent data structure ===
  const sampleNeuronIdx = cluster.neurons[0];
  const pcaCoords = pcaResult.transformed[sampleNeuronIdx] || [0, 0, 0];
  const pca0 = pcaCoords[0]; // Primary dimension (likely oscillation mode)
  const pca1 = pcaCoords[1]; // Secondary dimension (likely phase/timing)
  const pca2 = pcaCoords[2]; // Tertiary dimension (likely amplitude pattern)
  
  // === BIOLOGY: Calculate synchronization (how neurons fire together) ===
  const synchronization = calculateSynchronization(cluster, dataset);
  
  // === MUSIC THEORY: Map biological properties to musical characteristics ===
  
  // Use data-adaptive thresholds based on cluster properties relative to dataset
  // This prevents hard-coded thresholds that might not fit all datasets
  
  // Calculate dataset-wide statistics for relative comparisons
  const allOscFreqs: number[] = [];
  const allSpikeRates: number[] = [];
  const allSyncs: number[] = [];
  
  // Sample neurons from dataset to estimate population statistics
  const sampleSize = Math.min(100, dataset.neurons.length);
  for (let i = 0; i < sampleSize; i++) {
    const neuron = dataset.neurons[Math.floor((i / sampleSize) * dataset.neurons.length)];
    if (neuron.trace) {
      const freq = calculateOscillationFrequency(neuron.trace, dataset.fps);
      if (freq > 0) allOscFreqs.push(freq);
      
      const mean = neuron.trace.reduce((a, b) => a + b, 0) / neuron.trace.length;
      const std = Math.sqrt(neuron.trace.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / neuron.trace.length);
      let spikes = 0;
      for (let j = 1; j < neuron.trace.length; j++) {
        if (neuron.trace[j] - neuron.trace[j - 1] > std * 2) spikes++;
      }
      allSpikeRates.push(spikes / dataset.frames);
    }
  }
  
  const medianOscFreq = allOscFreqs.length > 0 
    ? [...allOscFreqs].sort((a, b) => a - b)[Math.floor(allOscFreqs.length / 2)]
    : 1.0;
  const medianSpikeRate = allSpikeRates.length > 0
    ? [...allSpikeRates].sort((a, b) => a - b)[Math.floor(allSpikeRates.length / 2)]
    : 0.05;
  
  // 1. FREQUENCY RANGE (Music Theory: Bass/Mid/High)
  // Use oscillation frequency (biology) mapped to musical frequency range
  // Low oscillation = bass range, high oscillation = treble range
  // Use data-adaptive thresholds based on median
  const isLowFreq = avgOscFreq < medianOscFreq * 0.7 || pca0 < -0.2;
  const isHighFreq = avgOscFreq > medianOscFreq * 1.5 || pca0 > 0.3;
  const isMidFreq = !isLowFreq && !isHighFreq;
  
  // 2. TIMBRE (Music Theory: Sustained vs Percussive)
  // Biology: Spike rate determines attack characteristics
  // Low spike rate = sustained (strings, flute), high = percussive (drum, guitar)
  // Use data-adaptive thresholds
  const isSustained = spikeRate < medianSpikeRate * 0.8;
  const isPercussive = spikeRate > medianSpikeRate * 1.5;
  const isModerate = spikeRate >= medianSpikeRate * 0.8 && spikeRate <= medianSpikeRate * 1.5;
  
  // 3. DYNAMICS (Music Theory: Variable vs Stable)
  // Biology: Coefficient of variation measures activity stability
  // Use relative threshold - 0.4 is reasonable for normalized variability
  const isVariable = coefficientOfVariation > 0.4;
  const isStable = coefficientOfVariation < 0.4;
  
  // 4. HARMONIC ROLE (Music Theory: Foundation/Harmony/Melody/Rhythm)
  // Biology: Synchronization determines if neurons work together (harmony) or independently (melody)
  // This is a meaningful biological property: synchronized firing = functional connectivity
  const isHarmonic = synchronization > 0.5; // Neurons fire together = harmony
  const isMelodic = synchronization < 0.4; // Neurons fire independently = melody
  const isRhythmic = spikeRate > medianSpikeRate * 1.5 && isPercussive; // Regular spikes = rhythm
  
  // === INSTRUMENT ASSIGNMENT (Combining all three perspectives) ===
  // Use priority-based assignment with more lenient conditions
  
  // DRUM: Rhythmic (high spike rate, percussive) + Low synchronization (independent beats)
  // Biology: Fast, independent firing = rhythmic pattern
  if (isPercussive && spikeRate > medianSpikeRate * 1.5 && synchronization < 0.5) {
    return 'drum';
  }
  
  // BASS: Low frequency (foundation) + Stable (consistent)
  // Biology: Low oscillation frequency + stable activity = foundational role
  if (isLowFreq && (isStable || avgActivity > 0.25)) {
    return 'bass';
  }
  
  // TRUMPET: High frequency + Variable dynamics + Higher activity
  // Biology: High oscillation + variable activity = prominent, dynamic signal
  if (isHighFreq && isVariable && avgActivity > 0.25) {
    return 'trumpet';
  }
  
  // FLUTE: High frequency + Sustained + Lower activity
  // Biology: High oscillation + sustained, gentle activity = melodic, sustained tone
  if (isHighFreq && isSustained && avgActivity < 0.5) {
    return 'flute';
  }
  
  // STRINGS: Mid frequency + Sustained + Harmonic
  // Biology: Synchronized, sustained firing = harmonic, ensemble-like behavior
  if (isMidFreq && isSustained && (isHarmonic || avgActivity > 0.15)) {
    return 'strings';
  }
  
  // BELL: Distinctive PCA[1] (unique pattern) + Lower activity
  // Biology: Unique temporal pattern = distinctive, bell-like characteristic
  if (Math.abs(pca1) > 0.5 && avgActivity < 0.5) {
    return 'bell';
  }
  
  // GUITAR: Moderate spike rate (plucky) + Mid frequency
  // Biology: Moderate, rhythmic spikes = plucky, guitar-like attack
  if (isModerate && isMidFreq && spikeRate > medianSpikeRate * 0.5) {
    return 'guitar';
  }
  
  // More fallback options based on single strong characteristics
  if (isHighFreq) {
    return isVariable ? 'trumpet' : 'flute';
  }
  
  if (isLowFreq) {
    return 'bass';
  }
  
  if (isPercussive && spikeRate > medianSpikeRate) {
    return 'guitar';
  }
  
  if (isSustained && isHarmonic) {
    return 'strings';
  }
  
  // PIANO: Versatile fallback - works for most patterns
  // Biology: General-purpose, adaptable neuron activity
  return 'piano';
}

const MusicalSonification = ({ dataset, shouldPause = 0 }: MusicalSonificationProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [volume, setVolume] = useState(0.7);
  const [showInfo, setShowInfo] = useState(false);
  const [numClusters, setNumClusters] = useState(4);
  
  const instrumentsRef = useRef<Map<number, Tone.PolySynth | Tone.Synth>>(new Map());
  const clustersRef = useRef<Cluster[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const gainNodeRef = useRef<Tone.Gain | null>(null);
  const limiterRef = useRef<Tone.Limiter | null>(null);
  const compressorRef = useRef<Tone.Compressor | null>(null);
  const isPlayingRef = useRef(false);
  const currentFrameRef = useRef(0);
  const loopRunningRef = useRef(false);
  const clusterActivityRef = useRef<Map<number, number>>(new Map()); // Track cluster activity levels
  const prevClusterActivityRef = useRef<Map<number, number>>(new Map()); // Track previous frame activity
  const lastPlayTimeRef = useRef<Map<number, number>>(new Map()); // Track when each cluster last played
  const pcaResultRef = useRef<ReturnType<typeof performPCA> | null>(null);
  const tempoRef = useRef(tempo);

  // Perform PCA and clustering
  const { clusters, pcaResult, suggestedK, clusterAnalysis } = useMemo(() => {
    if (dataset.neurons.length === 0) {
      return { clusters: [], pcaResult: null, suggestedK: 4, clusterAnalysis: null };
    }

    // Initialize seeded random for deterministic results
    const seed = hashDataset(
      dataset.datasetName || 'dataset',
      dataset.neurons.length,
      dataset.frames
    );
    initSeededRandom(seed);

    // Extract features from traces AND spatial coordinates
    const traces = dataset.neurons.map(n => n.trace);
    const features = extractTraceFeatures(traces, dataset.neurons, dataset.imageWidth, dataset.imageHeight);
    
    // Perform PCA (reduce to 3 dimensions)
    const pca = performPCA(features, 3);
    
    // Determine optimal number of clusters
    const analysis = suggestOptimalK(pca.transformed, 8);
    const suggestedK = Math.max(2, Math.min(analysis.optimalK, 6));
    
    // Perform clustering
    const clusterResult = kMeans(pca.transformed, numClusters || suggestedK, 100);
    
    return {
      clusters: clusterResult,
      pcaResult: pca,
      suggestedK,
      clusterAnalysis: analysis
    };
  }, [dataset, numClusters]);

  // Store clusters and PCA result in refs
  useEffect(() => {
    clustersRef.current = clusters;
    pcaResultRef.current = pcaResult;
  }, [clusters, pcaResult]);

  // Initialize instruments for each cluster
  useEffect(() => {
    if (clusters.length === 0) return;

    // Clean up old instruments
    instrumentsRef.current.forEach(instrument => {
      try {
        instrument.dispose();
      } catch (e) {
        // Ignore
      }
    });
    instrumentsRef.current.clear();

    // Create gain node with volume scaling based on cluster count
    // More clusters = lower volume per cluster to prevent overwhelming sound
    // Use more aggressive scaling for 5+ clusters
    const clusterVolumeScale = clusters.length > 4 
      ? Math.max(0.2, 0.5 / clusters.length)  // More aggressive for 5+ clusters
      : Math.max(0.4, 1.0 / Math.sqrt(clusters.length));  // Less aggressive for 4 or fewer
    const scaledVolume = volume * clusterVolumeScale;
    
    if (gainNodeRef.current) {
      gainNodeRef.current.dispose();
    }
    if (limiterRef.current) {
      limiterRef.current.dispose();
    }
    if (compressorRef.current) {
      compressorRef.current.dispose();
    }
    
    // Add compressor to smooth dynamics and reduce harsh peaks
    compressorRef.current = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.1
    });
    
    // Add a limiter to prevent clipping and harsh sounds (more aggressive threshold)
    limiterRef.current = new Tone.Limiter(-12).toDestination();
    
    // Chain: gain -> compressor -> limiter -> destination
    gainNodeRef.current = new Tone.Gain(scaledVolume);
    gainNodeRef.current.connect(compressorRef.current);
    compressorRef.current.connect(limiterRef.current);

    // Create instrument for each cluster with effects
    clusters.forEach((cluster, idx) => {
      const instrumentType = assignInstrumentToCluster(cluster, idx, dataset, pcaResult);
      const instrument = createInstrument(instrumentType);
      
      // Add reverb and delay effects based on instrument type
      let reverb: Tone.Reverb;
      let delay: Tone.FeedbackDelay | null = null;
      
      switch (instrumentType) {
        case 'strings':
          reverb = new Tone.Reverb(0.8);
          reverb.wet.value = 0.4;
          delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0.2 });
          break;
        case 'flute':
          reverb = new Tone.Reverb(0.5);
          reverb.wet.value = 0.3;
          delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.15 });
          break;
        case 'piano':
          reverb = new Tone.Reverb(0.4);
          reverb.wet.value = 0.25;
          break;
        case 'bass':
          reverb = new Tone.Reverb(0.2);
          reverb.wet.value = 0.1;
          break;
        case 'guitar':
          reverb = new Tone.Reverb(0.5);
          reverb.wet.value = 0.3;
          break;
        case 'bell':
          reverb = new Tone.Reverb(0.7);
          reverb.wet.value = 0.4;
          break;
        case 'drum':
          reverb = new Tone.Reverb(0.3);
          reverb.wet.value = 0.15;
          break;
        case 'trumpet':
          reverb = new Tone.Reverb(0.4);
          reverb.wet.value = 0.25;
          delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.15, wet: 0.1 });
          break;
        default:
          reverb = new Tone.Reverb(0.3);
          reverb.wet.value = 0.2;
      }
      
      // Connect: instrument -> delay (if exists) -> reverb -> gain -> destination
      if (delay) {
        instrument.connect(delay);
        delay.connect(reverb);
      } else {
        instrument.connect(reverb);
      }
      reverb.connect(gainNodeRef.current!);
      
      instrumentsRef.current.set(cluster.id, instrument);
    });

    return () => {
      instrumentsRef.current.forEach(instrument => {
        try {
          instrument.dispose();
        } catch (e) {
          // Ignore
        }
      });
      instrumentsRef.current.clear();
      if (gainNodeRef.current) {
        gainNodeRef.current.dispose();
      }
      if (limiterRef.current) {
        limiterRef.current.dispose();
      }
      if (compressorRef.current) {
        compressorRef.current.dispose();
      }
    };
  }, [clusters, volume]);

  // Update master volume with cluster-based scaling
  useEffect(() => {
    if (gainNodeRef.current && clusters.length > 0) {
      const clusterVolumeScale = clusters.length > 4 
        ? Math.max(0.2, 0.5 / clusters.length)  // More aggressive for 5+ clusters
        : Math.max(0.4, 1.0 / Math.sqrt(clusters.length));  // Less aggressive for 4 or fewer
      gainNodeRef.current.gain.value = volume * clusterVolumeScale;
    }
  }, [volume, clusters.length]);

  // Update tempo ref when tempo changes
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  // Pause when shouldPause prop changes (triggered by mode switch or window blur)
  useEffect(() => {
    if (shouldPause > 0 && isPlaying) {
      setIsPlaying(false);
    }
  }, [shouldPause]);

  // Playback loop
  useEffect(() => {
    const previousPlaying = isPlayingRef.current;
    
    if (isPlaying && !previousPlaying && clusters.length > 0) {
      isPlayingRef.current = true;
      currentFrameRef.current = currentFrame;
      
      const playFrame = () => {
        // Use current tempo from ref (always up-to-date)
        const currentTempo = tempoRef.current;
      // Use frame interval based on dataset fps, scaled by tempo
      // This preserves the actual temporal relationships in the data
        const baseFrameInterval = (1000 / dataset.fps) * (120 / currentTempo); // Scale by tempo
      const minInterval = 20; // Minimum 20ms for responsiveness
      const actualInterval = Math.max(minInterval, baseFrameInterval);
        if (!isPlayingRef.current || clustersRef.current.length === 0) {
          loopRunningRef.current = false;
          return;
        }

        const nextFrame = (currentFrameRef.current + 1) % dataset.frames;
        currentFrameRef.current = nextFrame;

        // Update UI every 5 frames
        if (nextFrame % 5 === 0 || nextFrame < 20) {
          setCurrentFrame(nextFrame);
        }

        const now = Tone.now();
        const currentTime = Tone.now();

        // Process each cluster organically based on its actual activity
        clustersRef.current.forEach((cluster, clusterIdx) => {
          const instrument = instrumentsRef.current.get(cluster.id);
          if (!instrument) return;

          // Get individual neuron activities for this frame
          const neuronActivities = cluster.neurons
            .map(neuronIdx => {
              const neuron = dataset.neurons[neuronIdx];
              if (!neuron || !neuron.trace || nextFrame >= neuron.trace.length) return null;
              
              const intensity = neuron.trace[nextFrame];
              const prevIntensity = nextFrame > 0 && neuron.trace[nextFrame - 1] 
                ? neuron.trace[nextFrame - 1] 
                : 0;
              
              return {
                idx: neuronIdx,
                intensity,
                prevIntensity,
                change: intensity - prevIntensity
              };
            })
            .filter(n => n !== null) as Array<{
              idx: number;
              intensity: number;
              prevIntensity: number;
              change: number;
            }>;

          if (neuronActivities.length === 0) return;

          // Calculate cluster-level metrics from actual data
          const avgIntensity = neuronActivities.reduce((sum, n) => sum + n.intensity, 0) / neuronActivities.length;
          const maxIntensity = Math.max(...neuronActivities.map(n => n.intensity));
          const activeCount = neuronActivities.filter(n => n.intensity > 0.1).length;
          const activityRatio = activeCount / neuronActivities.length;
          
          // Use PCA centroid to determine pitch range (lower values = lower pitches)
          // This maps the actual cluster characteristics to musical space
          const pcaData = pcaResultRef.current;
          const pcaCentroid = pcaData?.transformed[cluster.neurons[0]] || [0, 0, 0];
          const pitchOffset = Math.floor((pcaCentroid[0] + 2) * 2) % 12; // Map to 0-11 (chromatic)
          
          // Determine base octave from cluster size and activity pattern
          // Larger clusters or more active clusters get different octaves
          const baseOctave = 3 + Math.floor(clusterIdx / 2) + (activityRatio > 0.5 ? 1 : 0);
          
          // Update cluster activity for visualization
          const clusterActivity = avgIntensity * activityRatio;
          clusterActivityRef.current.set(cluster.id, clusterActivity);
          const prevActivity = prevClusterActivityRef.current.get(cluster.id) || 0;
          prevClusterActivityRef.current.set(cluster.id, clusterActivity);

          // Play notes based on actual activity patterns
          // Trigger on intensity increases (spikes) or sustained high activity
          const threshold = 0.05;
          const spikeThreshold = 0.1; // Minimum change to trigger
          
          // Check for spikes (sudden increases)
          const spikes = neuronActivities.filter(n => 
            n.change > spikeThreshold && n.intensity > threshold
          );
          
          // Check for sustained activity
          const sustained = neuronActivities.filter(n => 
            n.intensity > threshold && n.intensity > n.prevIntensity * 0.9 // Not decreasing much
          );

          // Determine which neurons should play based on their actual activity
          const neuronsToPlay = spikes.length > 0 ? spikes : sustained;
          
          if (neuronsToPlay.length === 0) return;

          try {
            // Map each active neuron to a note based on its intensity and position
            // This creates a direct mapping from data to music
            // Limit simultaneous notes per cluster based on total cluster count
            // More clusters = fewer notes per cluster to prevent overwhelming sound
            const maxNotesPerCluster = clusters.length > 4 ? 2 : clusters.length > 6 ? 1 : 5;
            const notesToPlay = neuronsToPlay
              .slice(0, Math.min(maxNotesPerCluster, neuronsToPlay.length))
              .map((neuron, noteIdx) => {
                // Map intensity (0-1) to scale degree (0-6)
                const scaleDegree = Math.floor(neuron.intensity * 7) % 7;
                // Add pitch offset from PCA to create cluster-specific character
                const finalDegree = (scaleDegree + pitchOffset) % 7;
                
                // Map intensity to octave (higher intensity = higher octave, but within range)
                const octave = baseOctave + Math.floor(neuron.intensity * 2);
                
                // Get frequency from scale
                const frequency = getNoteFrequency(finalDegree, octave, MAJOR_SCALE);
                
                // Volume directly from intensity, but scaled down based on cluster count
                // More clusters = lower volume per note to prevent overwhelming sound
                const baseVolume = neuron.intensity * 0.6; // Reduced from 0.8
                const clusterScale = clusters.length > 4
                  ? Math.max(0.3, 0.4 / clusters.length)  // More aggressive for 5+ clusters
                  : Math.max(0.5, 1.0 / Math.sqrt(clusters.length));  // Less aggressive for 4 or fewer
                const scaledBaseVolume = baseVolume * clusterScale;
                const volume = Tone.gainToDb(Math.max(0.05, Math.min(0.8, scaledBaseVolume))); // Cap at 0.8 instead of 1.0
                
                // Duration based on intensity (stronger signals last longer)
                const duration = neuron.intensity > 0.5 ? '8n' : '16n';
                
                return {
                  frequency,
                  volume,
                  duration,
                  intensity: neuron.intensity
                };
              })
              .sort((a, b) => a.frequency - b.frequency); // Sort by pitch for harmony

            // Play notes with slight stagger to avoid clicks
            notesToPlay.forEach((note, noteIdx) => {
              const lastPlay = lastPlayTimeRef.current.get(cluster.id) || 0;
              const timeSinceLastPlay = currentTime - lastPlay;
              
              // Only play if enough time has passed (prevents overwhelming)
              // But allow simultaneous notes from same cluster if they're close in time
              if (timeSinceLastPlay >= 0.05 || noteIdx === 0) {
                if (noteIdx === 0) {
                  lastPlayTimeRef.current.set(cluster.id, currentTime);
                }
                
                try {
                  if (instrument instanceof Tone.PolySynth) {
                    instrument.triggerAttackRelease(
                      Tone.Frequency(note.frequency).toNote(),
                      note.duration,
                      now + noteIdx * 0.01, // Slight stagger
                      note.volume
                    );
                  } else {
                    instrument.volume.value = note.volume;
                    instrument.triggerAttackRelease(
                      note.frequency,
                      note.duration,
                      now + noteIdx * 0.01
                    );
                  }
                } catch (error) {
                  // Silently handle timing errors
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  if (!errorMessage.includes('Start time must be strictly greater')) {
                    // Ignore
                  }
                }
              }
            });
          } catch (error) {
            // Silently handle errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.includes('Start time must be strictly greater')) {
              console.warn(`Error playing cluster ${cluster.id}:`, error);
            }
          }
        });

        // Schedule next frame based on actual data timing
        if (isPlayingRef.current) {
          // Recalculate interval with current tempo for next frame
          const nextTempo = tempoRef.current;
          const nextBaseInterval = (1000 / dataset.fps) * (120 / nextTempo);
          const nextMinInterval = 20;
          const nextActualInterval = Math.max(nextMinInterval, nextBaseInterval);
          
          timeoutRef.current = window.setTimeout(() => {
            if (isPlayingRef.current) {
              playFrame();
            } else {
              loopRunningRef.current = false;
            }
          }, nextActualInterval);
        } else {
          loopRunningRef.current = false;
        }
      };

      if (!loopRunningRef.current) {
        loopRunningRef.current = true;
        playFrame();
      }

      return () => {
        if (!isPlaying) {
          isPlayingRef.current = false;
          loopRunningRef.current = false;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          clusterActivityRef.current.clear();
          prevClusterActivityRef.current.clear();
          lastPlayTimeRef.current.clear();
          // Stop all instruments
          instrumentsRef.current.forEach(instrument => {
            try {
              if (instrument instanceof Tone.PolySynth) {
                instrument.releaseAll();
              } else {
                instrument.triggerRelease();
              }
            } catch (e) {
              // Ignore
            }
          });
        }
      };
    } else if (!isPlaying && previousPlaying) {
      isPlayingRef.current = false;
      loopRunningRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      clusterActivityRef.current.clear();
      prevClusterActivityRef.current.clear();
      lastPlayTimeRef.current.clear();
      instrumentsRef.current.forEach(instrument => {
        try {
          if (instrument instanceof Tone.PolySynth) {
            instrument.releaseAll();
          } else {
            instrument.triggerRelease();
          }
        } catch (e) {
          // Ignore
        }
      });
    }
  }, [isPlaying, clusters, dataset, tempo, currentFrame]);

  const togglePlayback = async () => {
    if (!isPlaying) {
      try {
        const context = Tone.getContext();
        if (context.state === 'suspended') {
          await context.resume();
        } else if (context.state !== 'running') {
          await Tone.start();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Failed to start audio:', error);
        alert(`Failed to start audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }
    }
    setIsPlaying(prev => !prev);
  };

  const avgActivity = dataset.neurons.reduce(
    (sum, n) => sum + (n.trace[currentFrame] || 0), 0
  ) / dataset.neurons.length;

  return (
    <div className="space-y-6 relative">
      {/* Info Icon Button */}
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="absolute top-4 right-4 z-50 text-amber-200 hover:text-amber-300 transition-colors"
        aria-label="Show information"
        title="How It Works"
      >
        <Info className="w-5 h-5" />
      </button>

      {/* Info Panel Popup */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-amber-900/95 backdrop-blur-sm border rounded-lg p-6 max-w-2xl mx-4 shadow-2xl" style={{
            background: 'linear-gradient(135deg, rgba(92, 46, 12, 0.95) 0%, rgba(69, 45, 22, 0.95) 50%, rgba(58, 37, 18, 0.95) 100%)',
            borderColor: 'rgba(234, 179, 8, 0.3)'
          }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2 flex items-center gap-2 text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>
                <Music className="w-5 h-5 text-amber-300" />
                MUSICAL SONIFICATION WITH PCA CLUSTERING
              </h3>
                <ul className="space-y-2 text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <li>• Neurons are clustered using PCA analysis of their activity patterns</li>
                <li>• Instruments assigned using music theory, biology, and computer science:</li>
                <li className="ml-4">- Frequency: Oscillation rate → Bass (low) / Mid / Flute/Trumpet (high)</li>
                <li className="ml-4">- Timbre: Spike patterns → Sustained (strings/flute) vs Percussive (drum/guitar)</li>
                <li className="ml-4">- Role: Synchronization → Harmony (strings) vs Melody (flute/trumpet) vs Rhythm (drum)</li>
                <li className="ml-4">- Dynamics: Activity variability → Stable (bass) vs Variable (trumpet)</li>
                <li>• Music emerges directly from neural activity patterns</li>
                <li>• Pitch mapped from intensity values and PCA cluster characteristics</li>
                <li>• Timing preserves actual temporal relationships in the data</li>
                <li>• Volume and duration directly reflect neuron activity levels</li>
                <li>• Spikes trigger notes, sustained activity creates harmonies</li>
                  <li>• Uses major scale with cluster-specific pitch offsets for musical coherence</li>
                <li>• Clusters: {clusters.length}</li>
                  {dataset.datasetName && (
                    <li>• Dataset: {dataset.datasetName}</li>
                  )}
              </ul>
            </div>
            <button 
              onClick={() => setShowInfo(false)}
              className="text-amber-300 hover:text-amber-200 ml-4 transition-colors"
            >
              ✕
            </button>
          </div>
          </div>
          {/* Backdrop to close on click */}
          <div 
            className="absolute inset-0 bg-black/50 -z-10"
            onClick={() => setShowInfo(false)}
          />
        </div>
      )}

      {/* Controls */}
      <div className="bg-amber-900/20 border rounded-lg p-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
        {/* Instruction Header */}
        <div className="mb-4 pb-4 border-b" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
          <h2 className="text-xl font-bold text-amber-200 tracking-wider mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.15em' }}>PLAY A RECORD</h2>
          <p className="text-xs text-amber-300/80" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Use the controls below to play, pause, and adjust the sonification. Adjust tempo, volume, and clusters to explore the musical patterns in the neural activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <button
            onClick={togglePlayback}
            className="jukebox-button flex items-center gap-2 px-6 py-3 font-semibold transition-colors"
            style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5" />
            <label className="text-sm">Volume</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm w-12">{Math.round(volume * 100)}%</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm">Tempo: {tempo} BPM</label>
            <input
              type="range"
              min="60"
              max="180"
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              className="w-32"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm">Clusters:</label>
            <input
              type="number"
              min="2"
              max="8"
              value={numClusters}
              onChange={(e) => setNumClusters(Math.max(2, Math.min(8, Number(e.target.value))))}
              className="bg-amber-900/40 border rounded px-3 py-2 text-sm w-20 text-amber-200" 
              style={{ fontFamily: 'Orbitron, sans-serif', borderColor: 'rgba(234, 179, 8, 0.3)' }}
            />
            {clusterAnalysis && (
              <>
                <span className="text-xs text-amber-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  (Suggested: {suggestedK})
                </span>
                <button
                  onClick={() => setNumClusters(suggestedK)}
                  className="jukebox-button text-xs px-2 py-1 rounded"
                  style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}
                  title="Use suggested optimal number of clusters"
                >
                  Use Suggested
                </button>
              </>
            )}
          </div>

        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Frame: {currentFrame + 1} / {dataset.frames}
          </div>
          <div className="flex-1 bg-white/20 rounded-full h-2">
            <div 
              className="bg-amber-400 h-2 rounded-full transition-all duration-100"
              style={{ width: `${((currentFrame + 1) / dataset.frames) * 100}%` }}
            />
          </div>
        </div>

        {/* Cluster Activity */}
        <div className="mt-4 space-y-2">
          <div className="text-sm text-amber-200 font-semibold" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>CLUSTER ACTIVITY:</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {clusters.map((cluster, idx) => {
              const activity = clusterActivityRef.current.get(cluster.id) || 0;
              const instrumentType = assignInstrumentToCluster(cluster, idx, dataset, pcaResultRef.current);
              return (
                <div
                  key={cluster.id}
                  className="bg-amber-900/20 border rounded p-2" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}
                >
                  <div 
                    className="text-xs mb-1 font-semibold"
                    style={{ color: getClusterColor(idx) }}
                  >
                    Cluster {cluster.id} ({instrumentType})
                  </div>
                  <div 
                    className="text-xs mb-1"
                    style={{ color: getClusterColor(idx), opacity: 0.8 }}
                  >
                    {cluster.neurons.length} neurons
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, activity * 100)}%`,
                        backgroundColor: getClusterColor(idx)
                      }}
                    />
                  </div>
                  <div 
                    className="text-xs mt-1"
                    style={{ color: getClusterColor(idx), opacity: 0.9 }}
                  >
                    {(activity * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Visualization Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Brain Visualization */}
        <BrainVisualization 
          dataset={dataset} 
          currentFrame={currentFrame} 
          frameImages={dataset.frameImages}
          clusters={clusters}
          getClusterColor={getClusterColor}
        />
        
        {/* Cluster Visualization */}
        <div className="bg-amber-900/20 border rounded-lg p-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
          <h3 className="text-xl font-semibold mb-4 text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>NEURON CLUSTERS</h3>
        <div className="space-y-4">
          {clusters.map((cluster, idx) => {
            const instrumentType = assignInstrumentToCluster(cluster, idx, dataset, pcaResult);
            const activity = clusterActivityRef.current.get(cluster.id) || 0;
            return (
              <div
                key={cluster.id}
                className="bg-amber-900/20 border rounded-lg p-4" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span 
                      className="font-semibold"
                      style={{ color: getClusterColor(idx) }}
                    >
                      Cluster {cluster.id}
                    </span>
                    <span 
                      className="text-xs px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: getClusterColor(idx) + '40',
                        color: getClusterColor(idx)
                      }}
                    >
                      {instrumentType}
                    </span>
                  </div>
                  <div 
                    className="text-sm"
                    style={{ color: getClusterColor(idx), opacity: 0.8 }}
                  >
                    {cluster.neurons.length} neurons
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cluster.neurons.slice(0, 50).map(neuronIdx => {
                    const intensity = dataset.neurons[neuronIdx]?.trace[currentFrame] || 0;
                    return (
                      <div
                        key={neuronIdx}
                        className="w-3 h-3 rounded transition-all"
                        style={{
                          backgroundColor: getClusterColor(idx),
                          opacity: intensity > 0.1 ? 1 : 0.3
                        }}
                        title={`Neuron ${neuronIdx}: ${(intensity * 100).toFixed(0)}%`}
                      />
                    );
                  })}
                  {cluster.neurons.length > 50 && (
                    <div className="text-xs text-amber-400 self-center ml-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      +{cluster.neurons.length - 50} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Activity Pattern Visualization */}
      <div className="mb-6">
        <ActivityPatternVisualization
          dataset={dataset}
          currentFrame={currentFrame}
          clusters={clusters}
          getClusterColor={getClusterColor}
        />
      </div>
    </div>
  );
};

export default MusicalSonification;

