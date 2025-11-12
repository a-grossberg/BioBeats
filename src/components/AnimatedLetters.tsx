import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

interface AnimatedLettersProps {
  isHovering: boolean;
  onEnter: () => void;
  audioData?: { bassLevel: number; midLevel: number; trebleLevel: number; overallVolume: number };
  trackIndex?: number;
}

const AnimatedLetters = ({ isHovering, onEnter, audioData, trackIndex = 0 }: AnimatedLettersProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isHoveringRef = useRef(isHovering);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    letters: THREE.Mesh[];
    animationId: number | null;
  } | null>(null);
  
  // Update ref when isHovering changes
  useEffect(() => {
    isHoveringRef.current = isHovering;
  }, [isHovering]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 0, 50);
    
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 6);
    camera.lookAt(0, -1, 0);

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    const updateSize = () => {
      if (!containerRef.current) return { width: 400, height: 400 };
      const rect = containerRef.current.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    };
    
    // Initialize renderer - ensure container has dimensions
    const size = updateSize();
    const width = Math.max(size.width || 800, 400);
    const height = Math.max(size.height || 600, 300);
    
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'none';

    // Debug: Log scene creation
    console.log('AnimatedLetters: Scene created, container size:', width, height, 'isHovering:', isHoveringRef.current);

    const text = "ENTER JUKEBOX →";
    const letters: THREE.Mesh[] = [];
    
    // Color palette for different tracks - 1940's jukebox colors
    const trackColors = [
      '#eab308', // Track 0: Amber (default)
      '#E90A49', // Track 1: Amaranth pink
      '#D7AF28', // Track 2: Gold metallic
      '#A3B499', // Track 3: Cambridge blue
    ];
    
    const getTrackColor = (index: number) => trackColors[index % trackColors.length];

    // Create 3D letter with proper character rendering - simpler, more classic style
    const createLetterMesh = (char: string, index: number, color: string): THREE.Mesh => {
      // Create letter texture from canvas with proper character
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Classic 1940's style - bold, clean lettering with subtle glow
      ctx.font = 'bold 380px Bebas Neue, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Subtle outer glow for classic neon sign effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 30;
      ctx.fillStyle = color;
      ctx.fillText(char, canvas.width / 2, canvas.height / 2);
      
      // Main letter
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.fillText(char, canvas.width / 2, canvas.height / 2);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      
      // Create letter plane
      const geometry = new THREE.PlaneGeometry(0.4, 0.6);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.originalTexture = texture; // Store for color updates
      mesh.userData.canvas = canvas; // Store canvas for updates
      mesh.userData.ctx = ctx; // Store context for updates
      mesh.userData.char = char; // Store character for updates
      
      return mesh;
    };

    // Create letters in order (no shuffling - classic marquee style)
    const currentColor = getTrackColor(trackIndex);
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === ' ') continue; // Skip spaces
      
      const letter = createLetterMesh(char, i, currentColor);
      
      // Calculate final position in a horizontal line
      const totalLetters = text.replace(/\s/g, '').length;
      const letterIndex = text.substring(0, i).replace(/\s/g, '').length;
      const targetX = (letterIndex - totalLetters / 2) * 0.45;
      const targetY = -2.5;
      
      letter.userData = {
        char,
        index: i,
        letterIndex,
        targetX,
        targetY,
        targetZ: 0,
        appearDelay: letterIndex * 0.15, // Sequential appearance like marquee
        appearTime: 0,
        state: 'hidden' as 'hidden' | 'appearing' | 'dancing',
        baseY: targetY,
        dancePhase: Math.random() * Math.PI * 2, // Random phase for varied dance
        currentTrackIndex: trackIndex // Track which track this letter was created for
      };
      
      // Start hidden and positioned
      letter.visible = false;
      letter.position.set(targetX, targetY - 0.5, 0); // Start slightly below
      letter.scale.setScalar(0);
      scene.add(letter);
      letters.push(letter);
    }
    
    // Debug: Log letters creation
    console.log('AnimatedLetters: Created', letters.length, 'letters, isHovering:', isHoveringRef.current);

    // Animation variables
    let animationTime = 0;
    let mousePosition = new THREE.Vector2(0, 0);
    let isHoveringButton = false;
    let lastIsHovering = isHoveringRef.current; // Track previous state

    // Track mouse position for hover detection
    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mousePosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mousePosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);

    // Animation loop - simpler 1940's style
    const animate = () => {
      const id = requestAnimationFrame(animate);
      
      if (sceneRef.current) {
        sceneRef.current.animationId = id;
      }
      
      animationTime += 0.016; // ~60fps
      const time = animationTime;

      // Get current isHovering value from ref
      const currentIsHovering = isHoveringRef.current;

      // Reset appearTime when isHovering changes from false to true
      if (currentIsHovering && !lastIsHovering) {
        console.log('AnimatedLetters: isHovering became true, resetting appearTime');
        letters.forEach((letter) => {
          if (letter.userData.state === 'hidden') {
            letter.userData.appearTime = 0; // Reset to trigger appearance
          }
        });
      }
      lastIsHovering = currentIsHovering;

      // Get audio data for music-reactive dancing
      const bass = audioData?.bassLevel || 0;
      const mid = audioData?.midLevel || 0;
      const treble = audioData?.trebleLevel || 0;
      const overallVolume = audioData?.overallVolume || 0;
      // Normalize values (they're 0-255) and combine for music intensity
      const musicIntensity = Math.min(1, ((bass / 255) + (mid / 255) + (treble / 255)) / 3) * overallVolume;
      
      // Check for mouse hover on button area
      const buttonPlane = scene.children.find(child => 
        child instanceof THREE.Mesh && child.userData.isButton
      ) as THREE.Mesh | undefined;
      
      if (buttonPlane) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mousePosition, camera);
        const buttonIntersects = raycaster.intersectObject(buttonPlane);
        isHoveringButton = buttonIntersects.length > 0;
      }
      
      letters.forEach((letter, i) => {
        const data = letter.userData;
        
        // Get current isHovering value from ref
        const currentIsHovering = isHoveringRef.current;
        
        // Only animate if should show animation
        if (!currentIsHovering) {
          if (data.state !== 'hidden') {
            data.state = 'hidden';
            data.appearTime = 0;
            letter.visible = false;
            letter.scale.setScalar(0);
          }
          return;
        }
        
        // Phase 1: Sequential appearance (classic marquee style)
        if (data.state === 'hidden') {
          // Initialize appearTime on first frame when isHovering becomes true
          // Only set it if it's still 0 (hasn't been initialized yet)
          if (data.appearTime === 0 && currentIsHovering) {
            data.appearTime = time;
            console.log(`AnimatedLetters: Letter ${i} (${data.char}) initialized appearTime at`, time, 'delay:', data.appearDelay);
          }
          
          // Wait for delay before appearing
          if (data.appearTime > 0) {
            const elapsed = time - data.appearTime;
            if (elapsed >= data.appearDelay) {
              data.state = 'appearing';
            letter.visible = true;
              console.log(`AnimatedLetters: Letter ${i} (${data.char}) appearing at time`, time, 'elapsed:', elapsed);
            } else {
              // Keep hidden while waiting
              letter.visible = false;
              return;
            }
          } else {
            // Not started yet, keep hidden
            letter.visible = false;
            return;
          }
        }
        
        // Phase 2: Smooth appearance with scale and fade
        if (data.state === 'appearing') {
          const appearProgress = Math.min(1, (time - data.appearTime - data.appearDelay) / 0.5); // 0.5s to appear
          
          // Scale up from 0 to 1 with ease-out
          const easeOut = 1 - Math.pow(1 - appearProgress, 3);
          letter.scale.setScalar(easeOut);
          
          // Fade in
          if (letter.material instanceof THREE.MeshBasicMaterial) {
            letter.material.opacity = easeOut * 0.95;
          }
          
          // Slide up from below
          const startY = data.targetY - 0.5;
          letter.position.y = startY + (data.targetY - startY) * easeOut;
          letter.position.x = data.targetX;
          
          if (appearProgress >= 1) {
            data.state = 'dancing';
          }
        }
        
        // Phase 3: Dance to the music (1940's jukebox style)
        if (data.state === 'dancing') {
          // Update color if track changed (without reappearing)
          if (data.currentTrackIndex !== trackIndex) {
            const newColor = getTrackColor(trackIndex);
            data.currentTrackIndex = trackIndex;
            
            // Update the texture with new color
            if (letter.userData.canvas && letter.userData.ctx) {
              const canvas = letter.userData.canvas;
              const ctx = letter.userData.ctx;
              const char = letter.userData.char || data.char;
              
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.font = 'bold 380px Bebas Neue, Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              ctx.shadowColor = newColor;
              ctx.shadowBlur = 30;
              ctx.fillStyle = newColor;
              ctx.fillText(char, canvas.width / 2, canvas.height / 2);
              
              ctx.shadowBlur = 0;
              ctx.fillStyle = newColor;
              ctx.fillText(char, canvas.width / 2, canvas.height / 2);
              
              if (letter.userData.originalTexture) {
                letter.userData.originalTexture.needsUpdate = true;
              }
            }
          }
          
          // Different dance styles based on track
          let bounceAmount, bounceSpeed, swayAmount, swaySpeed, pulseSpeed, pulseAmount;
          
          switch (trackIndex % 4) {
            case 0: // Track 1 - Classic bounce
              bounceAmount = musicIntensity * 0.4 + 0.1;
              bounceSpeed = 5;
              swayAmount = 0.05 + musicIntensity * 0.1;
              swaySpeed = 2.5;
              pulseSpeed = 3;
              pulseAmount = 0.05;
              break;
            case 1: // Track 2 - Energetic vertical
              bounceAmount = musicIntensity * 0.6 + 0.15;
              bounceSpeed = 6;
              swayAmount = 0.03 + musicIntensity * 0.08;
              swaySpeed = 3;
              pulseSpeed = 4;
              pulseAmount = 0.08;
              break;
            case 2: // Track 3 - Smooth sway
              bounceAmount = musicIntensity * 0.3 + 0.08;
              bounceSpeed = 4;
              swayAmount = 0.08 + musicIntensity * 0.15;
              swaySpeed = 2;
              pulseSpeed = 2.5;
              pulseAmount = 0.06;
              break;
            case 3: // Track 4 - Gentle pulse
              bounceAmount = musicIntensity * 0.35 + 0.12;
              bounceSpeed = 4.5;
              swayAmount = 0.04 + musicIntensity * 0.12;
              swaySpeed = 2.8;
              pulseSpeed = 3.5;
              pulseAmount = 0.1;
              break;
            default:
              bounceAmount = musicIntensity * 0.4 + 0.1;
              bounceSpeed = 5;
              swayAmount = 0.05 + musicIntensity * 0.1;
              swaySpeed = 2.5;
              pulseSpeed = 3;
              pulseAmount = 0.05;
          }
          
          const bounce = Math.sin(time * bounceSpeed + data.dancePhase) * bounceAmount;
          const sway = Math.sin(time * swaySpeed + data.dancePhase * 0.5) * swayAmount;
          const basePulse = 1 + Math.sin(time * pulseSpeed + data.dancePhase) * pulseAmount;
          const musicPulse = 1 + musicIntensity * 0.15;
          const pulse = basePulse * musicPulse;
          
          letter.position.set(
            data.targetX + sway,
            data.baseY + bounce,
            data.targetZ
          );
          
          letter.scale.setScalar(pulse);
          
          // Face camera
          letter.lookAt(camera.position);
          
          // Hover effects: scale up and brighten
          if (isHoveringButton) {
            letter.scale.multiplyScalar(1.1);
        if (letter.material instanceof THREE.MeshBasicMaterial) {
              letter.material.opacity = 1.0;
        }
          } else {
            if (letter.material instanceof THREE.MeshBasicMaterial) {
              letter.material.opacity = 0.95;
            }
          }
        }
      });
      
      renderer.render(scene, camera);
      
      // Debug: Log render calls occasionally (once per second)
      if (Math.floor(time * 60) % 60 === 0 && time > 0) {
        const visibleLetters = letters.filter(l => l.visible).length;
        if (visibleLetters > 0 || currentIsHovering) {
          console.log('AnimatedLetters: Rendering, visible letters:', visibleLetters, 'isHovering:', currentIsHovering, 'time:', time.toFixed(2));
        }
      }
    };
    
    animate();

    // Store refs for cleanup
    sceneRef.current = { scene, camera, renderer, letters, animationId: null };

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const size = updateSize();
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();
      renderer.setSize(size.width, size.height);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    // No button background - letters will change color/scale on hover instead
    
    // Create invisible clickable plane for button area
    const buttonPlaneGeometry = new THREE.PlaneGeometry(5, 1);
    const buttonPlaneMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      transparent: true,
      opacity: 0
    });
    const buttonPlane = new THREE.Mesh(buttonPlaneGeometry, buttonPlaneMaterial);
    buttonPlane.position.set(0, -2.5, 0);
    buttonPlane.userData.isButton = true;
    scene.add(buttonPlane);
    
    // Make letters clickable when formed
    const handleClick = (event: MouseEvent) => {
      if (!sceneRef.current) return;
      
      const mouse = new THREE.Vector2();
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      
      // Check if clicking on button area
      const buttonIntersects = raycaster.intersectObject(buttonPlane);
      if (buttonIntersects.length > 0) {
        // Check if all letters are formed
        const allFormed = letters.every(letter => letter.userData.state === 'formed');
        if (allFormed) {
          onEnter();
          return;
        }
      }
      
      // Also check individual letters
      const intersects = raycaster.intersectObjects(letters);
      if (intersects.length > 0) {
        const letter = intersects[0].object as THREE.Mesh;
        if (letter.userData.state === 'formed') {
          onEnter();
        }
      }
    };
    
    renderer.domElement.style.pointerEvents = 'auto';
    renderer.domElement.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      if (sceneRef.current) {
        if (sceneRef.current.animationId) {
          cancelAnimationFrame(sceneRef.current.animationId);
        }
        sceneRef.current.renderer.dispose();
        
        sceneRef.current.letters.forEach((letter) => {
          letter.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => {
                  if (m instanceof THREE.MeshBasicMaterial && m.map) {
                    m.map.dispose();
                  }
                  m.dispose();
                });
              } else {
                if (child.material instanceof THREE.MeshBasicMaterial && child.material.map) {
                  child.material.map.dispose();
                }
                child.material.dispose();
              }
            }
          });
        });
        if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, [onEnter, audioData, trackIndex]); // Remove isHovering from dependencies to avoid recreating scene

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 6,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: '15%'
      }}
    />
  );
};

export default AnimatedLetters;

