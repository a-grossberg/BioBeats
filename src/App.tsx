import { useState, useEffect, useRef } from 'react';
import { Music, GitCompare } from 'lucide-react';
import { fetchDataset } from './utils/neurofinderFetcher';
import { framesToCalciumDataset } from './utils/calciumExtraction';
import { CalciumDataset } from './types';
import { DatasetInfo } from './utils/datasetLoader';
import CalciumSonification from './components/CalciumSonification';
import MusicalSonification from './components/MusicalSonification';
import DatasetComparison from './components/DatasetComparison';
import DatasetSelector from './components/DatasetSelector';
import LandingPage from './components/LandingPage';
import AboutPage from './components/AboutPage';
import Header from './components/Header';

function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [datasets, setDatasets] = useState<CalciumDataset[]>([]);
  const [activeDatasetIndex, setActiveDatasetIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');
  const [sonificationMode, setSonificationMode] = useState<'spike' | 'musical'>('spike');
  const [progress, setProgress] = useState({ value: 0, message: '' });
  const [loadedDatasetIds, setLoadedDatasetIds] = useState<string[]>([]);
  const [shouldPause, setShouldPause] = useState(0); // Counter to trigger pause in child components
  const prevSonificationModeRef = useRef<'spike' | 'musical'>('spike');
  const prevViewModeRef = useRef<'single' | 'compare'>('single');

  const activeDataset = activeDatasetIndex !== null ? datasets[activeDatasetIndex] : null;

  const handleEnterApp = () => {
    setShouldPause(prev => prev + 1); // Pause playback when navigating
    setShowLanding(false);
    setShowAbout(true);
  };

  const handleContinueFromAbout = () => {
    setShouldPause(prev => prev + 1); // Pause playback when navigating
    setShowAbout(false);
  };

  const handleNavigateToLanding = () => {
    setShouldPause(prev => prev + 1); // Pause playback when navigating
    setShowLanding(true);
    setShowAbout(false);
  };

  const handleNavigateToAbout = () => {
    setShouldPause(prev => prev + 1); // Pause playback when navigating
    setShowLanding(false);
    setShowAbout(true);
  };

  // Pause playback when switching modes or view modes
  useEffect(() => {
    if (prevSonificationModeRef.current !== sonificationMode) {
      setShouldPause(prev => prev + 1);
      prevSonificationModeRef.current = sonificationMode;
    }
  }, [sonificationMode]);

  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      setShouldPause(prev => prev + 1);
      prevViewModeRef.current = viewMode;
    }
  }, [viewMode]);

  // Pause playback when window loses focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setShouldPause(prev => prev + 1);
      }
    };

    const handleBlur = () => {
      setShouldPause(prev => prev + 1);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleDatasetSelect = async (datasetInfo: DatasetInfo) => {
    // Check if already loaded
    if (loadedDatasetIds.includes(datasetInfo.id)) {
      const existingIndex = datasets.findIndex(d => d.datasetName === datasetInfo.name);
      if (existingIndex !== -1) {
        setActiveDatasetIndex(existingIndex);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setProgress({ value: 0, message: 'Starting download...' });

    try {
      // Fetch the dataset
      const { frames, regions } = await fetchDataset(
        datasetInfo.id,
        (value, message) => setProgress({ value, message })
      );

      // Convert to calcium dataset
      const dataset = await framesToCalciumDataset(
        frames,
        regions,
        {
          datasetName: datasetInfo.name,
          region: datasetInfo.region,
          condition: datasetInfo.condition
        }
      );

      setDatasets(prev => [...prev, dataset]);
      setActiveDatasetIndex(datasets.length);
      setLoadedDatasetIds(prev => [...prev, datasetInfo.id]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dataset';
      setError(errorMessage);
      console.error('Error loading dataset:', err);
    } finally {
      setIsLoading(false);
      setProgress({ value: 0, message: '' });
    }
  };

  // Show landing page first
  if (showLanding) {
    return <LandingPage onEnter={handleEnterApp} onNavigateToLanding={handleNavigateToLanding} />;
  }

  // Show about page when entering jukebox
  if (showAbout) {
    return <AboutPage onContinue={handleContinueFromAbout} onNavigateToLanding={handleNavigateToLanding} />;
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden flex flex-col">
      {/* Animated background lights */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-yellow-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Header */}
      <Header 
        onNavigateToLanding={handleNavigateToLanding} 
        onEnter={handleEnterApp}
        onNavigateToAbout={handleNavigateToAbout}
      />

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        <div className="max-w-7xl mx-auto px-8 py-8">

          {/* Dataset Selector */}
          <div className="mb-6">
            <DatasetSelector
              onDatasetSelect={handleDatasetSelect}
              isLoading={isLoading}
              loadedDatasets={loadedDatasetIds}
            />
          </div>

          {/* Loading Progress */}
          {isLoading && progress.value > 0 && (
            <div className="bg-amber-900/20 border rounded-lg p-6 mb-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-amber-200">{progress.message}</span>
                <span className="text-amber-300">{Math.round(progress.value)}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div
                  className="bg-yellow-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress.value}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-amber-900/30 border rounded-lg p-6 mb-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
              <h3 className="text-amber-200 font-semibold mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}>ERROR LOADING DATASET</h3>
              <p className="text-amber-200 text-sm whitespace-pre-line" style={{ fontFamily: 'Orbitron, sans-serif' }}>{error}</p>
              <div className="mt-4 p-4 bg-amber-900/40 rounded border" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                <p className="text-amber-200 text-sm mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>
                  <strong>QUICK FIX:</strong>
                </p>
                <ol className="text-amber-200 text-sm list-decimal list-inside space-y-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <li>Make sure the proxy server is running: <code className="bg-amber-900/60 px-2 py-1 rounded text-amber-100">npm run proxy</code></li>
                  <li>Check that it's running on <code className="bg-amber-900/60 px-2 py-1 rounded text-amber-100">http://localhost:3001</code></li>
                  <li>If the dataset is already pre-loaded, the proxy will use cached files</li>
                  <li>See README.md for detailed setup instructions</li>
                </ol>
              </div>
            </div>
          )}

          {/* Control Panel - Grouped controls when datasets are loaded */}
          {datasets.length > 0 && (
            <div className="mb-6 bg-amber-900/20 border rounded-lg p-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
              {/* Header with View Mode Selector */}
              <div className="mb-4 pb-4 border-b" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-amber-200 tracking-wider mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.15em' }}>LOAD A RECORD</h2>
                  <p className="text-xs text-amber-300/80" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    Click on a record card below to view and play it. Use VIEW and MODE buttons to switch between different visualization and sonification modes.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* View Mode Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-amber-300/80 mr-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>VIEW:</span>
                    <button
                      onClick={() => setViewMode('single')}
                    className={`jukebox-button px-5 py-2 font-bold transition-all ${
                        viewMode === 'single'
                        ? 'bg-gradient-to-br from-amber-900/40 to-amber-700/40 text-amber-200 scale-105'
                        : ''
                      }`}
                    style={{ 
                      fontFamily: 'Bebas Neue, sans-serif', 
                      letterSpacing: '0.1em',
                      ...(viewMode === 'single' ? {
                        borderColor: 'rgba(234, 179, 8, 0.5)',
                        boxShadow: '0 0 4px rgba(234, 179, 8, 0.3)'
                      } : {})
                    }}
                    >
                      SINGLE
                    </button>
                    <button
                      onClick={() => {
                        if (datasets.length >= 2) {
                          setViewMode('compare');
                        }
                      }}
                    className={`jukebox-button px-5 py-2 font-bold flex items-center gap-2 transition-all ${
                        viewMode === 'compare'
                        ? 'bg-gradient-to-br from-amber-900/40 to-amber-700/40 text-amber-200 scale-105'
                        : datasets.length < 2
                        ? 'bg-amber-900/10 text-amber-300/50 cursor-not-allowed'
                        : ''
                      }`}
                      disabled={datasets.length < 2}
                    title={datasets.length < 2 ? 'Load at least 2 datasets to enable compare mode' : 'Compare datasets'}
                    style={{ 
                      fontFamily: 'Bebas Neue, sans-serif', 
                      letterSpacing: '0.1em',
                      ...(viewMode === 'compare' ? {
                        borderColor: 'rgba(234, 179, 8, 0.5)',
                        boxShadow: '0 0 4px rgba(234, 179, 8, 0.3)'
                      } : {})
                    }}
                    >
                      <GitCompare className="w-4 h-4" />
                      COMPARE
                    </button>
                  </div>

                  {/* Playback Mode Selector - Only show in single mode with active dataset */}
                  {activeDataset && viewMode === 'single' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-amber-300/80 mr-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>MODE:</span>
                      <button
                        onClick={() => setSonificationMode('spike')}
                        className={`jukebox-button px-5 py-2 font-bold transition-all ${
                          sonificationMode === 'spike'
                            ? 'bg-gradient-to-br from-amber-900/40 to-amber-700/40 text-amber-200 scale-105'
                            : ''
                        }`}
                        style={{ 
                          fontFamily: 'Bebas Neue, sans-serif', 
                          letterSpacing: '0.1em',
                          ...(sonificationMode === 'spike' ? {
                            borderColor: 'rgba(234, 179, 8, 0.5)',
                            boxShadow: '0 0 4px rgba(234, 179, 8, 0.3)'
                          } : {})
                        }}
                      >
                        SPIKE
                      </button>
                      <button
                        onClick={() => setSonificationMode('musical')}
                        className={`jukebox-button px-5 py-2 font-bold flex items-center gap-2 transition-all ${
                          sonificationMode === 'musical'
                            ? 'bg-gradient-to-br from-amber-900/40 to-amber-700/40 text-amber-200 scale-105'
                            : ''
                        }`}
                        style={{ 
                          fontFamily: 'Bebas Neue, sans-serif', 
                          letterSpacing: '0.1em',
                          ...(sonificationMode === 'musical' ? {
                            borderColor: 'rgba(234, 179, 8, 0.5)',
                            boxShadow: '0 0 4px rgba(234, 179, 8, 0.3)'
                          } : {})
                        }}
                      >
                        <Music className="w-4 h-4" />
                        MUSICAL
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Dataset List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {datasets.map((dataset, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveDatasetIndex(index)}
                    className={`relative p-4 rounded-xl border transition-all text-left overflow-hidden ${
                      activeDatasetIndex === index
                        ? 'bg-gradient-to-br from-amber-900/40 to-amber-700/40 scale-105'
                        : 'bg-amber-900/20 hover:bg-amber-900/30 hover:scale-[1.02]'
                    }`}
                    style={{ 
                      borderColor: 'rgba(234, 179, 8, 0.3)',
                      boxShadow: activeDatasetIndex === index 
                        ? 'inset 0 0 20px rgba(255, 255, 255, 0.15), inset 0 0 40px rgba(255, 255, 255, 0.1), 0 0 10px rgba(255, 255, 255, 0.1)'
                        : 'none'
                    }}
                  >
                    {/* Record-like circular accent */}
                    <div className={`absolute top-2 right-2 w-12 h-12 rounded-full border ${
                      activeDatasetIndex === index 
                        ? 'bg-gradient-radial from-yellow-500/30 via-yellow-500/10 to-transparent record-spin' 
                        : 'bg-amber-900/30'
                    }`} style={activeDatasetIndex === index ? {
                      background: 'radial-gradient(circle, rgba(234, 179, 8, 0.3) 0%, rgba(234, 179, 8, 0.1) 50%, transparent 100%)',
                      borderColor: 'rgba(234, 179, 8, 0.5)',
                      boxShadow: '0 0 4px rgba(234, 179, 8, 0.3)'
                    } : { borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                      <div className="absolute inset-2 rounded-full bg-black/50"></div>
                    </div>
                    
                    <div className="font-bold text-lg mb-2 text-amber-200 pr-16" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>
                      {dataset.datasetName || `RECORD ${index + 1}`}
                    </div>
                    <div className="text-sm text-amber-300/80 space-y-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      <p>Neurons: {dataset.neurons.length}</p>
                      <p>Frames: {dataset.frames}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Visualization */}
          {viewMode === 'compare' && datasets.length >= 2 ? (
            <DatasetComparison 
              datasets={datasets} 
              onDatasetCreated={(newDataset) => {
                setDatasets(prev => [...prev, newDataset]);
                setActiveDatasetIndex(datasets.length);
              }}
              shouldPause={shouldPause}
            />
          ) : activeDataset ? (
            sonificationMode === 'musical' ? (
              <MusicalSonification dataset={activeDataset} shouldPause={shouldPause} />
            ) : (
              <CalciumSonification dataset={activeDataset} />
            )
          ) : null}
        </div>
      </main>

    </div>
  );
}

export default App;

