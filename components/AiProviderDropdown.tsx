import React, { useState, useEffect, useRef } from 'react';
import { AiProvider } from '../types';
import { GeminiIcon, OpenAIIcon, ClaudeIcon, GroqIcon, OpenRouterIcon, ChevronDownIcon, SettingsIcon } from './icons/Icons';

interface AiProviderDropdownProps {
  selectedProvider: AiProvider;
  onProviderChange: (provider: AiProvider) => void;
  onManageKeysClick: () => void;
}

const providerDetails: Record<AiProvider, { name: string; icon: React.FC<{className?:string}> }> = {
  gemini: { name: 'Gemini', icon: GeminiIcon },
  openrouter: { name: 'OpenRouter', icon: OpenRouterIcon },
  openai: { name: 'OpenAI', icon: OpenAIIcon },
  claude: { name: 'Claude', icon: ClaudeIcon },
  groq: { name: 'Groq', icon: GroqIcon },
};

const AiProviderDropdown: React.FC<AiProviderDropdownProps> = ({ selectedProvider, onProviderChange, onManageKeysClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableKeys, setAvailableKeys] = useState<Record<AiProvider, boolean>>({
      gemini: true, // Always available
      openrouter: true, // Always available
      openai: false,
      claude: false,
      groq: false,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKeys = () => {
        setAvailableKeys({
            gemini: true,
            openrouter: true,
            openai: !!localStorage.getItem('openai_api_key'),
            claude: !!localStorage.getItem('claude_api_key'),
            groq: !!localStorage.getItem('groq_api_key'),
        });
    };
    checkKeys();
    // Re-check when window is focused in case user added a key in another tab
    window.addEventListener('focus', checkKeys);
    return () => window.removeEventListener('focus', checkKeys);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (provider: AiProvider) => {
    onProviderChange(provider);
    setIsOpen(false);
    if (!availableKeys[provider]) {
        setTimeout(onManageKeysClick, 100);
    }
  };

  const currentProvider = providerDetails[selectedProvider];

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-brand-surface text-white rounded-md py-1 px-2 border border-brand-subtle hover:border-brand-muted"
      >
        <currentProvider.icon className="w-4 h-4" />
        <span className="text-sm">{currentProvider.name}</span>
        <ChevronDownIcon className={`w-4 h-4 text-brand-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 w-48 bg-brand-surface rounded-lg border border-brand-subtle shadow-2xl z-20 overflow-hidden">
          <div className="p-1">
            {(Object.keys(providerDetails) as AiProvider[]).map((provider) => {
              const details = providerDetails[provider];
              return (
                <button
                  key={provider}
                  onClick={() => handleSelect(provider)}
                  className="w-full flex items-center space-x-2 p-2 text-left text-sm text-white rounded-md hover:bg-brand-accent/30"
                >
                  <details.icon className="w-4 h-4" />
                  <span>{details.name}</span>
                  {!availableKeys[provider] && <div className="w-2 h-2 rounded-full bg-yellow-500 ml-auto" title="API Key missing"></div>}
                </button>
              );
            })}
          </div>
          <div className="border-t border-brand-subtle p-1">
             <button
                onClick={() => {
                    onManageKeysClick();
                    setIsOpen(false);
                }}
                className="w-full flex items-center space-x-2 p-2 text-left text-sm text-brand-muted rounded-md hover:bg-brand-accent/30 hover:text-white"
             >
                <SettingsIcon className="w-4 h-4"/>
                <span>Manage Keys</span>
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiProviderDropdown;
