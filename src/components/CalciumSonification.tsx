import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Info } from 'lucide-react';
import * as Tone from 'tone';
import { CalciumDataset } from '../types';
import BrainVisualization from './BrainVisualization';

interface CalciumSonificationProps {
  dataset: CalciumDataset;
}

const CalciumSonification = ({ dataset }: CalciumSonificationProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [showInfo, setShowInfo] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [sonificationMode, setSonificationMode] = useState<'spike' | 'continuous'>('spike');
  
  const synthsRef = useRef<Tone.Synth[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const gainNodeRef = useRef<Tone.Gain | null>(null);
  const tempoRef = useRef(tempo);

  // Pentatonic scale (C major pentatonic)
  const pentatonicScale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 987.77, 1108.73];

  // Initialize synthesizers
  useEffect(() => {
    // Create gain node for master volume
    gainNodeRef.current = new Tone.Gain(volume).toDestination();

    // Create one synth per neuron
    synthsRef.current = dataset.neurons.map(() => {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.01,
          decay: 0.1,
          sustain: 0.3,
          release: 0.3
        }
      }).connect(gainNodeRef.current!);

      return synth;
    });

    return () => {
      synthsRef.current.forEach(synth => {
        try {
          synth.dispose();
        } catch (e) {
          // Ignore disposal errors
        }
      });
      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.dispose();
        } catch (e) {
          // Ignore disposal errors
        }
      }
    };
  }, [dataset.neurons.length]);

  // Update master volume
  useEffect(() => {
    if (gainNodeRef.current && gainNodeRef.current.gain) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  // Update tempo ref when tempo changes
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  // Playback loop
  useEffect(() => {
    if (isPlaying && dataset) {
      const playFrame = () => {
        // Use current tempo from ref (always up-to-date)
        const currentTempo = tempoRef.current;
        const frameInterval = (60 / currentTempo) * 1000 / 4; // Convert tempo to ms per frame

        setCurrentFrame(prev => {
          const nextFrame = (prev + 1) % dataset.frames;
          
          // Sonify this frame
          dataset.neurons.forEach((neuron, i) => {
            const intensity = neuron.trace[nextFrame];
            const prevIntensity = neuron.trace[prev];
            
            if (i >= synthsRef.current.length || !synthsRef.current[i]) return;
            
            if (sonificationMode === 'spike') {
              // Spike mode: trigger on rising edge
              if (intensity > 0.5 && prevIntensity <= 0.5) {
                const frequency = pentatonicScale[i % pentatonicScale.length];
                const noteVolume = -30 + (intensity * 30);
                if (synthsRef.current[i].volume) {
                  synthsRef.current[i].volume.value = noteVolume;
                }
                // Add small time offset per neuron to avoid Tone.js scheduling conflicts
                const now = Tone.now();
                const timeOffset = i * 0.001; // 1ms offset per neuron
                synthsRef.current[i].triggerAttackRelease(frequency, '16n', now + timeOffset);
              }
            } else {
              // Continuous mode: sustain note based on intensity
              if (intensity > 0.3) {
                const frequency = pentatonicScale[i % pentatonicScale.length];
                const noteVolume = -40 + (intensity * 40);
                if (synthsRef.current[i].volume) {
                  synthsRef.current[i].volume.value = noteVolume;
                }
                
                // Only trigger if not already playing
                if (prevIntensity <= 0.3) {
                  synthsRef.current[i].triggerAttack(frequency);
                }
              } else {
                // Release if intensity drops
                if (prevIntensity > 0.3) {
                  synthsRef.current[i].triggerRelease();
                }
              }
            }
          });

          return nextFrame;
        });

        // Schedule next frame with current tempo
        timeoutRef.current = window.setTimeout(playFrame, frameInterval);
      };

      playFrame();

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      // Stop all synths when paused
      synthsRef.current.forEach(synth => {
        try {
          synth.triggerRelease();
        } catch (e) {
          // Ignore errors
        }
      });
    }
  }, [isPlaying, dataset, sonificationMode]);

  const togglePlayback = async () => {
    if (!isPlaying) {
      await Tone.start();
    }
    setIsPlaying(!isPlaying);
  };

  // Calculate statistics
  const avgActivity = dataset.neurons.reduce(
    (sum, n) => sum + n.trace[currentFrame], 0
  ) / dataset.neurons.length;

  const activeNeurons = dataset.neurons.filter(
    n => n.trace[currentFrame] > 0.5
  ).length;

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
                <li>• Each neuron is mapped to a note in a pentatonic scale</li>
                  <li>• Two sonification modes: Spike (triggered on rising edge) and Continuous (sustained notes)</li>
                <li>• Calcium intensity controls volume and triggers notes</li>
                <li>• Temporal patterns create rhythmic structure</li>
                <li>• Synchronized activity produces harmonies</li>
                <li>• Dataset: {dataset.datasetName || 'Unknown'}</li>
                {dataset.metadata?.condition && (
                  <li>• Condition: {dataset.metadata.condition}</li>
                )}
                  {dataset.metadata?.region && (
                    <li>• Region: {dataset.metadata.region}</li>
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
            Use the controls below to play, pause, and adjust the sonification. Adjust tempo, volume, and mode to explore the neural activity patterns.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <button
            onClick={togglePlayback}
            className="jukebox-button flex items-center gap-2 px-6 py-3 font-semibold transition-colors"
            style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>

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
            <label className="text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>Mode:</label>
            <select
              value={sonificationMode}
              onChange={(e) => setSonificationMode(e.target.value as 'spike' | 'continuous')}
              className="bg-amber-900/40 border rounded px-3 py-2 text-sm text-amber-200"
              style={{ fontFamily: 'Orbitron, sans-serif', borderColor: 'rgba(234, 179, 8, 0.3)' }}
            >
              <option value="spike">Spike (triggered)</option>
              <option value="continuous">Continuous (sustained)</option>
            </select>
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

        {/* Statistics */}
        <div className="mt-4 flex gap-6 text-sm text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <div>Avg Activity: {(avgActivity * 100).toFixed(1)}%</div>
          <div>Active Neurons: {activeNeurons} / {dataset.neurons.length}</div>
        </div>
      </div>

      {/* Visualization Grid - All in a row horizontally */}
      <div className="grid grid-cols-3 gap-6 items-stretch">
        {/* Spatial Activity Map */}
        <div className="flex flex-col h-full">
          <BrainVisualization 
            dataset={dataset} 
            currentFrame={currentFrame} 
            frameImages={dataset.frameImages}
          />
        </div>
        
        {/* Calcium Traces - Full vertical space */}
        <div className="bg-amber-900/20 border rounded-lg p-6 flex flex-col h-full" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
          <h3 className="text-xl font-semibold mb-4 text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>CALCIUM TRACES</h3>
          <div className="space-y-2 flex-1 overflow-y-auto min-h-0 max-h-[500px]">
            {dataset.neurons.slice(0, 20).map((neuron, i) => (
              <div key={neuron.id} className="relative">
                <div className="text-xs mb-1 text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>{neuron.name}</div>
                <div className="h-8 bg-black/30 rounded relative overflow-hidden">
                  <svg className="w-full h-full" preserveAspectRatio="none">
                    <polyline
                      points={neuron.trace
                        .slice(Math.max(0, currentFrame - 50), currentFrame + 1)
                        .map((val, idx) => {
                          const x = (idx / Math.min(50, currentFrame + 1)) * 100;
                          const y = (1 - val) * 100;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke={`hsl(${(i * 360) / dataset.neurons.length}, 70%, 60%)`}
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <div 
                    className="absolute right-0 top-0 w-1 bg-white transition-all"
                    style={{ 
                      height: `${neuron.trace[currentFrame] * 100}%`,
                      opacity: neuron.trace[currentFrame] > 0.5 ? 1 : 0.3
                    }}
                  />
                </div>
              </div>
            ))}
            {dataset.neurons.length > 20 && (
              <div className="text-xs text-amber-300 text-center pt-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Showing first 20 of {dataset.neurons.length} neurons
              </div>
            )}
          </div>
        </div>

        {/* Network Activity Heatmap */}
        <div className="bg-amber-900/20 border rounded-lg p-6 flex flex-col h-full" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
          <h3 className="text-xl font-semibold mb-4 text-amber-200" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>NETWORK ACTIVITY</h3>
          <div className="grid grid-cols-10 gap-1 mb-6 flex-shrink-0">
            {dataset.neurons.slice(0, 100).map((neuron, i) => (
              <div
                key={neuron.id}
                className="aspect-square rounded transition-all duration-100"
                style={{
                  backgroundColor: `hsl(${(i * 360) / dataset.neurons.length}, 70%, ${
                    neuron.trace[currentFrame] * 60 + 20
                  }%)`,
                  boxShadow: neuron.trace[currentFrame] > 0.5 
                    ? `0 0 20px hsl(${(i * 360) / dataset.neurons.length}, 70%, 60%)`
                    : 'none'
                }}
                title={`${neuron.name}: ${(neuron.trace[currentFrame] * 100).toFixed(1)}%`}
              />
            ))}
          </div>
          
          {/* Activity timeline */}
          <div className="flex-1 flex flex-col">
            <div className="text-sm text-amber-200 mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Population Activity Over Time</div>
            <div className="flex-1 bg-black/30 rounded relative min-h-[100px]">
              <svg className="w-full h-full" preserveAspectRatio="none">
                <polyline
                  points={Array.from({ length: dataset.frames }, (_, f) => {
                    const avgActivity = dataset.neurons.reduce(
                      (sum, n) => sum + n.trace[f], 0
                    ) / dataset.neurons.length;
                    return `${(f / dataset.frames) * 100},${(1 - avgActivity) * 100}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#A3B499"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={`${(currentFrame / dataset.frames) * 100}%`}
                  y1="0"
                  x2={`${(currentFrame / dataset.frames) * 100}%`}
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
    </div>
  );
};

export default CalciumSonification;

