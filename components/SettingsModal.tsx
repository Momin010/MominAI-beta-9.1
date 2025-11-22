import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ProjectVersion } from '../types';
import { projectService } from '../services/projectService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, projectId }) => {
  const [theme, setTheme] = useState('dark');
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  useEffect(() => {
    if (isOpen && projectId) {
      setIsLoadingVersions(true);
      projectService.getProjectVersions(projectId)
        .then(setVersions)
        .catch(err => console.error("Failed to fetch versions:", err))
        .finally(() => setIsLoadingVersions(false));
    } else {
        setVersions([]);
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-brand-surface rounded-xl border border-brand-subtle w-full max-w-lg p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Settings</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-brand-subtle/50 text-brand-muted hover:text-white">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-medium text-brand-muted mb-2">Appearance</h3>
                <div className="bg-ide-bg-darker p-4 rounded-lg border border-brand-subtle">
                    <label className="block text-sm text-white mb-2">Theme</label>
                    <div className="flex items-center space-x-2 bg-brand-surface p-1 rounded-md">
                        <button 
                            onClick={() => setTheme('light')}
                            className={`flex-1 py-1.5 text-sm rounded ${theme === 'light' ? 'bg-ide-bg shadow-sm' : 'text-brand-muted hover:bg-ide-bg/50'}`}
                        >
                            Light
                        </button>
                        <button
                             onClick={() => setTheme('dark')}
                            className={`flex-1 py-1.5 text-sm rounded ${theme === 'dark' ? 'bg-ide-bg shadow-sm' : 'text-brand-muted hover:bg-ide-bg/50'}`}
                        >
                            Dark
                        </button>
                    </div>
                </div>
            </div>
             <div>
                <h3 className="text-sm font-medium text-brand-muted mb-2">Version History</h3>
                <div className="bg-ide-bg-darker p-4 rounded-lg border border-brand-subtle max-h-64 overflow-y-auto">
                    {isLoadingVersions ? (
                        <p className="text-sm text-brand-muted text-center">Loading history...</p>
                    ) : versions.length > 0 ? (
                        <ul className="space-y-2">
                            {versions.map(version => (
                                <li key={version.id} className="text-sm p-2 rounded-md bg-brand-surface/50">
                                    <p className="text-white">
                                        Checkpoint saved at <span className="font-medium">{new Date(version.created_at).toLocaleString()}</span>
                                    </p>
                                    {version.summary && <p className="text-xs text-brand-muted mt-1 italic">"{version.summary}"</p>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-sm text-brand-muted text-center">No version history available for this project.</p>
                    )}
                </div>
            </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-accent hover:bg-blue-500 text-white">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
