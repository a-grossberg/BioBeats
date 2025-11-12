/**
 * Shared WebGL Context Manager
 * Manages a single WebGL context to render metal ring effects for all buttons
 * This avoids browser WebGL context limits (typically 16 contexts)
 */

interface MetalRingRenderer {
  render: (canvas: HTMLCanvasElement, time: number) => void;
  cleanup: () => void;
}

class WebGLContextManager {
  private static instance: WebGLContextManager | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private positionLocation: number = -1;
  private timeLocation: WebGLUniformLocation | null = null;
  private resolutionLocation: WebGLUniformLocation | null = null;
  private startTime: number = Date.now();
  private animationFrame: number | null = null;
  private activeCanvases: Set<HTMLCanvasElement> = new Set();
  private isRendering: boolean = false;

  private constructor() {}

  static getInstance(): WebGLContextManager {
    if (!WebGLContextManager.instance) {
      WebGLContextManager.instance = new WebGLContextManager();
    }
    return WebGLContextManager.instance;
  }

  private initWebGL(): boolean {
    if (this.gl && this.program) return true;

    // Create a hidden canvas for the shared WebGL context
    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 36;
    
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false
    }) || canvas.getContext('experimental-webgl', {
      alpha: true,
      premultipliedAlpha: false
    });

    if (!gl) {
      console.warn('WebGL not supported');
      return false;
    }

    this.gl = gl;

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_uv = (a_position + 1.0) * 0.5;
      }
    `;

    // Fragment shader for brushed metal
    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_resolution;
      
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }
      
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      
      void main() {
        vec2 uv = v_uv * u_resolution;
        vec2 center = u_resolution * 0.5;
        float dist = distance(uv, center);
        float radius = min(u_resolution.x, u_resolution.y) * 0.5;
        
        // Create ring outline (only show pixels near the edge)
        float ringWidth = 3.0;
        float innerRadius = radius - ringWidth;
        float outerRadius = radius + ringWidth;
        
        // Only render if we're in the ring area
        if (dist < innerRadius || dist > outerRadius) {
          discard;
          return;
        }
        
        // Create smooth ring fade
        float ring = smoothstep(innerRadius, radius, dist) * (1.0 - smoothstep(radius, outerRadius, dist));
        
        // Brushed metal effect - horizontal streaks
        float brush = noise(vec2(uv.x * 0.15, uv.y * 25.0 + u_time * 0.03));
        brush = pow(brush, 0.3);
        
        // Add some variation
        float variation = noise(vec2(uv.x * 0.08, uv.y * 0.6));
        brush = mix(brush, variation, 0.25);
        
        // Metal color gradient (silver to darker)
        vec3 metalColor = vec3(0.9, 0.9, 0.92);
        vec3 darkMetal = vec3(0.6, 0.6, 0.63);
        vec3 color = mix(darkMetal, metalColor, brush);
        
        // Add shine/highlight
        float shine = smoothstep(0.25, 0.75, brush);
        color += vec3(0.12) * shine;
        
        gl_FragColor = vec4(color, ring);
      }
    `;

    function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
      }
      return program;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) {
      return false;
    }

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
      return false;
    }

    this.program = program;

    // Setup geometry (full screen quad)
    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) return false;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    this.positionBuffer = positionBuffer;
    this.positionLocation = gl.getAttribLocation(program, 'a_position');
    this.timeLocation = gl.getUniformLocation(program, 'u_time');
    this.resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);

    return true;
  }

  registerCanvas(canvas: HTMLCanvasElement): MetalRingRenderer {
    if (!this.initWebGL()) {
      return {
        render: () => {},
        cleanup: () => {}
      };
    }

    this.activeCanvases.add(canvas);

    if (!this.isRendering) {
      this.startRendering();
    }

    return {
      render: (targetCanvas: HTMLCanvasElement, time: number) => {
        this.renderToCanvas(targetCanvas, time);
      },
      cleanup: () => {
        this.activeCanvases.delete(canvas);
        if (this.activeCanvases.size === 0) {
          this.stopRendering();
        }
      }
    };
  }

  private renderToCanvas(targetCanvas: HTMLCanvasElement, time: number): void {
    if (!this.gl || !this.program) return;

    const gl = this.gl;
    const ctx2d = targetCanvas.getContext('2d', { alpha: true });
    if (!ctx2d) return;

    // Get the WebGL canvas
    const webglCanvas = gl.canvas as HTMLCanvasElement;

    // Render to our shared WebGL context
    gl.viewport(0, 0, 36, 36);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    // Set up attributes
    gl.enableVertexAttribArray(this.positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms
    gl.uniform1f(this.timeLocation, time);
    gl.uniform2f(this.resolutionLocation, 36, 36);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Copy WebGL output to target canvas using 2D context
    ctx2d.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }

  private startRendering(): void {
    if (this.isRendering) return;
    this.isRendering = true;
    this.startTime = Date.now();

    const render = () => {
      if (!this.isRendering || this.activeCanvases.size === 0) {
        this.stopRendering();
        return;
      }

      const time = (Date.now() - this.startTime) / 1000.0;
      
      // Render to all active canvases
      this.activeCanvases.forEach(canvas => {
        this.renderToCanvas(canvas, time);
      });

      this.animationFrame = requestAnimationFrame(render);
    };

    render();
  }

  private stopRendering(): void {
    this.isRendering = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  cleanup(): void {
    this.stopRendering();
    this.activeCanvases.clear();
    
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.gl && this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }
    this.gl = null;
  }
}

export default WebGLContextManager;

