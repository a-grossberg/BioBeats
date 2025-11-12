import { forwardRef, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import WebGLContextManager from '../utils/webglContextManager';
import MetallicTextShader from '../utils/metallicTextShader';

interface MetalButtonProps {
  onClick: () => void;
  disabled: boolean;
  isSelected: boolean;
  isEmpty: boolean;
  isLoading: boolean;
  label: string;
  title: string;
}

const MetalButton = forwardRef<HTMLButtonElement, MetalButtonProps>(
  ({ onClick, disabled, isSelected, isEmpty, isLoading, label, title }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textCanvasRef = useRef<HTMLCanvasElement>(null);
    const [webglReady, setWebglReady] = useState(false);
    const [webglFailed, setWebglFailed] = useState(false);
    const rendererRef = useRef<{ render: (canvas: HTMLCanvasElement, time: number) => void; cleanup: () => void } | null>(null);
    const textAnimationRef = useRef<number | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let mounted = true;

      // Get 2D context for the canvas (we'll copy WebGL output to it)
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) {
        setWebglFailed(true);
        return;
      }

      // Register with shared WebGL context manager
      const manager = WebGLContextManager.getInstance();
      const renderer = manager.registerCanvas(canvas);
      rendererRef.current = renderer;

      // Small delay to ensure canvas is ready
      const initTimeout = setTimeout(() => {
        if (mounted) {
          setWebglReady(true);
        }
      }, 50);

      return () => {
        mounted = false;
        clearTimeout(initTimeout);
        if (rendererRef.current) {
          rendererRef.current.cleanup();
          rendererRef.current = null;
        }
      };
    }, []);

    // Metallic text shader effect
    useEffect(() => {
      if (isEmpty || isLoading) return;

      const textCanvas = textCanvasRef.current;
      if (!textCanvas) return;

      const shader = MetallicTextShader.getInstance();
      let startTime = Date.now();

      function renderText() {
        const time = (Date.now() - startTime) / 1000.0;
        shader.renderMetallicText(textCanvas, label, time);
        textAnimationRef.current = requestAnimationFrame(renderText);
      }

      renderText();

      return () => {
        if (textAnimationRef.current) {
          cancelAnimationFrame(textAnimationRef.current);
        }
      };
    }, [label, isEmpty, isLoading]);

    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        className={`jukebox-wood-button relative w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[8px] transition-all ${
          isSelected ? 'ring-2 ring-amber-400/60 scale-105' : ''
        } ${isEmpty ? 'opacity-40 cursor-not-allowed' : isLoading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          letterSpacing: '0.1em',
          padding: '0',
          overflow: 'visible'
        }}
        title={title}
      >
        {/* WebGL brushed metal outline ring - positioned outside button */}
        <canvas
          ref={canvasRef}
          width={36}
          height={36}
          className="absolute -inset-0.5 rounded-full pointer-events-none"
          style={{
            mixBlendMode: 'normal',
            opacity: webglReady ? 1 : 0,
            zIndex: webglReady ? 2 : 0
          }}
        />
        {/* CSS metal ring - always show, WebGL enhances if available */}
        <div 
          className="absolute -inset-0.5 rounded-full pointer-events-none"
          style={{
            border: 'none',
            borderRadius: '50%',
            boxShadow: `
              0 0 0 1.5px rgba(192, 192, 192, 0.6),
              0 0 0 2px rgba(255, 255, 255, 0.4),
              0 0 2px rgba(192, 192, 192, 0.5),
              inset 0 0 2px rgba(255, 255, 255, 0.3)
            `,
            zIndex: 1,
            opacity: webglReady ? 0.3 : 1
          }}
        />
        {/* Inner content - above canvas */}
        <div className="relative w-full h-full rounded-full flex items-center justify-center" style={{ zIndex: 10 }}>
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
          ) : isEmpty ? (
            <span className="text-gray-500 text-[9px] font-bold">{label}</span>
          ) : (
            <canvas
              ref={textCanvasRef}
              width={32}
              height={32}
              className="w-full h-full"
              style={{
                imageRendering: 'auto'
              }}
            />
          )}
        </div>
      </button>
    );
  }
);

MetalButton.displayName = 'MetalButton';

export default MetalButton;

