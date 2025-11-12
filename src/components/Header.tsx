import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Play } from 'lucide-react';

interface HeaderProps {
  onNavigateToLanding?: () => void;
  onEnter?: () => void;
  onNavigateToAbout?: () => void;
  isHidden?: boolean;
}

function Header({ onNavigateToLanding, onEnter, onNavigateToAbout, isHidden = false }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header 
      className={`relative z-50 backdrop-blur-sm border-b transition-opacity duration-300 ${
        isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, rgba(92, 46, 12, 0.5) 0%, rgba(69, 45, 22, 0.6) 50%, rgba(58, 37, 18, 0.5) 100%)',
        borderColor: 'rgba(234, 179, 8, 0.3)'
      }}
    >
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Title on the left */}
          <div className="flex items-center">
            <h1 
              className="text-2xl md:text-3xl font-bold text-amber-200 cursor-pointer hover:text-amber-300 transition-colors"
              onClick={onNavigateToLanding}
              style={{ 
                fontFamily: 'Bungee, cursive', 
                letterSpacing: '0.05em',
                textShadow: '0 0 10px rgba(234, 179, 8, 0.4)'
              }}
            >
              BioBeats
            </h1>
          </div>

          {/* Buttons on the right */}
          <div className="flex items-center gap-3">
            {/* Enter Jukebox Button */}
            {onEnter && (
              <button
                onClick={onEnter}
                className="jukebox-button flex items-center gap-2 px-4 py-2"
                style={{ 
                  fontFamily: 'Bebas Neue, sans-serif', 
                  letterSpacing: '0.1em'
                }}
              >
                <Play className="w-4 h-4" />
                <span className="text-sm font-medium">ENTER JUKEBOX</span>
              </button>
            )}
            {/* Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="jukebox-button flex items-center gap-2 px-4 py-2"
                style={{ 
                  fontFamily: 'Bebas Neue, sans-serif', 
                  letterSpacing: '0.1em'
                }}
              >
                <span className="text-sm font-medium">MENU</span>
                <ChevronDown 
                  className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-56 backdrop-blur-sm border rounded-lg shadow-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(92, 46, 12, 0.95) 0%, rgba(69, 45, 22, 0.95) 50%, rgba(58, 37, 18, 0.95) 100%)',
                    borderColor: 'rgba(234, 179, 8, 0.3)'
                  }}
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        if (onNavigateToLanding) {
                          onNavigateToLanding();
                        }
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-amber-200 hover:bg-amber-900/40 hover:text-amber-300 transition-colors"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}
                    >
                      HOME
                    </button>
                    <button
                      onClick={() => {
                        if (onNavigateToAbout) {
                          onNavigateToAbout();
                        } else if (onEnter) {
                          onEnter();
                        }
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-amber-200 hover:bg-amber-900/40 hover:text-amber-300 transition-colors"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}
                    >
                      ABOUT
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

