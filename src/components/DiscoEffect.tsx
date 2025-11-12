import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface DiscoEffectProps {
  isHovering: boolean;
}

const DiscoEffect = ({ isHovering }: DiscoEffectProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    material: THREE.ShaderMaterial;
    mesh: THREE.Mesh;
    animationId: number | null;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Scene setup
    const scene = new THREE.Scene();
    
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    const updateSize = () => {
      if (!containerRef.current) return { width: 800, height: 600 };
      const rect = containerRef.current.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    };
    
    const size = updateSize();
    renderer.setSize(size.width, size.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'none';

    // Create noise texture for iChannel0
    const createNoiseTexture = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(size, size);
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const value = Math.random() * 255;
        imageData.data[i] = value;
        imageData.data[i + 1] = value;
        imageData.data[i + 2] = value;
        imageData.data[i + 3] = 255;
      }
      
      ctx.putImageData(imageData, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      return texture;
    };

    // Create checkerboard texture for iChannel1
    const createCheckerTexture = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      
      const tileSize = 32;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const tileX = Math.floor(x / tileSize);
          const tileY = Math.floor(y / tileSize);
          const isWhite = (tileX + tileY) % 2 === 0;
          ctx.fillStyle = isWhite ? '#ffffff' : '#000000';
          ctx.fillRect(x, y, 1, 1);
        }
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      return texture;
    };

    const noiseTexture = createNoiseTexture();
    const checkerTexture = createCheckerTexture();

    // Shader code
    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float iTime;
      uniform vec2 iResolution;
      uniform sampler2D iChannel0;
      uniform sampler2D iChannel1;
      uniform float opacity;

      const float EXPOSURE = 6.0;
      const float OMNI_LIGHT = 0.04;
      const float FLOOR_REFLECTION = 0.08;
      const int NUM_LIGHTS = 10;
      const float PI = 3.1415926535897932384626433832795;
      const float TAU = 2.0 * PI;
      const float BIG = 1e30;
      const float EPSILON = 1e-10;
      const float THETA = (1.0 + 2.2360679775) / 2.0;
      const float INV_THETA = 1.0 / THETA;

      struct Ray {
        vec3 o;
        vec3 d;
      };

      struct Intersection {
        float dist;
        vec3 normal;
      };

      struct Result {
        Intersection start;
        Intersection end;
      };

      struct Range {
        float start;
        float end;
      };

      struct Light {
        vec3 d;
        vec3 c;
        float a;
      };

      Light lights[NUM_LIGHTS];

      mat4 rotateX(float v) {
        float c = cos(v);
        float s = sin(v);
        return mat4(
          1.0, 0.0, 0.0, 0.0,
          0.0,   c,   s, 0.0,
          0.0,  -s,   c, 0.0,
          0.0, 0.0, 0.0, 1.0
        );
      }

      mat4 rotateY(float v) {
        float c = cos(v);
        float s = sin(v);
        return mat4(
            c, 0.0,  -s, 0.0,
          0.0, 1.0, 0.0, 0.0,
            s, 0.0,   c, 0.0,
          0.0, 0.0, 0.0, 1.0
        );
      }

      mat4 rotateZ(float v) {
        float c = cos(v);
        float s = sin(v);
        return mat4(
            c,   s, 0.0, 0.0,
           -s,   c, 0.0, 0.0,
          0.0, 0.0, 1.0, 0.0,
          0.0, 0.0, 0.0, 1.0
        );
      }

      float insideCone(vec3 direction, float angle, vec3 o) {
        float oz = dot(o, direction);
        vec3 oxy = o - direction * oz;
        float c = dot(oxy, oxy) / (angle * angle) - (oz * oz);
        return smoothstep(20.0, -50.0, c);
      }

      Range cone(vec3 direction, float angle, Ray ray) {
        float dz = dot(ray.d, direction);
        float oz = dot(ray.o, direction);
        vec3 dxy = ray.d - direction * dz;
        vec3 oxy = ray.o - direction * oz;

        float a = dot(dxy, dxy) - (dz * dz * angle * angle);
        float b = dot(dxy, oxy) - (dz * oz * angle * angle);
        float c = dot(oxy, oxy) - (oz * oz * angle * angle);

        float p = 2.0 * b / a;
        float q = c / a;
        float r = p * p / 4.0 - q;

        Range result;
        result.start = BIG;
        result.end = -BIG;

        if (r >= 0.0) {
          float m = -p / 2.0;
          float sr = sqrt(r);

          if (c < 0.0) {
            if (m + sr < 0.0) {
              result.start = 0.0;
              result.end = BIG;
            } else if (m - sr < 0.0) {
              result.start = 0.0;
              result.end = m + sr;
            } else {
              result.start = 0.0;
              result.end = m - sr;
            }
          } else {
            if (m + sr < 0.0) {
              return result;
            } else if (m - sr < 0.0) {
              result.start = m + sr;
              result.end = BIG;
            } else {
              result.start = m - sr;
              result.end = m + sr;
            }
          }
        }
        return result;
      }

      Result plane(vec3 pos, vec3 normal, Ray ray) {
        ray.o -= pos;
        float rdn = dot(ray.d, normal);
        float ron = dot(ray.o, normal);

        Result result;
        result.start.normal = normal;
        result.end.normal = normal;

        if (ron > 0.0) {
          result.start.dist = BIG;
          result.end.dist = -BIG;
          if (abs(rdn) > EPSILON) {
            float d = -ron / rdn;
            if (d > 0.0) {
              result.start.dist = d;
              result.end.dist = BIG;
            } else {
              result.start.dist = -BIG;
              result.end.dist = d;
            }
          }
        } else {
          result.start.dist = -BIG;
          result.end.dist = BIG;
          if (abs(rdn) > EPSILON) {
            float d = -ron / rdn;
            if (d > 0.0) {
              result.start.dist = -BIG;
              result.end.dist = d;
            } else {
              result.start.dist = d;
              result.end.dist = BIG;
            }
          }
        }
        return result;
      }

      float inverseSquare(vec3 p) {
        return 1.0 / dot(p, p);
      }

      float inverseSquareAntiderivative(Ray ray, float t) {
        vec3 o = ray.o;
        vec3 d = ray.d;
        float a = t * dot(d, d) + dot(d, o);
        float b1 = d.x * d.x * dot(o.yz, o.yz);
        float b2 = 2.0 * d.x * o.x * dot(o.yz, d.yz);
        float b3 = o.x * o.x * dot(d.yz, d.yz);
        float b4 = (o.y * d.z - d.y * o.z) * (o.y * d.z - d.y * o.z);
        float b = sqrt(b1 - b2 + b3 + b4);
        return atan(a / b) / b;
      }

      float inverseSquareIntegral(Ray ray, float start, float end) {
        return inverseSquareAntiderivative(ray, end) - inverseSquareAntiderivative(ray, start);
      }

      vec3 getLight(vec3 pos) {
        vec3 color = vec3(inverseSquare(pos) * OMNI_LIGHT * 2.0);
        for (int i = 0; i < NUM_LIGHTS; i++) {
          color += lights[i].c * inverseSquare(pos) * insideCone(lights[i].d, lights[i].a, pos);
        }
        return color;
      }

      vec3 renderVolumetric(Ray ray, float maxDist) {
        vec3 color = vec3(inverseSquareIntegral(ray, 0.0, maxDist) * OMNI_LIGHT);

        for (int i = 0; i < NUM_LIGHTS; i++) {
          Range r = cone(lights[i].d, lights[i].a, ray);
          r.end = min(r.end, maxDist);

          if (r.end > r.start) {
            float boost = mix(1.0, 18.0, insideCone(lights[i].d, lights[i].a, ray.o));
            color += inverseSquareIntegral(ray, r.start, r.end) * lights[i].c * boost;
          }
        }
        return color;
      }

      vec3 floorTexture(vec3 pos) {
        pos.z += pos.x * 0.25;
        return fract(pos.x * 0.1) > fract(pos.z * 0.1) ? vec3(1.0) : vec3(0.7);
      }

      float floorGloss(vec3 pos) {
        pos.x += pos.z * 2.0;
        return texture2D(iChannel1, pos.xz * 0.2).x * 0.5 + 0.75;
      }

      vec3 renderScene(Ray ray) {
        // Floor positioned lower, lights come from above
        Result r = plane(vec3(0.0, -10.0, 0.0), vec3(0.0, 1.0, 0.0), ray);

        if (r.start.dist > 0.0 && r.start.dist < r.end.dist) {
          vec3 pos = ray.o + ray.d * r.start.dist;
          Ray reflectedRay;
          reflectedRay.o = pos;
          reflectedRay.d = ray.d * vec3(1, -1, 1);

          vec3 volumetric = renderVolumetric(ray, r.start.dist);
          vec3 reflectedVolumetric = renderVolumetric(reflectedRay, BIG);

          vec3 color = -normalize(pos).y * getLight(pos) * 30.0 * floorTexture(pos);
          float gloss = floorGloss(pos);

          return volumetric + mix(color, reflectedVolumetric, FLOOR_REFLECTION * gloss);
        } else {
          return renderVolumetric(ray, BIG);
        }
      }

      vec3 toneMap(vec3 color) {
        return 1.0 - exp(-color * EXPOSURE);
      }

      void setUpLights() {
        // Rotate lights so they point downward from above
        mat4 m = rotateX(TAU * iTime * 0.05 + PI * 0.5) * rotateY(TAU * iTime * 0.09);

        lights[0].d = normalize((m * vec4(1, 1, 1, 0)).xyz);
        lights[1].d = normalize((m * m * vec4(1, 1, -1, 0)).xyz);
        lights[2].d = normalize((m * vec4(1, -1, 1, 0)).xyz);
        lights[3].d = normalize((m * m * vec4(1, -1, -1, 0)).xyz);
        lights[4].d = normalize((m * vec4(0, INV_THETA, THETA, 0)).xyz);
        lights[5].d = normalize((m * m * vec4(0, INV_THETA, -THETA, 0)).xyz);
        lights[6].d = normalize((m * vec4(INV_THETA, THETA, 0, 0)).xyz);
        lights[7].d = normalize((m * m * vec4(INV_THETA, -THETA, 0, 0)).xyz);
        lights[8].d = normalize((m * vec4(THETA, 0, INV_THETA, 0)).xyz);
        lights[9].d = normalize((m * m * vec4(-THETA, 0, INV_THETA, 0)).xyz);
        
        // Ensure all lights point downward (negative Y)
        for (int i = 0; i < NUM_LIGHTS; i++) {
          if (lights[i].d.y > 0.0) {
            lights[i].d.y = -lights[i].d.y;
          }
        }

        lights[0].c = normalize(vec3(1, 1, 1) * 0.5 + 0.7);
        lights[1].c = normalize(vec3(1, 1, -1) * 0.5 + 0.7);
        lights[2].c = normalize(vec3(1, -1, 1) * 0.5 + 0.7);
        lights[3].c = normalize(vec3(1, -1, -1) * 0.5 + 0.7);
        lights[4].c = normalize(vec3(0, INV_THETA, THETA) * 0.5 + 0.7);
        lights[5].c = normalize(vec3(0, INV_THETA, -THETA) * 0.5 + 0.7);
        lights[6].c = normalize(vec3(INV_THETA, THETA, 0) * 0.5 + 0.7);
        lights[7].c = normalize(vec3(INV_THETA, -THETA, 0) * 0.5 + 0.7);
        lights[8].c = normalize(vec3(THETA, 0, INV_THETA) * 0.5 + 0.7);
        lights[9].c = normalize(vec3(-THETA, 0, INV_THETA) * 0.5 + 0.7);

        for (int i = 0; i < NUM_LIGHTS; i++) {
          lights[i].a = texture2D(iChannel0, vec2(float(i) * 0.18, 0.0)).x * 0.3 + 0.05;
        }
      }

      void main() {
        setUpLights();

        Ray ray;
        // Camera positioned high above, centered, looking straight down
        ray.o = vec3(sin(iTime * 0.5) * 2.0, 15.0, -18.0);
        // Ray direction pointing downward and forward
        vec2 uv = (gl_FragCoord.xy - iResolution.xy * 0.5) / iResolution.y;
        ray.d = normalize(vec3(uv.x * 0.5, -0.8, 0.6 + uv.y * 0.3));

        vec3 color = renderScene(ray);
        color = toneMap(color);
        gl_FragColor = vec4(color, opacity);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(size.width, size.height) },
        iChannel0: { value: noiseTexture },
        iChannel1: { value: checkerTexture },
        opacity: { value: 0 }
      },
      transparent: true,
      blending: THREE.NormalBlending
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Animation
    let startTime = Date.now();
    let targetOpacity = 0;
    let currentOpacity = 0;

    const animate = () => {
      const id = requestAnimationFrame(animate);
      if (sceneRef.current) {
        sceneRef.current.animationId = id;
      }

      const elapsed = (Date.now() - startTime) / 1000;
      material.uniforms.iTime.value = elapsed;

      // Smooth opacity transition - more subtle
      targetOpacity = isHovering ? 0.2 : 0;
      const diff = targetOpacity - currentOpacity;
      currentOpacity += diff * 0.1;
      material.uniforms.opacity.value = currentOpacity;

      renderer.render(scene, camera);
    };

    animate();

    sceneRef.current = { scene, camera, renderer, material, mesh, animationId: null };

    const handleResize = () => {
      if (!containerRef.current) return;
      const size = updateSize();
      camera.left = -1;
      camera.right = 1;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      renderer.setSize(size.width, size.height);
      material.uniforms.iResolution.value.set(size.width, size.height);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        if (sceneRef.current.animationId) {
          cancelAnimationFrame(sceneRef.current.animationId);
        }
        sceneRef.current.renderer.dispose();
        sceneRef.current.material.dispose();
        sceneRef.current.mesh.geometry.dispose();
        noiseTexture.dispose();
        checkerTexture.dispose();
        if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, [isHovering]);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 2,
        width: '100vw',
        height: '100vh'
      }}
    />
  );
};

export default DiscoEffect;

