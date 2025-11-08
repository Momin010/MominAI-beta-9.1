import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronLeft,
    Settings
} from 'lucide-react';
import {
    EyeIcon,
    CodeBracketIcon,
    ShareIcon,
    GithubIcon,
    SettingsIcon
} from './icons/Icons';
import { useAuth } from '../contexts/AuthContext';
import { themeService } from '../services/themeService';
import { shortcutService } from '../services/shortcutService';

interface HeaderProps {
  projectName: string;
  viewMode: 'preview' | 'code';
  onViewModeChange: (mode: 'preview' | 'code') => void;
  isBuilding: boolean;
  onExit: () => void;
  projectUpdatedAt?: string;
  onOpenSettings: () => void;
  onOpenGithubModal: () => void;
  mobileView: 'chat' | 'editor';
  onMobileViewChange: (view: 'chat' | 'editor') => void;
  isBootingWebContainer?: boolean;
  isInstallingDeps?: boolean;
  isStartingServer?: boolean;
  bootProgress?: number;
}

const UserProfile: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
    const { user, signOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        const { error } = await signOut();
        if (error) {
            console.error('Error signing out:', error);
            alert('Failed to sign out. Please try again.');
        }
        // onAuthStateChange listener in AuthContext handles redirect
    };

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-8 h-8 bg-brand-surface rounded-full flex items-center justify-center hover:ring-2 hover:ring-brand-accent">
                <span className="text-sm font-semibold text-white">{user.email?.charAt(0).toUpperCase()}</span>
            </button>
            {isOpen && (
                 <div className="absolute right-0 mt-2 w-56 bg-brand-surface rounded-lg border border-brand-subtle shadow-2xl z-20 overflow-hidden">
                    <div className="p-3 border-b border-brand-subtle">
                        <p className="text-sm font-medium text-white truncate">{user.email}</p>
                    </div>
                    <div className="p-1">
                         <button onClick={() => { onOpenSettings(); setIsOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm text-brand-muted rounded-md hover:bg-brand-subtle/50 hover:text-white flex items-center space-x-2">
                            <SettingsIcon className="w-4 h-4" />
                            <span>Settings</span>
                         </button>
                         <button onClick={handleSignOut} className="w-full text-left px-3 py-1.5 text-sm text-brand-muted rounded-md hover:bg-brand-subtle/50 hover:text-white">
                            Sign Out
                         </button>
                    </div>
                </div>
            )}
        </div>
    );
};


const Header: React.FC<HeaderProps> = ({
    projectName,
    viewMode,
    onViewModeChange,
    isBuilding,
    onExit,
    projectUpdatedAt,
    onOpenSettings,
    onOpenGithubModal,
    mobileView,
    onMobileViewChange,
    isBootingWebContainer = false,
    isInstallingDeps = false,
    isStartingServer = false,
    bootProgress = 0,
}) => {
  const [timeAgo, setTimeAgo] = useState('');
  const [currentTheme, setCurrentTheme] = useState(themeService.getCurrentTheme());

  // Setup theme change listener
  useEffect(() => {
    const handleThemeChange = () => {
      setCurrentTheme(themeService.getCurrentTheme());
    };

    // Listen for theme changes (we'd need to implement this in themeService)
    // For now, just set initial theme
    handleThemeChange();
  }, []);

  useEffect(() => {
    const updateTimestamp = () => {
      if (!projectUpdatedAt) {
        setTimeAgo('Not saved yet');
        return;
      }
      const now = new Date();
      const updatedDate = new Date(projectUpdatedAt);
      const seconds = Math.floor((now.getTime() - updatedDate.getTime()) / 1000);

      if (seconds < 5) {
        setTimeAgo('Saved just now');
      } else if (seconds < 60) {
        setTimeAgo(`Saved ${seconds}s ago`);
      } else if (seconds < 3600) {
        setTimeAgo(`Saved ${Math.floor(seconds / 60)}m ago`);
      } else {
        setTimeAgo(`Saved ${updatedDate.toLocaleTimeString()}`);
      }
    };
    
    updateTimestamp();
    const interval = setInterval(updateTimestamp, 5000); // update every 5 seconds
    return () => clearInterval(interval);
  }, [projectUpdatedAt]);

  return (
    <div className="flex-shrink-0 h-16 bg-ide-bg border-b border-brand-subtle flex items-center justify-between px-2 md:px-4 text-sm">
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        <button onClick={onExit} className="p-1.5 rounded-md hover:bg-brand-surface text-brand-muted hover:text-white">
            <ChevronLeft className="w-5 h-5"/>
        </button>
        <div className="min-w-0">
          <h1 className="font-semibold text-white truncate max-w-[80px] sm:max-w-[120px] md:max-w-xs">{projectName}</h1>
          <p className="text-xs text-brand-muted hidden sm:block">
            {timeAgo}
          </p>
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2">
        {/* Mobile: Chat/Editor Toggle */}
        <div className="flex items-center space-x-1 bg-brand-surface p-1 rounded-lg md:hidden">
            <button
                onClick={() => onMobileViewChange('chat')}
                className={`px-4 py-1 rounded-md text-sm ${mobileView === 'chat' ? 'bg-ide-bg-darker shadow-sm' : 'text-brand-muted'}`}
            >
                Chat
            </button>
            <button
                onClick={() => onMobileViewChange('editor')}
                className={`px-4 py-1 rounded-md text-sm ${mobileView === 'editor' ? 'bg-ide-bg-darker shadow-sm' : 'text-brand-muted'}`}
            >
                Editor
            </button>
        </div>

        {/* Desktop: Preview/Code Toggle */}
        <div className="hidden md:flex items-center space-x-2 bg-brand-surface p-1 rounded-lg">
            <button
                onClick={() => onViewModeChange('preview')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-sm ${viewMode === 'preview' ? 'bg-ide-bg-darker shadow-sm' : 'hover:bg-ide-bg-darker/50'} ${isBuilding || isBootingWebContainer || isInstallingDeps || isStartingServer ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isBuilding || isBootingWebContainer || isInstallingDeps || isStartingServer}
            >
                <EyeIcon className="w-4 h-4" />
                <span>Preview</span>
            </button>
            <button
                onClick={() => onViewModeChange('code')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-sm ${viewMode === 'code' ? 'bg-ide-bg-darker shadow-sm' : 'hover:bg-ide-bg-darker/50'} ${isBuilding || isBootingWebContainer || isInstallingDeps || isStartingServer ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isBuilding || isBootingWebContainer || isInstallingDeps || isStartingServer}
            >
                <CodeBracketIcon className="w-4 h-4" />
                <span>Code</span>
            </button>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-2 md:space-x-4 flex-1">
        <div className="hidden sm:flex items-center space-x-1 md:space-x-3">
          <button className="p-2 bg-brand-surface rounded-lg hover:bg-brand-surface/80"><ShareIcon className="w-4 h-4"/></button>
          <button onClick={onOpenGithubModal} className="p-2 bg-brand-surface rounded-lg hover:bg-brand-surface/80">
            <GithubIcon className="w-4 h-4"/>
          </button>
        </div>
         <UserProfile onOpenSettings={onOpenSettings} />
      </div>
    </div>
  );
};

export default Header;