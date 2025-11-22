import React from 'react';
import type { Settings } from '../types';
import { XIcon } from './icons';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (newSettings: Settings) => void;
  onResetWorkspace: () => void;
}

const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string; }> = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between cursor-pointer">
    <span className="text-gray-200 dark:text-gray-200">{label}</span>
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={`block w-10 h-6 rounded-full transition ${checked ? 'bg-blue-500' : 'bg-black/20 dark:bg-black/20'}`}></div>
      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
    </div>
  </label>
);

const Select: React.FC<{ value: string; onChange: (value: string) => void; label: string; children: React.ReactNode }> = ({ value, onChange, label, children }) => (
    <label className="flex items-center justify-between">
        <span className="text-gray-200 dark:text-gray-200">{label}</span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-40 bg-black/20 dark:bg-black/20 border border-white/20 rounded-md px-2 py-1 text-sm text-white focus:ring-1 focus:ring-blue-400 focus:outline-none"
        >
            {children}
        </select>
    </label>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, onSettingsChange, onResetWorkspace }) => {
  if (!isOpen) return null;

  const handleSettingChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center backdrop-blur-lg" onClick={onClose}>
      <div
        className="glass-panel rounded-lg shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20">
            <XIcon className="w-5 h-5 text-gray-300 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Appearance Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">Appearance</h3>
            <Toggle
              label="Dark Mode"
              checked={settings.theme === 'dark'}
              onChange={(checked) => handleSettingChange('theme', checked ? 'dark' : 'light')}
            />
            <Select
                label="Editor Font Size"
                value={String(settings.editorFontSize)}
                onChange={(value) => handleSettingChange('editorFontSize', Number(value))}
            >
                <option value="12">12px</option>
                <option value="14">14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
            </Select>
          </div>

          {/* AI Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">AI Settings</h3>
            <Select
                label="Primary AI Model"
                value={settings.aiModel}
                onChange={(value) => handleSettingChange('aiModel', value as 'gemini-2.5-pro' | 'gemini-2.5-flash')}
            >
                <option value="gemini-2.5-flash">Gemini Flash (Fast)</option>
                <option value="gemini-2.5-pro">Gemini Pro (Advanced)</option>
            </Select>
             <Toggle
              label="Enable Deep Thinking by default"
              checked={settings.deepThinkingDefault}
              onChange={(checked) => handleSettingChange('deepThinkingDefault', checked)}
            />
          </div>
          
          {/* General Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">General</h3>
            <div>
                <button
                    onClick={onResetWorkspace}
                    className="w-full px-4 py-2 bg-red-500/30 text-red-100 rounded-md hover:bg-red-500/50 transition-colors text-sm font-medium"
                >
                    Reset Workspace
                </button>
                <p className="text-xs text-gray-400 dark:text-gray-400 mt-2">This will delete all files and restore the initial project state. This action cannot be undone.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};