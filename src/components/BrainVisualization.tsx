import { useRef, useEffect, memo, useState, useMemo } from 'react';
import { CalciumDataset } from '../types';
import { tiffFrameToImageData } from '../utils/tiffLoader';
import { TIFFFrame } from '../utils/tiffLoader';
import { Cluster } from '../utils/clustering';

interface BrainVisualizationProps {
  dataset: CalciumDataset;
  currentFrame: number;
  frameImages?: TIFFFrame[]; // Optional: original frame images for background
  clusters?: Cluster[]; // Optional: cluster assignments for coloring neurons by cluster
  getClusterColor?: (clusterIdx: number) => string; // Optional: function to get cluster color
}

const BrainVisualization = memo(function BrainVisualization({ dataset, currentFrame, frameImages, clusters, getClusterColor }: BrainVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameRef = useRef<number>(-1);
  const boundsRef = useRef<{ minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } | null>(null);
  const [, setBackgroundImage] = useState<ImageData | null>(null);
  const backgroundBitmapRef = useRef<ImageBitmap | null>(null);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const loadingFrameRef = useRef<number>(-1); // Track which frame we're loading

  // Create mapping from neuron index to cluster index (for coloring by cluster)
  const neuronToClusterMap = useMemo(() => {
    if (!clusters || clusters.length === 0) return null;
    const map = new Map<number, number>();
    clusters.forEach((cluster, clusterIdx) => {
      cluster.neurons.forEach(neuronIdx => {
        map.set(neuronIdx, clusterIdx);
      });
    });
    return map;
  }, [clusters]);

  // Calculate bounds once when dataset changes - use image dimensions if available
  useEffect(() => {
    // If we have image dimensions, use those as bounds (coordinates are in pixel space)
    if (dataset.imageWidth && dataset.imageHeight) {
      boundsRef.current = {
        minX: 0,
        maxX: dataset.imageWidth,
        minY: 0,
        maxY: dataset.imageHeight,
        width: dataset.imageWidth,
        height: dataset.imageHeight
      };
      return;
    }

    // Fallback: calculate bounds from coordinates
    if (!dataset.neurons || dataset.neurons.length === 0) {
      boundsRef.current = { minX: 0, maxX: 512, minY: 0, maxY: 512, width: 512, height: 512 };
      return;
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let hasCoordinates = false;

    dataset.neurons.forEach(neuron => {
      if (neuron.coordinates && neuron.coordinates.length > 0) {
        hasCoordinates = true;
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

    if (!hasCoordinates || !isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      boundsRef.current = { minX: 0, maxX: 512, minY: 0, maxY: 512, width: 512, height: 512 };
      return;
    }

    if (maxX <= minX) maxX = minX + 512;
    if (maxY <= minY) maxY = minY + 512;

    const paddingX = (maxX - minX) * 0.05;
    const paddingY = (maxY - minY) * 0.05;

    boundsRef.current = {
      minX: minX - paddingX,
      maxX: maxX + paddingX,
      minY: minY - paddingY,
      maxY: maxY + paddingY,
      width: maxX - minX + paddingX * 2,
      height: maxY - minY + paddingY * 2
    };
  }, [dataset.neurons, dataset.imageWidth, dataset.imageHeight]);

  // Load background image from current frame if available
  useEffect(() => {
    let cancelled = false;
    loadingFrameRef.current = currentFrame;
    
    if (frameImages && frameImages.length > 0 && currentFrame < frameImages.length) {
      const frame = frameImages[currentFrame];
      if (frame && frame.data) {
        try {
          console.log(`Loading background frame ${currentFrame}, size: ${frame.width}x${frame.height}, data length: ${frame.data.length}`);
          const imageData = tiffFrameToImageData(frame);
          setBackgroundImage(imageData);
          
          // Create ImageBitmap for efficient rendering
          createImageBitmap(imageData).then(bitmap => {
            // Only use this bitmap if we're still on the same frame (avoid race conditions)
            if (!cancelled && loadingFrameRef.current === currentFrame) {
              console.log(`Background bitmap created for frame ${currentFrame}: ${bitmap.width}x${bitmap.height}`);
              // Close previous bitmap if it exists
              if (backgroundBitmapRef.current) {
                backgroundBitmapRef.current.close();
              }
              backgroundBitmapRef.current = bitmap;
              setBackgroundReady(true);
            } else {
              // We've moved to a different frame, close this bitmap
              bitmap.close();
            }
          }).catch(err => {
            console.warn('Failed to create ImageBitmap:', err);
            if (!cancelled) {
              setBackgroundReady(false);
            }
          });
        } catch (error) {
          console.warn('Failed to convert frame to image data:', error);
          if (!cancelled) {
            setBackgroundImage(null);
            if (backgroundBitmapRef.current) {
              backgroundBitmapRef.current.close();
              backgroundBitmapRef.current = null;
            }
            setBackgroundReady(false);
          }
        }
      } else {
        console.warn(`Frame ${currentFrame} missing data`);
        if (!cancelled) {
          setBackgroundImage(null);
          if (backgroundBitmapRef.current) {
            backgroundBitmapRef.current.close();
            backgroundBitmapRef.current = null;
          }
          setBackgroundReady(false);
        }
      }
    } else {
      if (!frameImages) {
        console.warn('No frameImages provided to BrainVisualization');
      } else if (frameImages.length === 0) {
        console.warn('frameImages array is empty');
      } else {
        console.warn(`currentFrame ${currentFrame} out of range (0-${frameImages.length - 1})`);
      }
      if (!cancelled) {
        setBackgroundImage(null);
        if (backgroundBitmapRef.current) {
          backgroundBitmapRef.current.close();
          backgroundBitmapRef.current = null;
        }
        setBackgroundReady(false);
      }
    }
    
    return () => {
      cancelled = true;
      // Don't close bitmap here - let the new frame's effect handle it
    };
  }, [frameImages, currentFrame]);

  // Render to canvas - isolated from React render cycle
  // Re-render when background is ready
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !boundsRef.current) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Throttle updates - only render every 3 frames to reduce load
    const throttledFrame = Math.floor(currentFrame / 3) * 3;
    
    // Skip if frame hasn't changed significantly AND background hasn't changed
    const frameChanged = Math.abs(throttledFrame - lastFrameRef.current) >= 2 || lastFrameRef.current < 0;
    if (!frameChanged && !backgroundReady) {
      return;
    }
    lastFrameRef.current = throttledFrame;
    
    // Debug: check if background bitmap is available
    if (backgroundBitmapRef.current) {
      console.log(`Rendering with background bitmap: ${backgroundBitmapRef.current.width}x${backgroundBitmapRef.current.height}`);
    } else {
      console.log('Rendering without background bitmap');
    }

    const bounds = boundsRef.current;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas with dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(0, 0, width, height);

    // Normalize functions
    const normalizeX = (x: number): number => {
      if (bounds.width === 0) return 0.5;
      return Math.max(0, Math.min(1, (x - bounds.minX) / bounds.width));
    };

    const normalizeY = (y: number): number => {
      if (bounds.height === 0) return 0.5;
      return Math.max(0, Math.min(1, (y - bounds.minY) / bounds.height));
    };

    // Draw background frame image if available (shows actual brain tissue)
    if (backgroundBitmapRef.current) {
      const bitmap = backgroundBitmapRef.current;
      console.log(`Drawing background: bitmap ${bitmap.width}x${bitmap.height}, canvas ${width}x${height}`);
      
      // Draw background to fill entire canvas (the image should match the coordinate space)
      // Draw the full image scaled to canvas
      ctx.save();
      // Draw with high opacity so brain tissue is clearly visible
      ctx.globalAlpha = 0.85;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(bitmap, 0, 0, width, height);
      
      // Enhance contrast with a subtle overlay to make tissue structure more visible
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = 'rgba(200, 150, 100, 0.15)'; // Warm tint to enhance visibility
      ctx.fillRect(0, 0, width, height);
      
      ctx.restore();
      ctx.globalAlpha = 1.0;
      console.log('Background drawn successfully');
    } else {
      console.log('No background bitmap available for drawing');
    }

    // Draw neuron regions first (if coordinates available) - these show the actual ROI shapes
    dataset.neurons.forEach(neuron => {
      if (neuron.coordinates && neuron.coordinates.length > 0) {
        const intensity = (neuron.trace && throttledFrame >= 0 && throttledFrame < neuron.trace.length)
          ? Math.max(0, Math.min(1, neuron.trace[throttledFrame] || 0))
          : 0;

        const validCoords = neuron.coordinates.filter(([x, y]) => 
          typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y)
        );

        if (validCoords.length > 0) {
          ctx.beginPath();
          validCoords.forEach(([x, y], idx) => {
            const nx = normalizeX(x) * width;
            const ny = normalizeY(y) * height;
            if (idx === 0) {
              ctx.moveTo(nx, ny);
            } else {
              ctx.lineTo(nx, ny);
            }
          });
          ctx.closePath();
          
          // Color by cluster if available, otherwise use intensity-based color
          let r: number, g: number, b: number;
          if (neuronToClusterMap && getClusterColor && neuronToClusterMap.has(neuron.id)) {
            const clusterIdx = neuronToClusterMap.get(neuron.id)!;
            const clusterColor = getClusterColor(clusterIdx);
            // Parse hex color
            if (clusterColor.startsWith('#')) {
              const hex = clusterColor.slice(1);
              r = parseInt(hex.slice(0, 2), 16);
              g = parseInt(hex.slice(2, 4), 16);
              b = parseInt(hex.slice(4, 6), 16);
            } else {
              // Fallback to intensity-based color
              r = Math.min(255, 255 * intensity);
              g = Math.min(255, 200 * intensity);
              b = Math.min(255, 100 * intensity);
            }
            // Adjust opacity based on intensity
            const opacity = 0.2 + (intensity * 0.3);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.4})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            // Use grayscale brightness scale (dark to white) for spike mode
            const brightness = Math.min(255, intensity * 255);
            r = brightness;
            g = brightness;
            b = brightness;
            
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.4})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + intensity * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    });

    // Draw neuron centers as bright points
    dataset.neurons.forEach(neuron => {
      let centerX = 0, centerY = 0;
      
      if (neuron.coordinates && neuron.coordinates.length > 0) {
        let sumX = 0, sumY = 0, count = 0;
        neuron.coordinates.forEach(([x, y]) => {
          if (typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y)) {
            sumX += x;
            sumY += y;
            count++;
          }
        });
        if (count > 0) {
          centerX = sumX / count;
          centerY = sumY / count;
        }
      }

      if (centerX === 0 && centerY === 0) {
        const index = neuron.id;
        const cols = Math.ceil(Math.sqrt(dataset.neurons.length));
        const row = Math.floor(index / cols);
        const col = index % cols;
        centerX = (col / cols) * bounds.width + bounds.minX;
        centerY = (row / Math.ceil(dataset.neurons.length / cols)) * bounds.height + bounds.minY;
      }

      const intensity = (neuron.trace && throttledFrame >= 0 && throttledFrame < neuron.trace.length)
        ? Math.max(0, Math.min(1, neuron.trace[throttledFrame] || 0))
        : 0;

      const nx = normalizeX(centerX) * width;
      const ny = normalizeY(centerY) * height;
      const radius = Math.max(1.5, Math.min(6, 2 + (intensity * 4)));
      
      // Color by cluster if available, otherwise use intensity-based color
      let r: number, g: number, b: number;
      if (neuronToClusterMap && getClusterColor && neuronToClusterMap.has(neuron.id)) {
        const clusterIdx = neuronToClusterMap.get(neuron.id)!;
        const clusterColor = getClusterColor(clusterIdx);
        // Parse hex color or use as-is if it's already RGB
        if (clusterColor.startsWith('#')) {
          const hex = clusterColor.slice(1);
          r = parseInt(hex.slice(0, 2), 16);
          g = parseInt(hex.slice(2, 4), 16);
          b = parseInt(hex.slice(4, 6), 16);
        } else if (clusterColor.startsWith('rgb')) {
          // Handle rgb() or rgba() format
          const matches = clusterColor.match(/\d+/g);
          if (matches && matches.length >= 3) {
            r = parseInt(matches[0]);
            g = parseInt(matches[1]);
            b = parseInt(matches[2]);
          } else {
            // Fallback to intensity-based color
            r = Math.min(255, 100 + (intensity * 155));
            g = Math.min(255, intensity * 255);
            b = Math.min(255, intensity * 100);
          }
        } else {
          // Fallback to intensity-based color
          r = Math.min(255, 100 + (intensity * 155));
          g = Math.min(255, intensity * 255);
          b = Math.min(255, intensity * 100);
        }
        // Adjust brightness based on intensity while maintaining cluster color
        const brightness = 0.5 + (intensity * 0.5);
        r = Math.min(255, r * brightness);
        g = Math.min(255, g * brightness);
        b = Math.min(255, b * brightness);
      } else {
        // Use grayscale brightness scale (dark to white) for spike mode
        const brightness = Math.min(255, intensity * 255);
        r = brightness;
        g = brightness;
        b = brightness;
      }

      // Draw glow
      const gradient = ctx.createRadialGradient(nx, ny, 0, nx, ny, radius * 3);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity * 0.6})`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${intensity * 0.2})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(nx, ny, radius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw main point
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.7 + intensity * 0.3})`;
      ctx.beginPath();
      ctx.arc(nx, ny, radius, 0, Math.PI * 2);
      ctx.fill();

      // Bright center for highly active neurons
      if (intensity > 0.6) {
        ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.9})`;
        ctx.beginPath();
        ctx.arc(nx, ny, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [dataset, currentFrame, backgroundReady, neuronToClusterMap, getClusterColor]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement!);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="bg-amber-900/20 border rounded-lg p-6 flex flex-col h-full" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
      <h3 className="text-xl font-semibold mb-4 text-amber-200 flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>
        SPATIAL ACTIVITY MAP
      </h3>
      
      <div className="relative bg-black rounded-lg overflow-hidden flex-1" style={{ minHeight: '400px' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
        
        {/* Frame indicator */}
        <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded text-xs text-amber-200 z-10" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          Frame: {currentFrame + 1} / {dataset.frames}
        </div>

        {/* Region label */}
        {dataset.metadata?.region && (
          <div className="absolute top-2 left-2 bg-black/80 px-3 py-1.5 rounded text-xs text-amber-200 z-10 border border-amber-600/50" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>
            <div className="text-amber-300/70 text-[10px] mb-0.5" style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.05em' }}>REGION</div>
            <div className="text-amber-200 font-semibold">{dataset.metadata.region}</div>
          </div>
        )}

        {/* Legend - context-aware based on whether clusters are provided */}
        {clusters && clusters.length > 0 && getClusterColor ? (
          <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-amber-200 z-10" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <div className="text-[10px] text-amber-300/70 mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>CLUSTERS</div>
            <div className="flex flex-wrap gap-1.5 max-w-[120px]">
              {clusters.slice(0, 6).map((cluster, idx) => (
                <div key={cluster.id} className="flex items-center gap-1">
                  <div 
                    className="w-2.5 h-2.5 rounded-full border border-amber-600/30" 
                    style={{ backgroundColor: getClusterColor(idx) }}
                  ></div>
                  <span className="text-[9px]">{idx + 1}</span>
                </div>
              ))}
              {clusters.length > 6 && (
                <div className="text-[9px] text-amber-300/50">+{clusters.length - 6}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-amber-200 z-10" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgba(50, 50, 50, 1)' }}></div>
              <span>Low</span>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 1)' }}></div>
              <span>High</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if dataset, frame, or clusters change significantly
  return (
    prevProps.dataset === nextProps.dataset &&
    Math.floor(prevProps.currentFrame / 3) === Math.floor(nextProps.currentFrame / 3) &&
    prevProps.clusters === nextProps.clusters &&
    prevProps.getClusterColor === nextProps.getClusterColor
  );
});

BrainVisualization.displayName = 'BrainVisualization';

export default BrainVisualization;
