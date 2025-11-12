import { Play, Music, Brain, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import Header from './Header';

interface AboutPageProps {
  onContinue: () => void;
  onNavigateToLanding?: () => void;
}

function AboutPage({ onContinue, onNavigateToLanding }: AboutPageProps) {
  const [titleVisible, setTitleVisible] = useState(false);
  const [section1Visible, setSection1Visible] = useState(false);
  const [section2Visible, setSection2Visible] = useState(false);
  const [section3Visible, setSection3Visible] = useState(false);

  useEffect(() => {
    // Staggered animations
    setTimeout(() => setTitleVisible(true), 100);
    setTimeout(() => setSection1Visible(true), 400);
    setTimeout(() => setSection2Visible(true), 700);
    setTimeout(() => setSection3Visible(true), 1000);
  }, []);

  return (
    <div className="min-h-screen text-white relative overflow-hidden flex flex-col">
      {/* Animated background lights */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-yellow-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Retro scan lines effect */}
      <div className="fixed inset-0 pointer-events-none z-10 opacity-30" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(234, 179, 8, 0.03) 2px, rgba(234, 179, 8, 0.03) 4px)',
        animation: 'scanlines 8s linear infinite'
      }}></div>

      {/* Floating retro particles */}
      <div className="fixed inset-0 pointer-events-none z-5">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-amber-400/40 rounded-full"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 3) * 20}%`,
              animation: `float${i % 3} ${3 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
              boxShadow: '0 0 10px rgba(234, 179, 8, 0.5)'
            }}
          />
        ))}
      </div>

      {/* Header */}
      <Header 
        onNavigateToLanding={onNavigateToLanding}
        onNavigateToAbout={() => {}} 
      />

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        <div className="max-w-4xl mx-auto px-8 py-12">
          <div className="bg-amber-900/40 backdrop-blur-sm border rounded-xl p-8 space-y-6 relative overflow-hidden" style={{
            background: 'linear-gradient(135deg, rgba(92, 46, 12, 0.5) 0%, rgba(69, 45, 22, 0.6) 50%, rgba(58, 37, 18, 0.5) 100%)',
            borderColor: 'rgba(234, 179, 8, 0.3)'
          }}>

            {/* Animated title with retro effect */}
            <div className="text-center mb-8 relative">
              <h1 
                className={`text-5xl font-bold text-amber-200 mb-4 transition-all duration-1000 ${
                  titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
                }`}
                style={{ 
                  fontFamily: 'Bebas Neue, sans-serif', 
                  letterSpacing: '0.15em',
                  textShadow: '0 0 20px rgba(234, 179, 8, 0.5), 0 0 40px rgba(234, 179, 8, 0.3)',
                  animation: titleVisible ? 'titlePulse 2s ease-in-out infinite' : 'none'
                }}
              >
                ABOUT
              </h1>
              {/* Retro underline animation */}
              <div 
                className={`h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto transition-all duration-1000 ${
                  titleVisible ? 'w-full opacity-100' : 'w-0 opacity-0'
                }`}
                style={{
                  boxShadow: '0 0 10px rgba(234, 179, 8, 0.8)',
                  animation: titleVisible ? 'underlineSlide 1s ease-out' : 'none'
                }}
              ></div>
            </div>

            <div className="space-y-6 text-amber-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              <div 
                className={`transition-all duration-700 ${
                  section1Visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Brain className="w-6 h-6 text-amber-400" style={{ animation: 'iconPulse 2s ease-in-out infinite' }} />
                  <h2 
                    className="text-xl font-semibold text-amber-300" 
                    style={{ 
                      fontFamily: 'Bebas Neue, sans-serif', 
                      letterSpacing: '0.05em',
                      textShadow: '0 0 10px rgba(234, 179, 8, 0.4)'
                    }}
                  >
                    THE DATA
                  </h2>
                </div>
                <p className="text-base leading-relaxed">
                  This application uses calcium imaging data from the{' '}
                  <a 
                    href="http://neurofinder.codeneuro.org/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 underline transition-colors relative"
                    style={{
                      textShadow: '0 0 5px rgba(234, 179, 8, 0.5)'
                    }}
                  >
                    Neurofinder benchmark
                  </a>
                  , a collection of datasets designed for evaluating automated neuron detection algorithms in two-photon calcium imaging. Calcium imaging is a powerful technique that allows researchers to monitor the activity of hundreds to thousands of neurons simultaneously with high temporal resolution. By tracking changes in intracellular calcium levels, which rise when neurons fire action potentials, scientists can observe neural dynamics across entire populations in real-time, making it invaluable for studying network-level brain function, neural circuit dynamics, and population coding.
                </p>
              </div>

              <div 
                className={`transition-all duration-700 ${
                  section2Visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                }`}
                style={{ transitionDelay: section2Visible ? '0ms' : '300ms' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Radio className="w-6 h-6 text-amber-400" style={{ animation: 'iconPulse 2s ease-in-out infinite', animationDelay: '0.5s' }} />
                  <h2 
                    className="text-xl font-semibold text-amber-300" 
                    style={{ 
                      fontFamily: 'Bebas Neue, sans-serif', 
                      letterSpacing: '0.05em',
                      textShadow: '0 0 10px rgba(234, 179, 8, 0.4)'
                    }}
                  >
                    SONIFICATION & EXPLORATION
                  </h2>
                </div>
                <p className="text-base leading-relaxed">
                  Sonification—the process of converting data into sound—has proven to be a powerful tool for exploring complex neural signals. Researchers have successfully used sonification to identify patterns in EEG data that might be missed in visual analysis alone. Studies have also demonstrated the ability to sonify EEG signals and explore correlations between brain activity and musical stimuli (
                  <a 
                    href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6339862/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 underline transition-colors relative"
                    style={{
                      textShadow: '0 0 5px rgba(234, 179, 8, 0.5)'
                    }}
                  >
                    Sanyal et al., 2018
                  </a>
                  ). By translating calcium imaging data into sound, we can leverage our natural ability to perceive temporal dynamics and discover insights that complement traditional visualization methods.
                </p>
              </div>

              <div 
                className={`transition-all duration-700 ${
                  section3Visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                }`}
                style={{ transitionDelay: section3Visible ? '0ms' : '600ms' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Music className="w-6 h-6 text-amber-400" style={{ animation: 'iconPulse 2s ease-in-out infinite', animationDelay: '1s' }} />
                  <h2 
                    className="text-xl font-semibold text-amber-300" 
                    style={{ 
                      fontFamily: 'Bebas Neue, sans-serif', 
                      letterSpacing: '0.05em',
                      textShadow: '0 0 10px rgba(234, 179, 8, 0.4)'
                    }}
                  >
                    HOW THIS APP WORKS
                  </h2>
                </div>
                <p className="text-base leading-relaxed">
                  BioBeats transforms calcium imaging data into auditory experiences. Each detected neuron becomes a sound source, with its calcium activity mapped to audio parameters. You can explore datasets in two modes: <strong className="text-amber-300">Spike</strong> mode, which directly sonifies the calcium traces to reveal neural firing patterns, and <strong className="text-amber-300">Musical</strong> mode, which translates the data into more structured musical compositions. The app allows you to load multiple datasets, compare them side-by-side, and interactively explore the temporal dynamics of neural populations through sound. Select a dataset from the jukebox interface to begin your auditory exploration of neural activity.
                </p>
              </div>
            </div>

            <div className="pt-8 flex justify-center">
              <button
                onClick={onContinue}
                className="jukebox-button flex items-center gap-3 px-8 py-4 font-bold transition-all transform hover:scale-105"
                style={{ 
                  fontFamily: 'Bebas Neue, sans-serif', 
                  letterSpacing: '0.1em'
                }}
              >
                <Play className="w-5 h-5" />
                CONTINUE TO JUKEBOX
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AboutPage;
