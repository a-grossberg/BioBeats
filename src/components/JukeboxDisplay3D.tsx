import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface JukeboxDisplay3DProps {
  imageUrl?: string;
  width?: number;
  height?: number;
}

const JukeboxDisplay3D = ({ 
  imageUrl = 'https://picsum.photos/id/95/1200',
  width = 600,
  height = 200
}: JukeboxDisplay3DProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    mesh: THREE.Mesh;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    // Get actual container size
    const updateSize = () => {
      if (!containerRef.current) return { width, height };
      const rect = containerRef.current.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    };
    
    const size = updateSize();
    renderer.setSize(size.width, size.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    
    // Style the canvas
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    // Lighting setup for photorealistic rendering
    // Key light (main light from top-left)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(-5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);

    // Fill light (softer light from right)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(5, 3, 3);
    scene.add(fillLight);

    // Rim light (edge highlight)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 5, -5);
    scene.add(rimLight);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Load image texture
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(
      imageUrl,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
      },
      undefined,
      (error) => {
        console.error('Error loading texture:', error);
      }
    );

    // Create curved surface (semi-circular dome) - only top half of sphere
    const geometry = new THREE.SphereGeometry(
      2.5,  // radius
      64,   // width segments
      32,   // height segments
      0,    // phi start
      Math.PI * 2,  // phi length (full circle)
      Math.PI / 2,  // theta start (top half)
      Math.PI / 2   // theta length (half sphere)
    );
    
    // Glass material with realistic properties
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transmission: 0.95, // High transmission for glass
      thickness: 0.3,
      ior: 1.5, // Index of refraction for glass
      side: THREE.DoubleSide,
      envMapIntensity: 1.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI; // Flip to show the dome correctly
    mesh.position.y = -0.5; // Position slightly lower
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Create environment map for realistic reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    // Create a gradient environment
    const envSize = 256;
    const canvas = document.createElement('canvas');
    canvas.width = envSize;
    canvas.height = envSize;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, envSize);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#cccccc');
    gradient.addColorStop(1, '#888888');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, envSize, envSize);
    
    const envTexture = new THREE.CanvasTexture(canvas);
    envTexture.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmremGenerator.fromEquirectangular(envTexture).texture;
    scene.environment = envMap;
    material.envMap = envMap;
    pmremGenerator.dispose();
    envTexture.dispose();

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Subtle camera movement for parallax effect
      const time = Date.now() * 0.0005;
      camera.position.x = Math.sin(time * 0.5) * 0.3;
      camera.position.y = Math.cos(time * 0.3) * 0.2;
      camera.lookAt(0, 0, 0);
      
      renderer.render(scene, camera);
    };
    animate();

    // Store refs for cleanup
    sceneRef.current = { scene, camera, renderer, mesh };

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = rect.width;
      const newHeight = rect.height;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);
    
    // Initial size update
    handleResize();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        sceneRef.current.renderer.dispose();
        sceneRef.current.mesh.geometry.dispose();
        if (sceneRef.current.mesh.material instanceof THREE.Material) {
          sceneRef.current.mesh.material.dispose();
        }
        if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, [imageUrl, width, height]);

  return (
    <div 
      ref={containerRef} 
      className="jukebox-3d-display"
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1,
        pointerEvents: 'none',
        borderRadius: '300px 300px 0 0',
        overflow: 'hidden'
      }} 
    />
  );
};

export default JukeboxDisplay3D;

