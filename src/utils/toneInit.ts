/**
 * Initialize Tone.js AudioContext after user interaction
 * This suppresses the browser warning about AudioContext needing user gesture
 */
export const initToneContext = async () => {
  try {
    // Dynamically import Tone.js only when needed
    const Tone = await import('tone');
    
    // Start the audio context if it's not already started
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }
    
    return Tone;
  } catch (error) {
    console.warn('Tone.js initialization:', error);
    return null;
  }
};

/**
 * Suppress Tone.js AudioContext warnings by handling them gracefully
 */
export const suppressToneWarnings = () => {
  // Override console.warn temporarily to filter out Tone.js AudioContext warnings
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // Filter out the specific AudioContext warning from Tone.js
    if (message.includes('AudioContext was not allowed to start') || 
        message.includes('must be resumed (or created) after a user gesture')) {
      // Suppress this specific warning - it's expected behavior
      return;
    }
    originalWarn.apply(console, args);
  };
  
  // Restore after a short delay (Tone.js initializes quickly)
  setTimeout(() => {
    console.warn = originalWarn;
  }, 1000);
};

