import React, { useState, useEffect } from 'react';
import { AiProvider } from '../types';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [claudeKey, setClaudeKey] = useState('');
  const [openAIKey, setOpenAIKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [pexelsKey, setPexelsKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setClaudeKey(localStorage.getItem('claude_api_key') || '');
      setOpenAIKey(localStorage.getItem('openai_api_key') || '');
      setGroqKey(localStorage.getItem('groq_api_key') || '');
      setPexelsKey(localStorage.getItem('pexels_api_key') || '');
    }
  }, [isOpen]);

  const handleSave = () => {
    if (claudeKey) localStorage.setItem('claude_api_key', claudeKey);
    else localStorage.removeItem('claude_api_key');

    if (openAIKey) localStorage.setItem('openai_api_key', openAIKey);
    else localStorage.removeItem('openai_api_key');

    if (groqKey) localStorage.setItem('groq_api_key', groqKey);
    else localStorage.removeItem('groq_api_key');
    
    if (pexelsKey) localStorage.setItem('pexels_api_key', pexelsKey);
    else localStorage.removeItem('pexels_api_key');

    onClose();
  };

  if (!isOpen) return null;

  const providers: { name: string; storageKey: string; key: string; setKey: (k:string)=>void; url: string }[] = [
    { name: 'OpenAI', storageKey: 'openai_api_key', key: openAIKey, setKey: setOpenAIKey, url: 'https://platform.openai.com/api-keys' },
    { name: 'Anthropic (Claude)', storageKey: 'claude_api_key', key: claudeKey, setKey: setClaudeKey, url: 'https://console.anthropic.com/settings/keys' },
    { name: 'Groq', storageKey: 'groq_api_key', key: groqKey, setKey: setGroqKey, url: 'https://console.groq.com/keys' },
    { name: 'Pexels (for Images)', storageKey: 'pexels_api_key', key: pexelsKey, setKey: setPexelsKey, url: 'https://www.pexels.com/api/' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-brand-surface rounded-xl border border-brand-subtle w-full max-w-md p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-1">Manage API Keys</h2>
        <p className="text-sm text-brand-muted mb-6">Your keys are stored securely in your browser's local storage.</p>

        <div className="space-y-4">
            {providers.map(({ name, key, setKey, url}) => (
                <div key={name}>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-medium text-white">{name}</label>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-accent hover:underline">
                            Get API key
                        </a>
                    </div>
                    <input
                        type="password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder={`Paste your ${name} API key here`}
                        className="w-full bg-ide-bg-darker border border-brand-subtle rounded-lg p-2.5 text-sm placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    />
                </div>
            ))}
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-brand-subtle/50 hover:bg-brand-subtle/80 text-white">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-accent hover:bg-blue-500 text-white">
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;