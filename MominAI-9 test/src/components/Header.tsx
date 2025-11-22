import React from 'react';
import { Link } from 'react-router-dom';
import { 
    ChevronDownIcon, GlobeIcon, CloudIcon, CodeIcon, 
    ChartLineIcon, GithubIcon, SettingsIcon
} from './icons';
import type { MainViewMode } from '../types';
import { useAuth } from '../contexts/AuthContext';


interface IconButtonProps {
    children: React.ReactNode;
    className?: string;
    isActive?: boolean;
    onClick?: () => void;
    title?: string;
}

const IconButton: React.FC<IconButtonProps> = ({ children, className = '', isActive = false, onClick, title }) => (
    <button onClick={onClick} title={title} className={`w-8 h-8 flex items-center justify-center rounded-md text-gray-200 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-white/20 transition-colors ${isActive ? 'bg-blue-500/50 text-white' : ''} ${className}`}>
        {children}
    </button>
);

interface HeaderProps {
    onSettingsClick: () => void;
    mainViewMode: MainViewMode;
    onMainViewModeChange: (mode: MainViewMode) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick, mainViewMode, onMainViewModeChange }) => {
  const { user, signOut } = useAuth();
  const location = window.location;
  const isDashboard = location.pathname.includes('/dashboard');

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between px-2 md:px-4 text-sm m-2 sm:m-4 mb-0 rounded-xl glass-panel">
      {/* Left Section */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2">
            <div>
                <div className="flex items-center">
                    <span className="font-semibold text-white dark:text-white whitespace-nowrap">AI React IDE</span>
                    <ChevronDownIcon className="w-4 h-4 ml-1 text-gray-300 dark:text-gray-300" />
                </div>
            </div>
        </Link>
      </div>

      {/* Center Section - Toolbar */}
      {!isDashboard && (
          <div className="hidden lg:flex flex-1 justify-center items-center min-w-0">
            <div className="flex items-center p-1 bg-black/10 dark:bg-black/20 rounded-lg border border-white/10 gap-1">
                <IconButton onClick={() => onMainViewModeChange('CODE')} isActive={mainViewMode === 'CODE'} title="Code"><CodeIcon className="w-5 h-5" /></IconButton>
                <IconButton onClick={() => onMainViewModeChange('PREVIEW')} isActive={mainViewMode === 'PREVIEW'} title="Preview"><GlobeIcon className="w-5 h-5" /></IconButton>
                <IconButton onClick={() => onMainViewModeChange('CLOUD')} isActive={mainViewMode === 'CLOUD'} title="Cloud"><CloudIcon className="w-5 h-5" /></IconButton>
                <IconButton onClick={() => onMainViewModeChange('ANALYTICS')} isActive={mainViewMode === 'ANALYTICS'} title="Analytics"><ChartLineIcon className="w-5 h-5" /></IconButton>
            </div>
          </div>
      )}

      {/* Right Section */}
      <div className="flex items-center gap-1 md:gap-2">
        <IconButton><GithubIcon className="w-5 h-5" /></IconButton>
        {onSettingsClick && <IconButton onClick={onSettingsClick}><SettingsIcon className="w-5 h-5" /></IconButton>}
        {user ? (
            <div className="flex items-center gap-2">
                <img src={user.user_metadata.avatar_url} alt={user.email} className="w-8 h-8 rounded-full border-2 border-white/30" />
                <button onClick={signOut} className="px-3 py-1.5 bg-white/10 dark:bg-white/10 rounded-md text-white dark:text-white hover:bg-white/20 dark:hover:bg-white/20">
                    Sign Out
                </button>
            </div>
        ) : (
            <Link to="/" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold">
                Sign In
            </Link>
        )}
      </div>
    </header>
  );
};
