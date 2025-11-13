import { useMemo, memo, useState } from 'react';
import { Info } from 'lucide-react';
import { CalciumDataset } from '../types';
import { Cluster } from '../utils/clustering';

interface ActivityPatternVisualizationProps {
  dataset: CalciumDataset;
  currentFrame: number;
  clusters?: Cluster[];
  getClusterColor?: (clusterIdx: number) => string;
}

/**
 * Simple, intuitive visualization showing temporal activity patterns
 * Helps users understand when different clusters/neurons are active
 */
const ActivityPatternVisualization = memo(function ActivityPatternVisualization({
  dataset,
  currentFrame,
  clusters,
  getClusterColor
}: ActivityPatternVisualizationProps) {
  const [showInfo, setShowInfo] = useState(false);
  
  // Calculate activity patterns over time
  const activityPatterns = useMemo(() => {
    if (clusters && clusters.length > 0) {
      // Show cluster-level activity over time
      const patterns = clusters.map((cluster, clusterIdx) => {
        const clusterActivity: number[] = [];
        
        // For each frame, calculate average activity of neurons in this cluster
        for (let frame = 0; frame < dataset.frames; frame++) {
          let totalActivity = 0;
          let count = 0;
          
          cluster.neurons.forEach(neuronIdx => {
            const neuron = dataset.neurons[neuronIdx];
            if (neuron.trace && frame < neuron.trace.length) {
              totalActivity += neuron.trace[frame] || 0;
              count++;
            }
          });
          
          clusterActivity.push(count > 0 ? totalActivity / count : 0);
        }
        
        return {
          clusterIdx,
          activity: clusterActivity,
          name: `Cluster ${clusterIdx + 1}`
        };
      });
      
      return patterns;
    } else {
      // If no clusters, show overall activity pattern
      const overallActivity: number[] = [];
      
      for (let frame = 0; frame < dataset.frames; frame++) {
        let totalActivity = 0;
        let count = 0;
        
        dataset.neurons.forEach(neuron => {
          if (neuron.trace && frame < neuron.trace.length) {
            totalActivity += neuron.trace[frame] || 0;
            count++;
          }
        });
        
        overallActivity.push(count > 0 ? totalActivity / count : 0);
      }
      
      return [{
        clusterIdx: -1,
        activity: overallActivity,
        name: 'Overall Activity'
      }];
    }
  }, [dataset, clusters]);

  // Find max activity for normalization
  const maxActivity = useMemo(() => {
    let max = 0;
    activityPatterns.forEach(pattern => {
      const patternMax = Math.max(...pattern.activity);
      max = Math.max(max, patternMax);
    });
    return max || 1;
  }, [activityPatterns]);

  // Sample frames for display (show every Nth frame to keep it manageable)
  const sampleRate = Math.max(1, Math.floor(dataset.frames / 200)); // Show up to 200 time points
  const sampledFrames = useMemo(() => {
    const frames: number[] = [];
    for (let i = 0; i < dataset.frames; i += sampleRate) {
      frames.push(i);
    }
    if (frames[frames.length - 1] !== dataset.frames - 1) {
      frames.push(dataset.frames - 1);
    }
    return frames;
  }, [dataset.frames, sampleRate]);

  return (
    <div className="bg-amber-900/20 border rounded-lg p-6 relative" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
      {/* Info Icon Button */}
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="absolute top-6 right-6 z-50 text-amber-200 hover:text-amber-300 transition-colors"
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
                  <li>• Horizontal bars show activity levels over time</li>
                  {clusters && clusters.length > 0 ? (
                    <>
                      <li>• Each row represents a different cluster (group of similar neurons)</li>
                      <li>• Brightness indicates how active that cluster is at each moment</li>
                      <li>• Vertical alignment shows synchronization - clusters that light up together are firing in sync</li>
                    </>
                  ) : (
                    <>
                      <li>• Shows overall neural activity across all neurons</li>
                      <li>• Bright periods = high activity, dark periods = low activity</li>
                      <li>• Patterns reveal bursts, oscillations, and quiet periods</li>
                    </>
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

      <h3 className="text-xl font-semibold mb-4 text-amber-200 pr-10" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>
        ACTIVITY PATTERNS OVER TIME
      </h3>
      
      <div className="space-y-4">
        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-amber-300/70" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <span>Time →</span>
          <div className="flex items-center gap-2">
            <span>Low</span>
            <div className="w-16 h-3 bg-gradient-to-r from-amber-900/50 via-amber-600/70 to-amber-300 rounded"></div>
            <span>High</span>
          </div>
        </div>

        {/* Activity heatmap */}
        <div className="bg-black/50 rounded-lg p-4 overflow-x-auto">
          <div className="space-y-2 min-w-[600px]">
            {activityPatterns.map((pattern) => {
              const color = clusters && getClusterColor 
                ? getClusterColor(pattern.clusterIdx) 
                : '#EAB308'; // Default amber
              
              return (
                <div key={pattern.clusterIdx} className="flex items-center gap-3">
                  {/* Cluster label */}
                  <div className="w-24 text-xs text-amber-200 flex-shrink-0" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    <div className="flex items-center gap-2">
                      {clusters && getClusterColor && (
                        <div 
                          className="w-3 h-3 rounded-full border border-amber-600/30"
                          style={{ backgroundColor: color }}
                        ></div>
                      )}
                      <span className="truncate">{pattern.name}</span>
                    </div>
                  </div>
                  
                  {/* Activity bars */}
                  <div className="flex-1 flex gap-0.5 items-center">
                    {sampledFrames.map((frame, frameIdx) => {
                      const activity = pattern.activity[frame];
                      const normalizedActivity = activity / maxActivity;
                      const isCurrentFrame = frame === currentFrame;
                      
                      return (
                        <div
                          key={frameIdx}
                          className="flex-1 h-6 rounded-sm transition-all"
                          style={{
                            backgroundColor: clusters && getClusterColor
                              ? `${color}${Math.floor(normalizedActivity * 200 + 55).toString(16).padStart(2, '0')}`
                              : `rgba(234, 179, 8, ${0.3 + normalizedActivity * 0.7})`,
                            border: isCurrentFrame ? '2px solid rgba(234, 179, 8, 1)' : 'none',
                            boxShadow: isCurrentFrame ? '0 0 8px rgba(234, 179, 8, 0.8)' : 'none',
                            transform: isCurrentFrame ? 'scaleY(1.2)' : 'scaleY(1)',
                            transition: 'all 0.2s ease'
                          }}
                          title={`Frame ${frame + 1}: ${(normalizedActivity * 100).toFixed(0)}% activity`}
                        />
                      );
                    })}
                  </div>
                  
                  {/* Current activity indicator */}
                  <div className="w-16 text-xs text-amber-300/70 text-right flex-shrink-0" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {currentFrame < pattern.activity.length && (
                      <span>{(pattern.activity[currentFrame] * 100).toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

ActivityPatternVisualization.displayName = 'ActivityPatternVisualization';

export default ActivityPatternVisualization;

