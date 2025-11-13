import { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Plus, Minus, BarChart3, Music, Volume2, Info } from 'lucide-react';
import { CalciumDataset } from '../types';
import { addDatasets, subtractDatasets, averageDatasets } from '../utils/datasetOperations';
import { calculateMusicalConcordance, MusicalConcordance } from '../utils/musicalMetrics';
import { extractTraceFeatures, performPCA } from '../utils/pca';
import { kMeans, suggestOptimalK, Cluster } from '../utils/clustering';
import { initSeededRandom, hashDataset } from '../utils/seededRandom';
import { assignInstrumentToCluster, createInstrument, getNoteFrequency, MAJOR_SCALE } from './MusicalSonification';
import * as Tone from 'tone';

interface DatasetComparisonProps {
  datasets: CalciumDataset[];
  onDatasetCreated?: (dataset: CalciumDataset) => void;
  shouldPause?: number;
}

const DatasetComparison = ({ datasets, onDatasetCreated, shouldPause = 0 }: DatasetComparisonProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [volume, setVolume] = useState(0.7);
  const [numClusters, setNumClusters] = useState<Map<number, number>>(new Map()); // Per-dataset cluster counts
  const [selectedDataset1, setSelectedDataset1] = useState<number | null>(null);
  const [selectedDataset2, setSelectedDataset2] = useState<number | null>(null);
  const [operation, setOperation] = useState<'add' | 'subtract' | 'average'>('subtract');
  const [resultDataset, setResultDataset] = useState<CalciumDataset | null>(null);
  const [concordance, setConcordance] = useState<MusicalConcordance | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Musical sonification state for each dataset
  const datasetClustersRef = useRef<Map<number, { 
    clusters: Cluster[]; 
    pcaResult: ReturnType<typeof performPCA> | null;
    suggestedK?: number;
    clusterAnalysis?: ReturnType<typeof suggestOptimalK>;
  }>>(new Map());
  const datasetInstrumentsRef = useRef<Map<number, Map<number, Tone.PolySynth | Tone.Synth>>>(new Map());
  const gainNodeRef = useRef<Tone.Gain | null>(null);
  const isPlayingRef = useRef(false);
  const currentFrameRef = useRef(0);
  const loopRunningRef = useRef(false);
  const lastPlayTimeRef = useRef<Map<string, number>>(new Map()); // Key: "datasetIdx-clusterId"
  const tempoRef = useRef(tempo);

  // Perform PCA and clustering for each dataset AND result dataset
  const datasetAnalyses = useMemo(() => {
    const analyses = new Map<number, { 
      clusters: Cluster[]; 
      pcaResult: ReturnType<typeof performPCA> | null;
      suggestedK?: number;
      clusterAnalysis?: ReturnType<typeof suggestOptimalK>;
    }>();
    
    // Analyze all datasets
    datasets.forEach((dataset, idx) => {
      if (dataset.neurons.length === 0) {
        analyses.set(idx, { clusters: [], pcaResult: null, suggestedK: 2 });
        return;
      }

      // Initialize seeded random for deterministic results
      const seed = hashDataset(
        dataset.datasetName || `dataset_${idx}`,
        dataset.neurons.length,
        dataset.frames
      );
      initSeededRandom(seed);

      const traces = dataset.neurons.map(n => n.trace);
      const features = extractTraceFeatures(traces, dataset.neurons, dataset.imageWidth, dataset.imageHeight);
      const pca = performPCA(features, 3);
      const analysis = suggestOptimalK(pca.transformed, 6);
      const suggestedK = Math.max(2, Math.min(analysis.optimalK, 6));
      const userK = numClusters.get(idx);
      const finalK = userK || suggestedK;
      const clusters = kMeans(pca.transformed, finalK, 100);
      
      analyses.set(idx, { clusters, pcaResult: pca, suggestedK, clusterAnalysis: analysis });
    });
    
    // Also analyze result dataset if it exists (use special index -1)
    if (resultDataset && resultDataset.neurons.length > 0) {
      // Initialize seeded random for deterministic results
      const seed = hashDataset(
        resultDataset.datasetName || 'result',
        resultDataset.neurons.length,
        resultDataset.frames
      );
      initSeededRandom(seed);

      const traces = resultDataset.neurons.map(n => n.trace);
      const features = extractTraceFeatures(traces);
      const pca = performPCA(features, 3);
      const analysis = suggestOptimalK(pca.transformed, 6);
      const suggestedK = Math.max(2, Math.min(analysis.optimalK, 6));
      const userK = numClusters.get(-1);
      const finalK = userK || suggestedK;
      const clusters = kMeans(pca.transformed, finalK, 100);
      
      analyses.set(-1, { clusters, pcaResult: pca, suggestedK, clusterAnalysis: analysis }); // Use -1 as special index for result
    }
    
    return analyses;
  }, [datasets, resultDataset, numClusters]);

  // Store in ref
  useEffect(() => {
    datasetClustersRef.current = datasetAnalyses;
  }, [datasetAnalyses]);

  // Initialize instruments for each dataset
  useEffect(() => {
    if (datasets.length === 0) return;

    // Clean up old instruments
    datasetInstrumentsRef.current.forEach(instruments => {
      instruments.forEach(instrument => {
        try {
          instrument.dispose();
        } catch (e) {
          // Ignore
        }
      });
    });
    datasetInstrumentsRef.current.clear();

    // Create gain node
    if (gainNodeRef.current) {
      gainNodeRef.current.dispose();
    }
    gainNodeRef.current = new Tone.Gain(volume).toDestination();

    // Create instruments for each dataset's clusters
    datasets.forEach((dataset, datasetIdx) => {
      const analysis = datasetAnalyses.get(datasetIdx);
      if (!analysis || analysis.clusters.length === 0) return;

      const instruments = new Map<number, Tone.PolySynth | Tone.Synth>();
      
      analysis.clusters.forEach((cluster, clusterIdx) => {
        const instrumentType = assignInstrumentToCluster(cluster, clusterIdx, dataset, analysis.pcaResult);
        const instrument = createInstrument(instrumentType);
        
        // Add reverb
        const reverb = new Tone.Reverb(0.4).toDestination();
        reverb.wet.value = 0.25;
        instrument.connect(reverb);
        reverb.connect(gainNodeRef.current!);
        
        instruments.set(cluster.id, instrument);
      });
      
      datasetInstrumentsRef.current.set(datasetIdx, instruments);
    });

    // Also create instruments for result dataset if it exists
    if (resultDataset) {
      const analysis = datasetAnalyses.get(-1);
      if (analysis && analysis.clusters.length > 0) {
        const instruments = new Map<number, Tone.PolySynth | Tone.Synth>();
        
        analysis.clusters.forEach((cluster, clusterIdx) => {
          const instrumentType = assignInstrumentToCluster(cluster, clusterIdx, resultDataset, analysis.pcaResult);
          const instrument = createInstrument(instrumentType);
          
          // Add reverb with slightly different settings to distinguish result
          const reverb = new Tone.Reverb(0.5);
          reverb.wet.value = 0.3;
          instrument.connect(reverb);
          reverb.connect(gainNodeRef.current!);
          
          instruments.set(cluster.id, instrument);
        });
        
        datasetInstrumentsRef.current.set(-1, instruments); // Use -1 as special index
      }
    }

      return () => {
      datasetInstrumentsRef.current.forEach(instruments => {
        instruments.forEach(instrument => {
          try {
            instrument.dispose();
          } catch (e) {
            // Ignore
          }
        });
      });
      datasetInstrumentsRef.current.clear();
      if (gainNodeRef.current) {
        gainNodeRef.current.dispose();
      }
    };
  }, [datasets, resultDataset, datasetAnalyses, volume]);

  // Update master volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  // Calculate concordance when both datasets are selected
  useEffect(() => {
    if (selectedDataset1 !== null && selectedDataset2 !== null && selectedDataset1 !== selectedDataset2) {
      try {
        const concordanceResult = calculateMusicalConcordance(
          datasets[selectedDataset1],
          datasets[selectedDataset2]
        );
        setConcordance(concordanceResult);
      } catch (error) {
        console.error('Error calculating concordance:', error);
      }
    } else {
      setConcordance(null);
    }
  }, [selectedDataset1, selectedDataset2, datasets]);

  // Perform operation when both datasets are selected
  useEffect(() => {
    if (selectedDataset1 !== null && selectedDataset2 !== null && selectedDataset1 !== selectedDataset2) {
      try {
        let result: CalciumDataset;
        switch (operation) {
          case 'add':
            result = addDatasets(datasets[selectedDataset1], datasets[selectedDataset2]);
            break;
          case 'subtract':
            result = subtractDatasets(datasets[selectedDataset1], datasets[selectedDataset2]);
            break;
          case 'average':
            result = averageDatasets(datasets[selectedDataset1], datasets[selectedDataset2]);
            break;
          default:
            return;
        }
        setResultDataset(result);
      } catch (error) {
        console.error('Error performing dataset operation:', error);
      }
    } else {
      setResultDataset(null);
    }
  }, [selectedDataset1, selectedDataset2, operation, datasets]);

  const handleCreateResult = () => {
    if (resultDataset && onDatasetCreated) {
      onDatasetCreated(resultDataset);
    }
  };

  if (datasets.length < 2) {
    return (
      <div className="bg-amber-900/20 border rounded-lg p-6 text-center" style={{ borderColor: 'rgba(163, 180, 153, 0.4)' }}>
        <p className="text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>Load at least 2 datasets to enable comparison mode</p>
      </div>
    );
  }

  const allDatasetsForFrames = resultDataset ? [...datasets, resultDataset] : datasets;
  const maxFrames = Math.max(...allDatasetsForFrames.map(d => d.frames));

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

  // Musical playback loop
  useEffect(() => {
    const previousPlaying = isPlayingRef.current;
    
    if (isPlaying && !previousPlaying && datasets.length > 0) {
      isPlayingRef.current = true;
      currentFrameRef.current = currentFrame;
      
      const playFrame = () => {
        // Use current tempo from ref (always up-to-date)
        const currentTempo = tempoRef.current;
      const allDatasets = resultDataset ? [...datasets, resultDataset] : datasets;
      const maxFrames = Math.max(...allDatasets.map(d => d.frames));

        if (!isPlayingRef.current || datasets.length === 0) {
          loopRunningRef.current = false;
          return;
        }

        const nextFrame = (currentFrameRef.current + 1) % maxFrames;
        currentFrameRef.current = nextFrame;

        // Update UI
        if (nextFrame % 5 === 0 || nextFrame < 20) {
          setCurrentFrame(nextFrame);
        }

        const now = Tone.now();
        const currentTime = Tone.now();

        // Play each dataset's clusters (including result dataset)
        const allDatasetsToPlay: Array<{ dataset: CalciumDataset; datasetIdx: number }> = [
          ...datasets.map((d, idx) => ({ dataset: d, datasetIdx: idx })),
          ...(resultDataset ? [{ dataset: resultDataset, datasetIdx: -1 }] : [])
        ];

        allDatasetsToPlay.forEach(({ dataset, datasetIdx }) => {
          const analysis = datasetClustersRef.current.get(datasetIdx);
          if (!analysis || analysis.clusters.length === 0) return;

          const instruments = datasetInstrumentsRef.current.get(datasetIdx);
          if (!instruments) return;

          // Process each cluster
          analysis.clusters.forEach((cluster) => {
            const instrument = instruments.get(cluster.id);
            if (!instrument) return;

            // Get neuron activities for this frame
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

            // Calculate cluster metrics
            const avgIntensity = neuronActivities.reduce((sum, n) => sum + n.intensity, 0) / neuronActivities.length;
            const activeCount = neuronActivities.filter(n => n.intensity > 0.1).length;
            const activityRatio = activeCount / neuronActivities.length;
            const clusterActivity = avgIntensity * activityRatio;

            // Get PCA centroid for pitch offset
            const pcaData = analysis.pcaResult;
            const pcaCentroid = pcaData?.transformed[cluster.neurons[0]] || [0, 0, 0];
            const pitchOffset = Math.floor((pcaCentroid[0] + 2) * 2) % 12;
            // Result dataset (idx -1) gets a distinct octave range, others are spaced out
            const baseOctave = datasetIdx === -1 
              ? 5  // Result dataset in higher octave to distinguish it
              : 3 + Math.floor(datasetIdx / 2) + (activityRatio > 0.5 ? 1 : 0);

            // Trigger on spikes or sustained activity
            const threshold = 0.05;
            const spikeThreshold = 0.1;
            
            const spikes = neuronActivities.filter(n => 
              n.change > spikeThreshold && n.intensity > threshold
            );
            
            const sustained = neuronActivities.filter(n => 
              n.intensity > threshold && n.intensity > n.prevIntensity * 0.9
            );

            const neuronsToPlay = spikes.length > 0 ? spikes : sustained;
            if (neuronsToPlay.length === 0) return;

            try {
              // Map neurons to notes
              const notesToPlay = neuronsToPlay
                .slice(0, Math.min(5, neuronsToPlay.length))
                .map((neuron, noteIdx) => {
                  const scaleDegree = Math.floor(neuron.intensity * 7) % 7;
                  const finalDegree = (scaleDegree + pitchOffset) % 7;
                  const octave = baseOctave + Math.floor(neuron.intensity * 2);
                  const frequency = getNoteFrequency(finalDegree, octave, MAJOR_SCALE);
                  const volume = Tone.gainToDb(Math.max(0.1, Math.min(1, neuron.intensity * 0.8)));
                  const duration = neuron.intensity > 0.5 ? '8n' : '16n';
                  
                  return { frequency, volume, duration, intensity: neuron.intensity };
                })
                .sort((a, b) => a.frequency - b.frequency);

              // Play notes
              notesToPlay.forEach((note, noteIdx) => {
                const playKey = `${datasetIdx}-${cluster.id}`;
                const lastPlay = lastPlayTimeRef.current.get(playKey) || 0;
                const timeSinceLastPlay = currentTime - lastPlay;
                
                if (timeSinceLastPlay >= 0.05 || noteIdx === 0) {
                  if (noteIdx === 0) {
                    lastPlayTimeRef.current.set(playKey, currentTime);
                  }
                  
                  try {
                    if (instrument instanceof Tone.PolySynth) {
                      instrument.triggerAttackRelease(
                        Tone.Frequency(note.frequency).toNote(),
                        note.duration,
                        now + noteIdx * 0.01,
                        note.volume
                      );
                    } else {
                      instrument.volume.value = note.volume;
                      instrument.triggerAttackRelease(note.frequency, note.duration, now + noteIdx * 0.01);
                    }
                  } catch (error) {
                    // Ignore timing errors
                  }
                }
              });
            } catch (error) {
              // Ignore errors
            }
          });
        });

        // Schedule next frame
        if (isPlayingRef.current) {
          // Recalculate interval with current tempo for next frame
          const nextTempo = tempoRef.current;
          const nextBaseInterval = (1000 / (datasets[0]?.fps || 10)) * (120 / nextTempo);
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
          lastPlayTimeRef.current.clear();
          // Stop all instruments
          datasetInstrumentsRef.current.forEach(instruments => {
            instruments.forEach(instrument => {
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
      lastPlayTimeRef.current.clear();
      datasetInstrumentsRef.current.forEach(instruments => {
        instruments.forEach(instrument => {
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
      });
    }
  }, [isPlaying, datasets, resultDataset, currentFrame, datasetAnalyses]);

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
    setIsPlaying(!isPlaying);
  };

  // Calculate average activity for each dataset
  const getAvgActivity = (dataset: CalciumDataset, frame: number) => {
    const clampedFrame = Math.min(frame, dataset.frames - 1);
    return dataset.neurons.reduce(
      (sum, n) => sum + n.trace[clampedFrame], 0
    ) / dataset.neurons.length;
  };

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
                  <Info className="w-5 h-5" />
                  ⓘ How It Works
                </h3>
                <ul className="space-y-2 text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <li>• Compare multiple datasets side-by-side using musical sonification</li>
                  <li>• Perform operations: Add (combines traces), Subtract (finds differences), or Average (averages traces)</li>
                  <li>• Each dataset is analyzed with PCA and clustered into groups</li>
                  <li>• Musical instruments are assigned based on neural activity patterns (frequency, timbre, role, dynamics)</li>
                  <li>• Concordance metrics show how well datasets harmonize musically</li>
                  <li>• Result datasets can be saved and used in other modes</li>
                  <li>• Compare oscillation patterns between different conditions or brain regions</li>
                  <li>• Notice differences in synchronization, frequency, and amplitude</li>
                  <li>• These patterns translate to distinct "musical signatures" in the sonification</li>
                  <li>• All datasets play simultaneously, allowing you to hear their interactions</li>
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

      {/* Operation Controls */}
      <div className="bg-amber-900/20 border rounded-lg p-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
        {/* Instruction Header */}
        <div className="mb-4 pb-4 border-b" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
          <h2 className="text-xl font-bold text-amber-200 tracking-wider mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.15em' }}>COMPARE RECORDS</h2>
          <p className="text-xs text-amber-300/80" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Select two datasets to perform operations (Add, Subtract, Average) and create new combined datasets. Use the side-by-side comparison to explore differences.
          </p>
        </div>
        <h2 className="text-2xl font-semibold mb-4 text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>DATASET OPERATIONS</h2>
        
        <div className="space-y-4">
          {/* Dataset Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-amber-200 mb-2 block" style={{ fontFamily: 'Orbitron, sans-serif' }}>Select First Dataset:</label>
              <select
                value={selectedDataset1 ?? ''}
                onChange={(e) => setSelectedDataset1(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-amber-900/40 border rounded px-3 py-2 text-sm text-amber-200" 
                style={{ fontFamily: 'Orbitron, sans-serif', borderColor: 'rgba(234, 179, 8, 0.3)' }}
              >
                <option value="">-- Select --</option>
                {datasets.map((ds, idx) => (
                  <option key={idx} value={idx}>
                    {ds.datasetName || `Dataset ${idx + 1}`} ({ds.neurons.length} neurons, {ds.frames} frames)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-amber-200 mb-2 block" style={{ fontFamily: 'Orbitron, sans-serif' }}>Select Second Dataset:</label>
              <select
                value={selectedDataset2 ?? ''}
                onChange={(e) => setSelectedDataset2(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-amber-900/40 border rounded px-3 py-2 text-sm text-amber-200" 
                style={{ fontFamily: 'Orbitron, sans-serif', borderColor: 'rgba(234, 179, 8, 0.3)' }}
              >
                <option value="">-- Select --</option>
                {datasets.map((ds, idx) => (
                  <option key={idx} value={idx} disabled={idx === selectedDataset1}>
                    {ds.datasetName || `Dataset ${idx + 1}`} ({ds.neurons.length} neurons, {ds.frames} frames)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Operation Selection */}
          <div>
            <label className="text-sm text-amber-200 mb-2 block" style={{ fontFamily: 'Orbitron, sans-serif' }}>Operation:</label>
            <div className="flex gap-3">
              <button
                onClick={() => setOperation('add')}
                className={`jukebox-button flex items-center gap-2 px-4 py-2 transition-colors ${
                  operation === 'add'
                    ? 'colorful-border scale-105'
                    : ''
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}
              >
                <Plus className="w-4 h-4" />
                ADD
              </button>
              <button
                onClick={() => setOperation('subtract')}
                className={`jukebox-button flex items-center gap-2 px-4 py-2 transition-colors ${
                  operation === 'subtract'
                    ? 'colorful-border scale-105'
                    : ''
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}
              >
                <Minus className="w-4 h-4" />
                SUBTRACT
              </button>
              <button
                onClick={() => setOperation('average')}
                className={`jukebox-button flex items-center gap-2 px-4 py-2 transition-colors ${
                  operation === 'average'
                    ? 'colorful-border scale-105'
                    : ''
                }`}
                style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}
              >
                <BarChart3 className="w-4 h-4" />
                AVERAGE
              </button>
            </div>
            <p className="text-xs text-amber-300 mt-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              {operation === 'add' && 'Combines datasets by adding their traces together'}
              {operation === 'subtract' && 'Finds the difference between datasets (useful for control vs disease)'}
              {operation === 'average' && 'Averages the traces from both datasets'}
            </p>
          </div>

          {/* Musical Concordance Metrics */}
          {concordance && (
            <div className="bg-amber-900/20 border rounded-lg p-4" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Music className="w-5 h-5 text-amber-300" />
                <h3 className="font-semibold text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>MUSICAL CONCORDANCE ANALYSIS</h3>
              </div>
              
              <div className="space-y-3">
                {/* Overall Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>Overall Concordance:</span>
                    <span className={`text-sm font-semibold ${
                      concordance.overallScore > 0.5 ? 'text-green-300' :
                      concordance.overallScore > -0.5 ? 'text-yellow-300' :
                      'text-red-300'
                    }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {(concordance.overallScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        concordance.overallScore > 0.5 ? 'bg-green-500' :
                        concordance.overallScore > -0.5 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ 
                        width: `${Math.abs(concordance.overallScore) * 100}%`,
                        marginLeft: concordance.overallScore < 0 ? 'auto' : '0'
                      }}
                    />
                  </div>
                  <p className="text-xs text-amber-300 mt-1 italic" style={{ fontFamily: 'Orbitron, sans-serif' }}>{concordance.interpretation}</p>
                </div>

                {/* Detailed Metrics */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-amber-900/20 border rounded p-2" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                    <div className="text-amber-300 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Synchronization</div>
                    <div className="text-amber-200 font-semibold" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {(concordance.synchronization * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-amber-900/20 border rounded p-2" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                    <div className="text-amber-300 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Harmonic Similarity</div>
                    <div className="text-amber-200 font-semibold" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {(concordance.harmonicSimilarity * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-amber-900/20 border rounded p-2" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                    <div className="text-amber-300 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Pattern Similarity</div>
                    <div className="text-amber-200 font-semibold" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {(concordance.activityPatternSimilarity * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Result Preview */}
          {resultDataset && (
            <div className="bg-amber-900/20 border rounded-lg p-4" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>RESULT DATASET:</h3>
                  <p className="text-sm text-amber-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>{resultDataset.datasetName}</p>
                </div>
                <button
                  onClick={handleCreateResult}
                  className="jukebox-button px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}
                >
                  ADD TO DATASETS
                </button>
              </div>
              <div className="text-xs text-amber-300 space-y-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <p>Neurons: {resultDataset.neurons.length}</p>
                <p>Frames: {resultDataset.frames}</p>
                {resultDataset.metadata?.description && (
                  <p>Description: {resultDataset.metadata.description}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="bg-amber-900/20 border rounded-lg p-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
        {/* Instruction Header */}
        <div className="mb-4 pb-4 border-b" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
          <h2 className="text-xl font-bold text-amber-200 tracking-wider mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.15em' }}>PLAY RECORDS</h2>
          <p className="text-xs text-amber-300/80" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Use the controls below to play, pause, and adjust the sonification. Compare the neural activity patterns between datasets side-by-side.
          </p>
        </div>
        <h2 className="text-2xl font-semibold mb-4 text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>SIDE-BY-SIDE COMPARISON</h2>
      
        <div className="mb-4 flex items-center gap-4 flex-wrap">
        <button
          onClick={togglePlayback}
            className="jukebox-button flex items-center gap-2 px-6 py-3 font-semibold transition-colors"
            style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>

        <div className="flex items-center gap-3">
            <label className="text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>Tempo: {tempo} BPM</label>
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
            <Volume2 className="w-5 h-5 text-amber-300" />
            <label className="text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>Volume</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm w-12 text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>{Math.round(volume * 100)}%</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>Clusters per dataset:</label>
            <input
              type="number"
              min="2"
              max="8"
              value={numClusters.get(0) || ''}
              placeholder="Auto"
              onChange={(e) => {
                const newMap = new Map(numClusters);
                const val = e.target.value ? Number(e.target.value) : null;
                if (val !== null) {
                  datasets.forEach((_, idx) => newMap.set(idx, val));
                  if (resultDataset) newMap.set(-1, val);
                } else {
                  datasets.forEach((_, idx) => newMap.delete(idx));
                  newMap.delete(-1);
                }
                setNumClusters(newMap);
              }}
              className="bg-amber-900/40 border rounded px-3 py-2 text-sm w-20 text-amber-200" 
              style={{ fontFamily: 'Orbitron, sans-serif', borderColor: 'rgba(234, 179, 8, 0.3)' }}
            />
            <span className="text-xs text-amber-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              (Leave empty for auto-detection)
            </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Show result dataset if it exists */}
        {resultDataset && (
          <div className="bg-amber-900/20 border rounded-lg p-4" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>{resultDataset.datasetName}</h3>
              <span className="px-3 py-1 rounded text-sm font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/50" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>
                RESULT
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-amber-200 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  Average Activity: {(getAvgActivity(resultDataset, currentFrame) * 100).toFixed(1)}%
                </div>
                <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${getAvgActivity(resultDataset, currentFrame) * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-sm text-amber-200 space-y-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <p>Neurons: {resultDataset.neurons.length}</p>
                <p>Frames: {resultDataset.frames}</p>
                {resultDataset.metadata?.description && (
                  <p className="text-xs text-amber-300">Description: {resultDataset.metadata.description}</p>
                )}
              </div>

              {/* Activity timeline */}
              <div>
                <div className="text-xs text-amber-300 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Activity Timeline</div>
                <div className="h-16 bg-black/30 rounded relative">
                  <svg className="w-full h-full" preserveAspectRatio="none">
                    <polyline
                      points={Array.from({ length: resultDataset.frames }, (_, f) => {
                        const activity = getAvgActivity(resultDataset, f);
                        return `${(f / resultDataset.frames) * 100},${(1 - activity) * 100}`;
                      }).join(' ')}
                      fill="none"
                      stroke="rgb(234, 179, 8)"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={`${(Math.min(currentFrame, resultDataset.frames - 1) / resultDataset.frames) * 100}%`}
                      y1="0"
                      x2={`${(Math.min(currentFrame, resultDataset.frames - 1) / resultDataset.frames) * 100}%`}
                      y2="100"
                      stroke="white"
                      strokeWidth="2"
                      opacity="0.7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {datasets.map((dataset, idx) => {
          const avgActivity = getAvgActivity(dataset, currentFrame);
          const condition = dataset.metadata?.condition || 'unknown';
          const conditionColor = condition === 'disease' ? 'red' : condition === 'control' ? 'green' : 'blue';

          return (
            <div key={idx} className="bg-amber-900/20 border rounded-lg p-4" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>{dataset.datasetName || `Dataset ${idx + 1}`}</h3>
                {condition !== 'unknown' && (
                  <span className={`px-3 py-1 rounded text-sm font-semibold bg-${conditionColor}-500/20 text-${conditionColor}-300 border border-${conditionColor}-500/50`} style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>
                    {condition.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm text-amber-200 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    Average Activity: {(avgActivity * 100).toFixed(1)}%
                  </div>
                  <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-${conditionColor}-400 transition-all`}
                      style={{ width: `${avgActivity * 100}%` }}
                    />
                  </div>
                </div>

                <div className="text-sm text-amber-200 space-y-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <p>Neurons: {dataset.neurons.length}</p>
                  <p>Frames: {dataset.frames}</p>
                  {dataset.metadata?.region && (
                    <p>Region: {dataset.metadata.region}</p>
                  )}
                </div>

                {/* Activity timeline */}
                <div>
                  <div className="text-xs text-amber-300 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Activity Timeline</div>
                  <div className="h-16 bg-black/30 rounded relative">
                    <svg className="w-full h-full" preserveAspectRatio="none">
                      <polyline
                        points={Array.from({ length: dataset.frames }, (_, f) => {
                          const activity = getAvgActivity(dataset, f);
                          return `${(f / dataset.frames) * 100},${(1 - activity) * 100}`;
                        }).join(' ')}
                        fill="none"
                        stroke={`rgb(${condition === 'disease' ? '239, 68, 68' : condition === 'control' ? '34, 197, 94' : '234, 179, 8'})`}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1={`${(Math.min(currentFrame, dataset.frames - 1) / dataset.frames) * 100}%`}
                        y1="0"
                        x2={`${(Math.min(currentFrame, dataset.frames - 1) / dataset.frames) * 100}%`}
                        y2="100"
                        stroke="white"
                        strokeWidth="2"
                        opacity="0.7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mt-6 flex items-center gap-2">
        <div className="text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          Frame: {currentFrame + 1} / {maxFrames}
        </div>
        <div className="flex-1 bg-white/20 rounded-full h-2">
          <div 
            className="bg-amber-400 h-2 rounded-full transition-all duration-100"
            style={{ width: `${((currentFrame + 1) / maxFrames) * 100}%` }}
          />
        </div>
      </div>

      </div>
    </div>
  );
};

export default DatasetComparison;

