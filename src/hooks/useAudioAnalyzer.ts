import { useEffect, useRef, useState } from 'react';

interface AudioAnalyzerData {
  frequencyData: Uint8Array;
  averageFrequency: number;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  overallVolume: number;
}

interface UseAudioAnalyzerReturn {
  audioData: AudioAnalyzerData | null;
  isPlaying: boolean;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  audioElement: HTMLAudioElement | null;
  changeTrack: (newSrc: string) => Promise<void>;
}

export const useAudioAnalyzer = (audioSrc?: string): UseAudioAnalyzerReturn => {
  const [audioData, setAudioData] = useState<AudioAnalyzerData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!audioSrc) return;

    // Create audio element
    const audio = new Audio(audioSrc);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    
    // Handle errors - log for debugging but don't break the app
    let hasErrored = false;
    const errorHandler = (e: Event) => {
      // Ignore errors during cleanup (when src is set to empty string)
      if (!audio.src || audio.src === '' || audio.src === window.location.href) {
        return;
      }
      if (!hasErrored) {
        hasErrored = true;
        console.error('Audio file failed to load:', audioSrc);
        console.error('Error code:', audio.error?.code, 'Message:', audio.error?.message);
        console.error('Make sure the file exists in the public folder and the path is correct');
      }
    };
    
    audio.addEventListener('error', errorHandler);
    
    audio.addEventListener('loadeddata', () => {
      console.log('Audio file loaded successfully:', audioSrc);
      hasErrored = false; // Reset error flag on successful load
    });
    
    audioRef.current = audio;
    setAudioElement(audio); // Update state so component knows audio element exists

    // Initialize Web Audio API
    const initAudioContext = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Higher resolution for better frequency analysis
        analyser.smoothingTimeConstant = 0.3; // Lower = more responsive (was 0.8, too slow)
        analyserRef.current = analyser;

        const source = audioContext.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        sourceRef.current = source;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        dataArrayRef.current = dataArray;

        // Start analysis loop
        const analyze = () => {
          if (!analyserRef.current || !dataArrayRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);

          // Calculate frequency bands
          const bassEnd = Math.floor(bufferLength * 0.1); // 0-10% = bass
          const midEnd = Math.floor(bufferLength * 0.5); // 10-50% = mid
          const trebleStart = Math.floor(bufferLength * 0.5); // 50-100% = treble

          let bassSum = 0;
          let midSum = 0;
          let trebleSum = 0;
          let totalSum = 0;

          for (let i = 0; i < bufferLength; i++) {
            const value = dataArrayRef.current[i];
            totalSum += value;
            if (i < bassEnd) {
              bassSum += value;
            } else if (i < midEnd) {
              midSum += value;
            } else {
              trebleSum += value;
            }
          }

          const averageFrequency = totalSum / bufferLength;
          const bassLevel = bassSum / bassEnd;
          const midLevel = midSum / (midEnd - bassEnd);
          const trebleLevel = trebleSum / (bufferLength - trebleStart);
          const overallVolume = averageFrequency / 255;

          setAudioData({
            frequencyData: new Uint8Array(dataArrayRef.current),
            averageFrequency,
            bassLevel,
            midLevel,
            trebleLevel,
            overallVolume
          });

          animationFrameRef.current = requestAnimationFrame(analyze);
        };

        // Start analysis when audio is playing
        const handlePlay = () => {
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }
          analyze();
        };
        
        audio.addEventListener('play', handlePlay);
        
        // Also try to start analysis immediately if audio is already playing
        if (!audio.paused) {
          handlePlay();
        }

        audio.addEventListener('pause', () => {
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        });
      } catch (error) {
        console.error('Error initializing audio context:', error);
      }
    };

    initAudioContext();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      // Remove error listener before clearing src to avoid false errors
      audio.removeEventListener('error', errorHandler);
      audio.pause();
      // Don't set src to empty - just pause and let it be cleaned up naturally
      // audio.src = ''; // This was causing the "Empty src attribute" error
    };
  }, [audioSrc]);

  const play = async () => {
    if (!audioRef.current) {
      console.warn('No audio element available');
      return;
    }
    try {
      // Check if audio has valid sources before trying to play
      if (audioRef.current.error && audioRef.current.error.code !== 0) {
        console.error('Audio has an error, cannot play. Error code:', audioRef.current.error.code);
        console.error('Error message:', audioRef.current.error.message);
        console.error('Audio src:', audioRef.current.src);
        return;
      }
      
      // Check if audio is ready to play
      if (audioRef.current.readyState < 2) {
        console.log('Audio not ready yet, waiting...');
        audioRef.current.addEventListener('canplay', async () => {
          try {
            await audioRef.current!.play();
            setIsPlaying(true);
          } catch (err: any) {
            console.error('Error playing after canplay:', err);
          }
        }, { once: true });
        return;
      }
      
      await audioRef.current.play();
      setIsPlaying(true);
      console.log('Audio playing successfully');
    } catch (error: any) {
      console.error('Error playing audio:', error.name, error.message);
      if (error.name === 'NotAllowedError') {
        console.warn('Browser blocked autoplay - user interaction required');
      } else if (error.name === 'NotSupportedError') {
        console.error('Audio format not supported or file not found');
        console.error('Check that the file exists at:', audioSrc);
      } else {
        console.error('Unexpected audio error:', error);
      }
    }
  };

  const pause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const toggle = async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  };

  const changeTrack = async (newSrc: string) => {
    if (!audioRef.current) return;
    
    const wasPlaying = isPlaying;
    
    // Pause current track
    pause();
    
    // Disconnect old source if it exists
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    // Create new audio element
    const audio = new Audio(newSrc);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    
    // Handle errors
    let hasErrored = false;
    const errorHandler = (e: Event) => {
      if (!audio.src || audio.src === '' || audio.src === window.location.href) {
        return;
      }
      if (!hasErrored) {
        hasErrored = true;
        console.error('Audio file failed to load:', newSrc);
        console.error('Error code:', audio.error?.code, 'Message:', audio.error?.message);
      }
    };
    
    audio.addEventListener('error', errorHandler);
    
    audioRef.current = audio;
    setAudioElement(audio);
    
    // Reinitialize audio context with new source
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      sourceRef.current = source;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      
      // Restart analysis loop
      const analyze = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);

        const bassEnd = Math.floor(bufferLength * 0.1);
        const midEnd = Math.floor(bufferLength * 0.5);
        const trebleStart = Math.floor(bufferLength * 0.5);

        let bassSum = 0;
        let midSum = 0;
        let trebleSum = 0;
        let totalSum = 0;

        for (let i = 0; i < bufferLength; i++) {
          const value = dataArrayRef.current[i];
          totalSum += value;
          if (i < bassEnd) {
            bassSum += value;
          } else if (i < midEnd) {
            midSum += value;
          } else {
            trebleSum += value;
          }
        }

        const averageFrequency = totalSum / bufferLength;
        const bassLevel = bassSum / bassEnd;
        const midLevel = midSum / (midEnd - bassEnd);
        const trebleLevel = trebleSum / (bufferLength - trebleStart);
        const overallVolume = averageFrequency / 255;

        setAudioData({
          frequencyData: new Uint8Array(dataArrayRef.current),
          averageFrequency,
          bassLevel,
          midLevel,
          trebleLevel,
          overallVolume
        });

        animationFrameRef.current = requestAnimationFrame(analyze);
      };
      
      // Wait for audio to load, then play if it was playing before
      audio.addEventListener('loadeddata', async () => {
        console.log('New track loaded:', newSrc);
        if (wasPlaying) {
          try {
            await audio.play();
            setIsPlaying(true);
            analyze();
          } catch (err: any) {
            console.error('Error playing new track:', err);
          }
        }
      }, { once: true });
      
      // Load the new track
      audio.load();
      
    } catch (error) {
      console.error('Error changing track:', error);
    }
  };

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  return {
    audioData,
    isPlaying,
    play,
    pause,
    toggle,
    audioElement: audioElement || audioRef.current,
    changeTrack
  };
};

