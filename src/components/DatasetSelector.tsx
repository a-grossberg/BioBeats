import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { AVAILABLE_DATASETS, DatasetInfo } from '../utils/datasetLoader';

interface DatasetSelectorProps {
  onDatasetSelect: (dataset: DatasetInfo) => void;
  isLoading: boolean;
  loadedDatasets: string[];
}

const DatasetSelector = ({ onDatasetSelect, isLoading, loadedDatasets }: DatasetSelectorProps) => {
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  
  // Create 20 slots (10 per side) to match the jukebox design
  // Note: There are 19 training datasets available from Neurofinder, so one slot will be empty
  const totalSlots = 20;
  const slotsPerSide = 10;
  const displayDatasets: (DatasetInfo | null)[] = [];
  
  // Fill with available datasets, then pad with nulls
  for (let i = 0; i < totalSlots; i++) {
    displayDatasets.push(i < AVAILABLE_DATASETS.length ? AVAILABLE_DATASETS[i] : null);
  }
  
  const leftSlots = displayDatasets.slice(0, slotsPerSide);
  const rightSlots = displayDatasets.slice(slotsPerSide, totalSlots);

  const handleSelect = (dataset: DatasetInfo | null) => {
    if (!dataset) return;
    setSelectedDataset(dataset.id);
    onDatasetSelect(dataset);
  };

  const getButtonLabel = (index: number): string => {
    return `A${index + 1}`;
  };

  return (
    <div className="relative">
      {/* Dataset Selection Container */}
      <div className="bg-amber-900/20 border rounded-lg p-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
        {/* Instruction Header */}
        <div className="mb-4 pb-4 border-b" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
          <h2 className="text-xl font-bold text-amber-200 tracking-wider mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.15em' }}>SELECT A RECORD</h2>
          <p className="text-xs text-amber-300/80" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Press buttons A1-A20 to select datasets. Datasets are automatically downloaded when selected.
          </p>
        </div>
        <div className="flex items-center justify-center gap-4 relative z-10">
          {/* Left Display Panel - 10 slots in 2 columns */}
          <div className="flex-1 bg-amber-900/10 rounded-lg p-4 border" style={{ borderColor: 'rgba(234, 179, 8, 0.25)' }}>
            {/* Two columns of 5 slots each */}
            <div className="grid grid-cols-2 gap-2">
              {leftSlots.map((dataset, idx) => {
                if (!dataset) {
                  return (
                    <div key={`empty-${idx}`} className="bg-amber-900/10 rounded px-3 py-2 border" style={{ borderColor: 'rgba(234, 179, 8, 0.25)' }}>
                      <div className="text-[10px] text-amber-300/30">---</div>
                    </div>
                  );
                }
                
                const isLoaded = loadedDatasets.includes(dataset.id);
                const isSelected = selectedDataset === dataset.id;
                const isCurrentlyLoading = isLoading && isSelected;
                
                return (
                  <div 
                    key={dataset.id} 
                    className={`rounded-lg px-3 py-2 border transition-all ${
                    isSelected 
                        ? 'bg-gradient-to-br from-amber-900/40 to-amber-700/40 scale-105' 
                        : 'bg-amber-900/20 hover:bg-amber-900/30'
                    }`}
                    style={{ 
                      borderColor: 'rgba(234, 179, 8, 0.3)',
                      boxShadow: isSelected 
                        ? 'inset 0 0 20px rgba(255, 255, 255, 0.15), inset 0 0 40px rgba(255, 255, 255, 0.1), 0 0 10px rgba(255, 255, 255, 0.1)'
                        : 'none'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold truncate mb-1 ${
                          isSelected ? 'text-amber-200' : 'text-amber-300/90'
                        }`} style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>{dataset.name}</div>
                        {dataset.lab && (
                          <div className="text-xs text-amber-300/70 truncate mb-0.5" style={{ fontFamily: 'Orbitron, sans-serif' }}>{dataset.lab}</div>
                        )}
                        {dataset.region && (
                          <div className="text-xs text-amber-300/70 truncate mb-0.5" style={{ fontFamily: 'Orbitron, sans-serif' }}>{dataset.region}</div>
                        )}
                        {dataset.organism && (
                          <div className="text-xs text-amber-300/50 mb-0.5" style={{ fontFamily: 'Orbitron, sans-serif' }}>{dataset.organism}</div>
                        )}
                        {dataset.frameCount && (
                          <div className="text-xs text-amber-300/50" style={{ fontFamily: 'Orbitron, sans-serif' }}>🎬 {dataset.frameCount.toLocaleString()} frames</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                        {isCurrentlyLoading && (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        )}
                        {isLoaded && !isCurrentlyLoading && (
                          <Check className="w-3 h-3 text-amber-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Central Button Column - 20 buttons in 2 columns */}
          <div className="w-20 flex items-center justify-center gap-2 relative">
            {/* Left column of buttons (A1-A20, odd numbers) */}
            <div className="flex flex-col gap-2 relative z-10 items-center">
              {displayDatasets.filter((_, idx) => idx % 2 === 0).map((dataset, colIdx) => {
                const idx = colIdx * 2;
                const isSelected = dataset ? selectedDataset === dataset.id : false;
                const isCurrentlyLoading = isLoading && isSelected;
                const buttonLabel = getButtonLabel(idx);
                
                return (
                  <button
                    key={`left-${idx}-${dataset?.id || 'empty'}`}
                    onClick={() => {
                      if (dataset && !isCurrentlyLoading) {
                        handleSelect(dataset);
                      }
                    }}
                    disabled={!dataset || isCurrentlyLoading}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all relative ${
                      !dataset
                        ? 'bg-amber-900/10 text-amber-300/40 cursor-not-allowed'
                        : isCurrentlyLoading
                        ? 'circular-neon-loading'
                        : isSelected
                        ? 'bg-gradient-to-br from-amber-900/40 to-amber-700/40 scale-110 text-amber-200'
                        : 'bg-amber-900/20 text-amber-200 hover:bg-amber-900/30 hover:scale-105'
                    }`}
                    style={{ 
                      fontFamily: 'Bebas Neue, sans-serif', 
                      letterSpacing: '0.05em',
                      border: 'none',
                      boxShadow: isSelected 
                        ? '0 0 4px rgba(234, 179, 8, 0.3)'
                        : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (dataset && !isSelected && !isCurrentlyLoading) {
                        const button = e.currentTarget;
                        button.style.border = 'none';
                        button.style.boxShadow = 'none';
                        button.classList.add('circular-neon-hover');
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (dataset && !isSelected && !isCurrentlyLoading) {
                        const button = e.currentTarget;
                        button.classList.remove('circular-neon-hover');
                      }
                    }}
                    title={dataset?.name || 'Empty slot'}
                  >
                    {isCurrentlyLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      buttonLabel
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Right column of buttons (A2-A20, even numbers) */}
            <div className="flex flex-col gap-2 relative z-10 items-center">
              {displayDatasets.filter((_, idx) => idx % 2 === 1).map((dataset, colIdx) => {
                const idx = colIdx * 2 + 1;
                const isSelected = dataset ? selectedDataset === dataset.id : false;
                const isCurrentlyLoading = isLoading && isSelected;
                const buttonLabel = getButtonLabel(idx);
                
                return (
                  <button
                    key={`right-${idx}-${dataset?.id || 'empty'}`}
                    onClick={() => {
                      if (dataset && !isCurrentlyLoading) {
                        handleSelect(dataset);
                      }
                    }}
                    disabled={!dataset || isCurrentlyLoading}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all relative ${
                      !dataset
                        ? 'bg-amber-900/10 text-amber-300/40 cursor-not-allowed'
                        : isCurrentlyLoading
                        ? 'circular-neon-loading'
                        : isSelected
                        ? 'bg-gradient-to-br from-amber-900/40 to-amber-700/40 scale-110 text-amber-200'
                        : 'bg-amber-900/20 text-amber-200 hover:bg-amber-900/30 hover:scale-105'
                    }`}
                    style={{ 
                      fontFamily: 'Bebas Neue, sans-serif', 
                      letterSpacing: '0.05em',
                      border: 'none',
                      boxShadow: isSelected 
                        ? '0 0 4px rgba(234, 179, 8, 0.3)'
                        : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (dataset && !isSelected && !isCurrentlyLoading) {
                        const button = e.currentTarget;
                        button.style.border = 'none';
                        button.style.boxShadow = 'none';
                        button.classList.add('circular-neon-hover');
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (dataset && !isSelected && !isCurrentlyLoading) {
                        const button = e.currentTarget;
                        button.classList.remove('circular-neon-hover');
                      }
                    }}
                    title={dataset?.name || 'Empty slot'}
                  >
                    {isCurrentlyLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      buttonLabel
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Display Panel - 10 slots in 2 columns */}
          <div className="flex-1 bg-amber-900/10 rounded-lg p-4 border" style={{ borderColor: 'rgba(234, 179, 8, 0.25)' }}>
            {/* Two columns of 5 slots each */}
            <div className="grid grid-cols-2 gap-2">
              {rightSlots.map((dataset, idx) => {
                if (!dataset) {
                  return (
                    <div key={`empty-${idx + slotsPerSide}`} className="bg-amber-900/10 rounded px-3 py-2 border" style={{ borderColor: 'rgba(234, 179, 8, 0.25)' }}>
                      <div className="text-[10px] text-amber-300/30">---</div>
                    </div>
                  );
                }
                
                const isLoaded = loadedDatasets.includes(dataset.id);
                const isSelected = selectedDataset === dataset.id;
                const isCurrentlyLoading = isLoading && isSelected;
                
                return (
                  <div 
                    key={dataset.id} 
                    className={`rounded-lg px-3 py-2 border transition-all ${
                    isSelected 
                        ? 'bg-gradient-to-br from-amber-900/40 to-amber-700/40 scale-105' 
                        : 'bg-amber-900/20 hover:bg-amber-900/30'
                    }`}
                    style={{ 
                      borderColor: 'rgba(234, 179, 8, 0.3)',
                      boxShadow: isSelected 
                        ? 'inset 0 0 20px rgba(255, 255, 255, 0.15), inset 0 0 40px rgba(255, 255, 255, 0.1), 0 0 10px rgba(255, 255, 255, 0.1)'
                        : 'none'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold truncate mb-1 ${
                          isSelected ? 'text-amber-200' : 'text-amber-300/90'
                        }`} style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>{dataset.name}</div>
                        {dataset.lab && (
                          <div className="text-xs text-amber-300/70 truncate mb-0.5" style={{ fontFamily: 'Orbitron, sans-serif' }}>{dataset.lab}</div>
                        )}
                        {dataset.region && (
                          <div className="text-xs text-amber-300/70 truncate mb-0.5" style={{ fontFamily: 'Orbitron, sans-serif' }}>{dataset.region}</div>
                        )}
                        {dataset.organism && (
                          <div className="text-xs text-amber-300/50 mb-0.5" style={{ fontFamily: 'Orbitron, sans-serif' }}>{dataset.organism}</div>
                        )}
                        {dataset.frameCount && (
                          <div className="text-xs text-amber-300/50" style={{ fontFamily: 'Orbitron, sans-serif' }}>🎬 {dataset.frameCount.toLocaleString()} frames</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                        {isCurrentlyLoading && (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        )}
                        {isLoaded && !isCurrentlyLoading && (
                          <Check className="w-3 h-3 text-amber-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatasetSelector;

