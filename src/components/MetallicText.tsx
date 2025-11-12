import { useEffect, useRef } from 'react';

interface MetallicTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

function MetallicText({ text, className = '', style = {} }: MetallicTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Set canvas size
    canvas.width = 32;
    canvas.height = 32;

    // Get WebGL context manager for metallic effect
    const manager = WebGLContextManager.getInstance();
    
    // Create a temporary canvas for the metallic shader
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 32;
    tempCanvas.height = 32;
    
    const renderer = manager.registerCanvas(tempCanvas);

    let animationFrame: number;
    let startTime = Date.now();

    function render() {
      if (!ctx) return;

      const time = (Date.now() - startTime) / 1000.0;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw text with metallic effect
      ctx.save();
      
      // Create metallic gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#ffd700'); // Gold
      gradient.addColorStop(0.3, '#ffed4e'); // Bright gold
      gradient.addColorStop(0.5, '#ffd700'); // Gold
      gradient.addColorStop(0.7, '#daa520'); // Darker gold
      gradient.addColorStop(1, '#ffd700'); // Gold

      ctx.fillStyle = gradient;
      ctx.font = 'bold 7px Bebas Neue';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '0.1em';

      // Draw text with multiple layers for metallic effect
      // Base layer
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);

      // Highlight layer (top-left)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(text, canvas.width / 2 - 0.5, canvas.height / 2 - 0.5);

      // Shadow layer (bottom-right)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillText(text, canvas.width / 2 + 0.5, canvas.height / 2 + 0.5);

      // Main text layer again
      ctx.fillStyle = gradient;
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);

      ctx.restore();

      animationFrame = requestAnimationFrame(render);
    }

    render();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      renderer.cleanup();
    };
  }, [text]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        ...style,
        imageRendering: 'crisp-edges'
      }}
    />
  );
}

export default MetallicText;

