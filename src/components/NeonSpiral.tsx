import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface AudioAnalyzerData {
  frequencyData: Uint8Array;
  averageFrequency: number;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  overallVolume: number;
}

interface NeonSpiralProps {
  isHovering: boolean;
  audioData?: AudioAnalyzerData | null;
}

const NeonSpiral = ({ isHovering, audioData }: NeonSpiralProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioDataRef = useRef<AudioAnalyzerData | null>(audioData || null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    spiral: THREE.Group;
    animationId: number | null;
    noteGeometry: THREE.Group;
    neuronGroup: THREE.Group;
  } | null>(null);
  
  // Update audioData ref when it changes
  useEffect(() => {
    audioDataRef.current = audioData || null;
  }, [audioData]);

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
    
    const size = updateSize();
    renderer.setSize(size.width, size.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    // Style the canvas
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'none';

    // Create spiral group
    const spiral = new THREE.Group();
    scene.add(spiral);

    // Colors matching jukebox: pink, light blue, light green, warm red, cream/gold
    const colors = [
      0xff69b4, // Hot pink (like the side columns)
      0x87ceeb, // Sky blue (left column transition)
      0x90ee90, // Light green (right column transition)
      0xff6b9d, // Pink-red
      0xffb6c1, // Light pink
      0xffd700, // Gold/cream accent
      0xff8c94, // Warm coral-pink
      0xb0e0e6  // Powder blue
    ];

    // Create multiple spirals at different angles
    const numSpirals = 8;
    const spiralPoints = 250;
      const spirals: Array<{
        line: THREE.Line;
        geometry: THREE.BufferGeometry;
        material: THREE.LineBasicMaterial;
        rotation: THREE.Euler;
        offset: THREE.Vector3;
        colorOffset: number;
        glowLine: THREE.Line;
        glowLine2: THREE.Line;
        haloLine: THREE.Line;
        outerHaloLine: THREE.Line;
      }> = [];

    for (let s = 0; s < numSpirals; s++) {
      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array(spiralPoints * 3);
      const lineColors = new Float32Array(spiralPoints * 3);
      
      // Different angles and offsets for each spiral
      const angleOffset = (s / numSpirals) * Math.PI * 2;
      const verticalOffset = (s % 3 - 1) * 0.5;
      const radiusOffset = (s % 2) * 0.3;
      const colorOffset = s / numSpirals;
      
      // Initialize spiral positions
      for (let i = 0; i < spiralPoints; i++) {
        const t = i / spiralPoints;
        const angle = t * Math.PI * 6 + angleOffset; // Different rotations
        const radius = t * 1.2 + radiusOffset;
        const height = t * 2.5 - 1.2 + verticalOffset;
        
        const idx = i * 3;
        linePositions[idx] = Math.cos(angle) * radius;
        linePositions[idx + 1] = height;
        linePositions[idx + 2] = Math.sin(angle) * radius;
        
        // Color gradient matching jukebox
        const colorIndex = Math.floor((t + colorOffset) * colors.length) % colors.length;
        const nextColorIndex = (colorIndex + 1) % colors.length;
        const colorT = ((t + colorOffset) * colors.length) % 1;
        const color = new THREE.Color(colors[colorIndex]).lerp(
          new THREE.Color(colors[nextColorIndex]),
          colorT
        );
        // Add slight gold tint
        color.lerp(new THREE.Color(0xffd700), 0.1);
        
        lineColors[idx] = color.r;
        lineColors[idx + 1] = color.g;
        lineColors[idx + 2] = color.b;
      }
      
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
      
      const lineMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        linewidth: 16,
      });
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      spiral.add(line);
      
      // Add multiple glow layers for intense neon effect
      const glowMaterial1 = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        linewidth: 22,
      });
      const glowLine1 = new THREE.Line(lineGeometry.clone(), glowMaterial1);
      spiral.add(glowLine1);
      
      const glowMaterial2 = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        linewidth: 30,
      });
      const glowLine2 = new THREE.Line(lineGeometry.clone(), glowMaterial2);
      spiral.add(glowLine2);
      
      // Add outer glow halo
      const haloMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        linewidth: 40,
      });
      const haloLine = new THREE.Line(lineGeometry.clone(), haloMaterial);
      spiral.add(haloLine);
      
      // Add extra outer glow layer for maximum intensity
      const outerHaloMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        linewidth: 55,
      });
      const outerHaloLine = new THREE.Line(lineGeometry.clone(), outerHaloMaterial);
      spiral.add(outerHaloLine);
      
      spirals.push({
        line,
        geometry: lineGeometry,
        material: lineMaterial,
        rotation: new THREE.Euler(
          (s % 3) * 0.2,
          angleOffset,
          (s % 2) * 0.15
        ),
        offset: new THREE.Vector3(radiusOffset, verticalOffset, 0),
        colorOffset,
        glowLine: glowLine1,
        glowLine2,
        haloLine,
        outerHaloLine
      });
    }

    // Create musical note shape (eighth note)
    const createNoteShape = () => {
      const group = new THREE.Group();
      
      // Note head (oval/ellipse)
      const headGeometry = new THREE.SphereGeometry(0.12, 8, 8);
      headGeometry.scale(1.5, 1, 1); // Make it oval
      const headMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.set(0, 0, 0);
      group.add(head);
      
      // Note stem (vertical line)
      const stemGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6);
      const stemMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.9
      });
      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      stem.position.set(0.12, 0.25, 0);
      group.add(stem);
      
      // Flag (curved)
      const flagShape = new THREE.Shape();
      flagShape.moveTo(0, 0);
      flagShape.quadraticCurveTo(0.15, -0.1, 0.25, -0.2);
      flagShape.lineTo(0.25, -0.4);
      flagShape.quadraticCurveTo(0.15, -0.3, 0, -0.2);
      flagShape.lineTo(0, 0);
      const flagGeometry = new THREE.ShapeGeometry(flagShape);
      flagGeometry.rotateX(-Math.PI / 2);
      const flagMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      const flag = new THREE.Mesh(flagGeometry, flagMaterial);
      flag.position.set(0.12, 0.5, 0);
      group.add(flag);
      
      return group;
    };

    // Create neuron shape (with cell body, dendrites, and axon)
    const createNeuronShape = () => {
      const group = new THREE.Group();
      
      // Cell body/soma (larger sphere) - less glow
      const somaGeometry = new THREE.SphereGeometry(0.15, 12, 12);
      const somaMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const soma = new THREE.Mesh(somaGeometry, somaMaterial);
      group.add(soma);
      
      // Dendrites (multiple branching structures)
      const numDendrites = 5;
      for (let i = 0; i < numDendrites; i++) {
        const angle = (i / numDendrites) * Math.PI * 2;
        const elevation = (i % 2 === 0 ? 1 : -1) * 0.3;
        
        // Main dendrite branch - less glow
        const dendriteGeometry = new THREE.CylinderGeometry(0.015, 0.02, 0.4, 6);
        const dendriteMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x00ffff, 
          transparent: true, 
          opacity: 0.75,
          blending: THREE.AdditiveBlending
        });
        const dendrite = new THREE.Mesh(dendriteGeometry, dendriteMaterial);
        
        // Position and rotate dendrite
        const radius = 0.2;
        dendrite.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius + elevation * 0.2,
          Math.sin(elevation) * radius * 0.5
        );
        dendrite.lookAt(
          Math.cos(angle) * radius * 2,
          Math.sin(angle) * radius * 2 + elevation * 0.4,
          Math.sin(elevation) * radius
        );
        dendrite.rotateX(Math.PI / 2);
        group.add(dendrite);
        
        // Add small branches to dendrite
        for (let j = 0; j < 2; j++) {
          const branchGeometry = new THREE.CylinderGeometry(0.008, 0.01, 0.15, 4);
          const branchMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.7,
            blending: THREE.AdditiveBlending
          });
          const branch = new THREE.Mesh(branchGeometry, branchMaterial);
          branch.position.copy(dendrite.position);
          branch.position.add(new THREE.Vector3(
            Math.cos(angle + (j - 0.5) * 0.3) * 0.3,
            Math.sin(angle + (j - 0.5) * 0.3) * 0.3 + elevation * 0.1,
            0
          ));
          branch.lookAt(branch.position.clone().add(new THREE.Vector3(
            Math.cos(angle + (j - 0.5) * 0.3) * 0.5,
            Math.sin(angle + (j - 0.5) * 0.3) * 0.5,
            0
          )));
          branch.rotateX(Math.PI / 2);
          group.add(branch);
        }
      }
      
      // Axon (single long branch) - less glow
      const axonGeometry = new THREE.CylinderGeometry(0.02, 0.025, 0.6, 6);
      const axonMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const axon = new THREE.Mesh(axonGeometry, axonMaterial);
      axon.position.set(0, 0, 0.3);
      axon.rotation.z = Math.PI / 2;
      group.add(axon);
      
      // Axon terminal (small bulb at end) - less glow
      const terminalGeometry = new THREE.SphereGeometry(0.08, 8, 8);
      const terminal = new THREE.Mesh(terminalGeometry, axonMaterial);
      terminal.position.set(0, 0, 0.6);
      group.add(terminal);
      
      return group;
    };

    // Create particles (musical notes and neurons)
    const particleCount = 30;
    const particles: Array<{
      mesh: THREE.Mesh | THREE.Group;
      spiralIndex: number;
      progress: number;
      speed: number;
      type: 'note' | 'neuron';
      color: number;
    }> = [];

    const noteTemplate = createNoteShape();
    const neuronTemplate = createNeuronShape();

    for (let i = 0; i < particleCount; i++) {
      const spiralIndex = Math.floor(Math.random() * numSpirals);
      const progress = Math.random();
      const type = Math.random() > 0.5 ? 'note' : 'neuron';
      const colorIndex = Math.floor(Math.random() * colors.length);
      const color = colors[colorIndex];
      
      let mesh: THREE.Mesh | THREE.Group;
      
      if (type === 'note') {
        // Clone note template and apply color
        mesh = noteTemplate.clone();
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = (child.material as THREE.MeshBasicMaterial).clone();
            (child.material as THREE.MeshBasicMaterial).color.setHex(color);
            (child.material as THREE.MeshBasicMaterial).blending = THREE.AdditiveBlending;
          }
        });
        mesh.scale.setScalar(0.25);
      } else {
        // Clone neuron template and apply color
        mesh = neuronTemplate.clone();
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = (child.material as THREE.MeshBasicMaterial).clone();
            (child.material as THREE.MeshBasicMaterial).color.setHex(color);
            (child.material as THREE.MeshBasicMaterial).blending = THREE.AdditiveBlending;
          }
        });
        mesh.scale.setScalar(0.35);
      }
      
      spiral.add(mesh);
      particles.push({
        mesh,
        spiralIndex,
        progress,
        speed: 0.3 + Math.random() * 0.2,
        type,
        color
      });
    }

    // Animation variables
    let targetY = -2.6; // Start below - moved down more
    let currentY = -2.6;
    let animationSpeed = 0;

    // Animation loop
    const animate = () => {
      const id = requestAnimationFrame(animate);
      
      if (sceneRef.current) {
        sceneRef.current.animationId = id;
      }
      
      // Get current audioData from ref (updated externally)
      const currentAudioData = audioDataRef.current;
      
      // Smooth transition for hover state
      targetY = isHovering ? -0.6 : -2.6; // Moved down more
      const diff = targetY - currentY;
      currentY += diff * 0.1; // Smooth interpolation
      animationSpeed = isHovering ? animationSpeed * 0.95 + 0.05 : animationSpeed * 0.9;
      
      // Audio-reactive rotation speed - more responsive
      const audioRotationBoost = currentAudioData ? currentAudioData.overallVolume * 0.05 : 0;
      const baseRotationSpeed = 0.01 + animationSpeed * 0.02;
      
      // Update spiral position
      spiral.position.y = currentY;
      
      // Rotate spiral group - faster with music
      spiral.rotation.y += baseRotationSpeed + audioRotationBoost;
      
      // Animate all spirals with organic wave motion
      const time = Date.now() * 0.001;
      
      spirals.forEach((spiralData, s) => {
        const positions = spiralData.geometry.attributes.position.array as Float32Array;
        const lineColors = spiralData.geometry.attributes.color.array as Float32Array;
        
        for (let i = 0; i < spiralPoints; i++) {
          const t = i / spiralPoints;
          const baseAngle = t * Math.PI * 6 + spiralData.rotation.y + spiral.rotation.y;
          const baseRadius = t * 1.2 + spiralData.offset.x;
          const baseHeight = t * 2.5 - 1.2 + spiralData.offset.y;
          
          // Add organic wave motion - smooth and reactive but not overwhelming
          const phase = t * Math.PI * 4 + s;
          const audioWaveBoost = currentAudioData ? currentAudioData.overallVolume * 0.08 : 0; // Reduced from 0.25
          const bassBoost = currentAudioData ? (currentAudioData.bassLevel / 255) * 0.06 : 0; // Reduced from 0.2
          const trebleBoost = currentAudioData ? (currentAudioData.trebleLevel / 255) * 0.04 : 0; // Reduced from 0.15
          
          // Get frequency data for this point if available - smoother response
          const freqIndex = Math.floor(t * (currentAudioData?.frequencyData.length || 128));
          const freqIntensityWave = currentAudioData ? currentAudioData.frequencyData[freqIndex] / 255 : 0;
          
          // Smoother wave motion - less chaotic
          const wave = Math.sin(time * 2.5 + phase) * (0.08 + audioWaveBoost + bassBoost);
          const wave2 = Math.cos(time * 1.8 + phase * 1.3) * (0.06 + audioWaveBoost * 0.7 + trebleBoost);
          const organicDrift = Math.sin(time * 1.2 + phase * 2) * (0.04 + freqIntensityWave * 0.03); // Reduced from 0.1
          
          const idx = i * 3;
          positions[idx] = Math.cos(baseAngle) * baseRadius + wave + organicDrift * 0.3;
          positions[idx + 1] = baseHeight + wave2 + organicDrift * 0.5;
          positions[idx + 2] = Math.sin(baseAngle) * baseRadius + wave * 0.4 + organicDrift * 0.2;
          
          // Update colors with warm breathing effect - enhanced by audio
          const colorIndex = Math.floor((t + spiralData.colorOffset) * colors.length) % colors.length;
          const nextColorIndex = (colorIndex + 1) % colors.length;
          const colorT = ((t + spiralData.colorOffset) * colors.length) % 1;
          let color = new THREE.Color(colors[colorIndex]).lerp(
            new THREE.Color(colors[nextColorIndex]),
            colorT
          );
          
          // Audio-reactive color intensity - subtle and smooth
          const audioIntensity = currentAudioData ? currentAudioData.overallVolume : 0;
          const freqIntensity = currentAudioData ? (currentAudioData.frequencyData[Math.floor(t * currentAudioData.frequencyData.length)] || 0) / 255 : 0;
          const warmBreath = Math.sin(time * 1.5 + phase) * 0.05 + 0.95;
          const audioPulse = 1 + audioIntensity * 0.15 + freqIntensity * 0.1; // Reduced from 0.3 and 0.2
          
          // Boost saturation and brightness with audio - subtle
          color.lerp(new THREE.Color(0xffd700), 0.1 * warmBreath * audioPulse);
          
          // Add color shift based on frequency bands - more subtle
          if (currentAudioData) {
            const bassRatio = currentAudioData.bassLevel / 255;
            const trebleRatio = currentAudioData.trebleLevel / 255;
            // Shift towards warmer colors with bass, cooler with treble - subtle
            if (bassRatio > 0.6) {
              color.lerp(new THREE.Color(0xff6b9d), (bassRatio - 0.6) * 0.25 * 0.08); // Reduced from 0.15
            }
            if (trebleRatio > 0.6) {
              color.lerp(new THREE.Color(0x87ceeb), (trebleRatio - 0.6) * 0.25 * 0.05); // Reduced from 0.1
            }
          }
          
          lineColors[idx] = color.r;
          lineColors[idx + 1] = color.g;
          lineColors[idx + 2] = color.b;
        }
        
        spiralData.geometry.attributes.position.needsUpdate = true;
        spiralData.geometry.attributes.color.needsUpdate = true;
        
        // Update glow line geometries to match main line
        const glowPositions1 = spiralData.glowLine.geometry.attributes.position.array as Float32Array;
        const glowPositions2 = spiralData.glowLine2.geometry.attributes.position.array as Float32Array;
        const haloPositions = spiralData.haloLine.geometry.attributes.position.array as Float32Array;
        const outerHaloPositions = spiralData.outerHaloLine.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < spiralPoints; i++) {
          const idx = i * 3;
          glowPositions1[idx] = positions[idx];
          glowPositions1[idx + 1] = positions[idx + 1];
          glowPositions1[idx + 2] = positions[idx + 2];
          glowPositions2[idx] = positions[idx];
          glowPositions2[idx + 1] = positions[idx + 1];
          glowPositions2[idx + 2] = positions[idx + 2];
          haloPositions[idx] = positions[idx];
          haloPositions[idx + 1] = positions[idx + 1];
          haloPositions[idx + 2] = positions[idx + 2];
          outerHaloPositions[idx] = positions[idx];
          outerHaloPositions[idx + 1] = positions[idx + 1];
          outerHaloPositions[idx + 2] = positions[idx + 2];
        }
        spiralData.glowLine.geometry.attributes.position.needsUpdate = true;
        spiralData.glowLine2.geometry.attributes.position.needsUpdate = true;
        spiralData.haloLine.geometry.attributes.position.needsUpdate = true;
        spiralData.outerHaloLine.geometry.attributes.position.needsUpdate = true;
        
        // Update glow line colors
        const glowColors1 = spiralData.glowLine.geometry.attributes.color.array as Float32Array;
        const glowColors2 = spiralData.glowLine2.geometry.attributes.color.array as Float32Array;
        const haloColors = spiralData.haloLine.geometry.attributes.color.array as Float32Array;
        const outerHaloColors = spiralData.outerHaloLine.geometry.attributes.color.array as Float32Array;
        for (let i = 0; i < spiralPoints; i++) {
          const idx = i * 3;
          glowColors1[idx] = lineColors[idx];
          glowColors1[idx + 1] = lineColors[idx + 1];
          glowColors1[idx + 2] = lineColors[idx + 2];
          glowColors2[idx] = lineColors[idx];
          glowColors2[idx + 1] = lineColors[idx + 1];
          glowColors2[idx + 2] = lineColors[idx + 2];
          haloColors[idx] = lineColors[idx];
          haloColors[idx + 1] = lineColors[idx + 1];
          haloColors[idx + 2] = lineColors[idx + 2];
          outerHaloColors[idx] = lineColors[idx];
          outerHaloColors[idx + 1] = lineColors[idx + 1];
          outerHaloColors[idx + 2] = lineColors[idx + 2];
        }
        spiralData.glowLine.geometry.attributes.color.needsUpdate = true;
        spiralData.glowLine2.geometry.attributes.color.needsUpdate = true;
        spiralData.haloLine.geometry.attributes.color.needsUpdate = true;
        spiralData.outerHaloLine.geometry.attributes.color.needsUpdate = true;
        
        // Update line opacity and glow - completely hide when not playing
        const lineBaseOpacity = isHovering ? 1.0 : 0; // Completely hide when paused
        const lineWarmGlow = isHovering ? (Math.sin(time * 1.2 + s) * 0.1 + 0.9) : 0;
        
        // Audio-reactive opacity boost - smooth and subtle (only when playing)
        const audioOpacityBoost = (isHovering && currentAudioData) ? currentAudioData.overallVolume * 0.2 : 0;
        const audioPulse = (isHovering && currentAudioData) ? 1 + Math.sin(time * 4 + s) * currentAudioData.overallVolume * 0.1 : 1;
        
        const finalOpacity = isHovering ? Math.min(1, lineBaseOpacity * lineWarmGlow * audioPulse + audioOpacityBoost) : 0;
        
        spiralData.material.opacity = finalOpacity;
        (spiralData.glowLine.material as THREE.LineBasicMaterial).opacity = finalOpacity * 0.7;
        (spiralData.glowLine2.material as THREE.LineBasicMaterial).opacity = finalOpacity * 0.5;
        (spiralData.haloLine.material as THREE.LineBasicMaterial).opacity = finalOpacity * 0.35;
        (spiralData.outerHaloLine.material as THREE.LineBasicMaterial).opacity = finalOpacity * 0.25;
      });
      
      // Animate particles along spirals
      particles.forEach((particle) => {
        const spiralData = spirals[particle.spiralIndex];
        
        // Update progress along spiral
        particle.progress += particle.speed * 0.001;
        if (particle.progress > 1) particle.progress = 0;
        
        // Calculate position along spiral
        const t = particle.progress;
        const angle = t * Math.PI * 6 + spiralData.rotation.y + spiral.rotation.y;
        const radius = t * 1.2 + spiralData.offset.x;
        const height = t * 2.5 - 1.2 + spiralData.offset.y;
        
        // Add wave motion to match spiral - audio-reactive but smooth
        const phase = t * Math.PI * 4 + particle.spiralIndex;
        const audioBoost = currentAudioData ? currentAudioData.overallVolume * 0.1 : 0; // Reduced from 0.35
        const wave = Math.sin(time * 2.5 + phase) * (0.08 + audioBoost);
        const wave2 = Math.cos(time * 1.8 + phase * 1.3) * (0.06 + audioBoost * 0.7);
        const organicDrift = Math.sin(time * 1.2 + phase * 2) * (0.04 + audioBoost * 0.5);
        
        particle.mesh.position.set(
          Math.cos(angle) * radius + wave + organicDrift * 0.3,
          height + wave2 + organicDrift * 0.5,
          Math.sin(angle) * radius + wave * 0.4 + organicDrift * 0.2
        );
        
        // Rotate particles - audio-reactive speed (smooth)
        const audioRotationBoost = currentAudioData ? currentAudioData.overallVolume * 0.015 : 0; // Reduced from 0.04
        if (particle.type === 'note') {
          particle.mesh.rotation.y += 0.02 + audioRotationBoost;
          particle.mesh.rotation.z = Math.sin(time * 2 + particle.progress * 10) * (0.2 + audioRotationBoost * 2);
        } else {
          particle.mesh.rotation.y += 0.015 + audioRotationBoost;
          particle.mesh.rotation.x = Math.sin(time * 1.5 + particle.progress * 8) * (0.15 + audioRotationBoost * 1.5);
        }
        
        // Pulsing effect - audio-reactive (smooth)
        const basePulse = Math.sin(time * 3 + particle.progress * 5) * 0.1 + 0.9;
        const audioPulse = currentAudioData ? currentAudioData.overallVolume * 0.15 : 0; // Reduced from 0.5
        const pulse = basePulse + audioPulse;
        particle.mesh.scale.setScalar(pulse * (particle.type === 'note' ? 0.25 : 0.35));
        
        // Update opacity - completely hide when not playing
        const baseOpacity = isHovering ? 0.7 : 0; // Completely hide when paused
        const distanceOpacity = Math.max(0.4, 1.0 - particle.mesh.position.length() * 0.1);
        const opacity = baseOpacity * distanceOpacity;
        
        if (particle.mesh instanceof THREE.Mesh && particle.mesh.material instanceof THREE.MeshBasicMaterial) {
          particle.mesh.material.opacity = opacity;
        } else if (particle.mesh instanceof THREE.Group) {
          particle.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
              child.material.opacity = opacity;
            }
          });
        }
      });
      
      renderer.render(scene, camera);
    };
    
    animate();

    // Store refs for cleanup
    sceneRef.current = { 
      scene, 
      camera, 
      renderer, 
      spiral, 
      animationId: null,
      noteGeometry: noteTemplate,
      neuronGroup: neuronTemplate
    };

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

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        if (sceneRef.current.animationId) {
          cancelAnimationFrame(sceneRef.current.animationId);
        }
        sceneRef.current.renderer.dispose();
        // Dispose template geometries
        if (sceneRef.current.noteGeometry) {
          sceneRef.current.noteGeometry.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        }
        if (sceneRef.current.neuronGroup) {
          sceneRef.current.neuronGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        }
        sceneRef.current.spiral.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          } else if (child instanceof THREE.Line) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          } else if (child instanceof THREE.Group) {
            // Groups are handled by their children
            child.traverse((grandchild) => {
              if (grandchild instanceof THREE.Mesh) {
                grandchild.geometry.dispose();
                if (Array.isArray(grandchild.material)) {
                  grandchild.material.forEach(m => m.dispose());
                } else {
                  grandchild.material.dispose();
                }
              }
            });
          }
        });
        if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, [isHovering]); // Don't include audioData in dependencies - it changes every frame

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 5,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: '10%'
      }}
    />
  );
};

export default NeonSpiral;

