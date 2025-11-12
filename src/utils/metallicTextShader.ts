/**
 * Metallic Text Shader Manager
 * Uses WebGL to render metallic text with animated highlights
 */

class MetallicTextShader {
  private static instance: MetallicTextShader | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private textureCache: Map<string, HTMLCanvasElement> = new Map();

  private constructor() {}

  static getInstance(): MetallicTextShader {
    if (!MetallicTextShader.instance) {
      MetallicTextShader.instance = new MetallicTextShader();
    }
    return MetallicTextShader.instance;
  }

  private initWebGL(): boolean {
    if (this.gl && this.program) return true;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false
    });

    if (!gl) return false;

    this.gl = gl;

    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_time;
      uniform vec2 u_resolution;
      varying vec2 v_texCoord;
      
      void main() {
        vec4 texColor = texture2D(u_texture, v_texCoord);
        
        if (texColor.a < 0.1) {
          discard;
        }
        
        // Metallic gold color with animated highlights
        float highlight = sin(v_texCoord.x * 3.0 + u_time * 2.0) * 0.5 + 0.5;
        highlight = pow(highlight, 0.5);
        
        vec3 gold = vec3(1.0, 0.84, 0.0);
        vec3 darkGold = vec3(0.85, 0.65, 0.13);
        vec3 metallic = mix(darkGold, gold, highlight);
        
        // Add shine
        float shine = smoothstep(0.3, 0.7, highlight);
        metallic += vec3(0.2) * shine;
        
        gl_FragColor = vec4(metallic, texColor.a);
      }
    `;

    function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) return false;

    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program error:', gl.getProgramInfoLog(program));
      return false;
    }

    this.program = program;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
  }

  createTextTexture(text: string, fontSize: number = 7): HTMLCanvasElement {
    const cacheKey = `${text}-${fontSize}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px Bebas Neue`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    this.textureCache.set(cacheKey, canvas);
    return canvas;
  }

  renderMetallicText(targetCanvas: HTMLCanvasElement, text: string, time: number): void {
    const ctx = targetCanvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Use device pixel ratio for crisp rendering on retina displays
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 32;
    const displayHeight = 32;
    const width = displayWidth * dpr;
    const height = displayHeight * dpr;
    
    // Set canvas to higher resolution if needed
    if (targetCanvas.width !== width || targetCanvas.height !== height) {
      targetCanvas.width = width;
      targetCanvas.height = height;
      targetCanvas.style.width = `${displayWidth}px`;
      targetCanvas.style.height = `${displayHeight}px`;
    }
    
    ctx.clearRect(0, 0, width, height);

    // Enable crisp text rendering
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Create metallic gradient with animated highlight (use actual canvas dimensions)
    const highlightPos = (Math.sin(time * 2.0) + 1) / 2;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ffd700');
    gradient.addColorStop(Math.max(0, highlightPos - 0.2), '#daa520');
    gradient.addColorStop(highlightPos, '#ffed4e');
    gradient.addColorStop(Math.min(1, highlightPos + 0.2), '#daa520');
    gradient.addColorStop(1, '#ffd700');

    // Draw text with metallic effect - use actual canvas center and scale font
    ctx.save();
    ctx.font = `bold ${9 * dpr}px Bebas Neue`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = `${0.1 * dpr}em`;

    const centerX = Math.round(width / 2);
    const centerY = Math.round(height / 2);

    // Shadow layer for depth
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(text, centerX + dpr, centerY + dpr);

    // Main metallic text
    ctx.fillStyle = gradient;
    ctx.fillText(text, centerX, centerY);

    // Highlight layer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText(text, centerX - 0.5 * dpr, centerY - 0.5 * dpr);

    ctx.restore();
  }
}

export default MetallicTextShader;

