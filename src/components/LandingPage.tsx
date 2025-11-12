import { useState, useRef } from 'react';
import { Music } from 'lucide-react';
import Header from './Header';

interface LandingPageProps {
  onEnter: () => void;
  onNavigateToLanding?: () => void;
}

function LandingPage({ onEnter, onNavigateToLanding }: LandingPageProps) {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoLoaded = () => {
    setVideoLoaded(true);
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden flex flex-col">
      {/* Header */}
      <Header 
        onNavigateToLanding={onNavigateToLanding} 
        onEnter={onEnter}
      />

      {/* Video as 3D background blend */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 flex items-start justify-center" style={{ paddingTop: '0px', marginTop: '-80px' }}>
          {!videoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="w-24 h-24 rounded-full border-4 border-amber-600/50 flex items-center justify-center" style={{
                background: 'radial-gradient(circle, rgba(234, 179, 8, 0.2) 0%, transparent 70%)'
              }}>
                <Music className="w-12 h-12 text-yellow-300" />
              </div>
            </div>
          )}
          <div 
            className="relative w-full max-w-4xl z-10" 
            style={{ height: '100vh', minHeight: '100vh' }}
          >
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain"
              onLoadedData={handleVideoLoaded}
              style={{
                opacity: videoLoaded ? 1 : 0,
                filter: 'brightness(0.6) contrast(1.2) blur(0.5px)',
                mixBlendMode: 'screen',
                objectPosition: 'center bottom',
                transformOrigin: 'center bottom',
                pointerEvents: 'auto',
                transform: 'scale(0.75)'
              }}
            >
              <source src="/landing-video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            {/* Gradient fade at edges for better blend */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.6) 100%)'
            }}></div>
          </div>
        </div>
        {/* Dark overlay for better blend */}
        <div className="absolute inset-0 bg-black/30 mix-blend-multiply pointer-events-none z-1"></div>
      </div>
    </div>
  );
}

export default LandingPage;
