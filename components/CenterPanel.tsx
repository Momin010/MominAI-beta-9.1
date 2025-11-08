import React, { useState, useRef, useCallback } from 'react';
import FileExplorer from './FileExplorer';
import CodeEditor from './CodeEditor';
import WebContainerPreview from './WebContainerPreview';
import { FileSystem } from '../types';

interface CenterPanelProps {
  fileSystem: FileSystem;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  viewMode: 'preview' | 'code';
  onViewModeChange: (mode: 'preview' | 'code') => void;
  onFileSystemChange: (fs: FileSystem) => void;
  isBuilding: boolean;
  iframeUrl: string;
  previewStatus: string;
}

const CenterPanel: React.FC<CenterPanelProps> = ({
  fileSystem,
  activeFile,
  onFileSelect,
  viewMode,
  onViewModeChange,
  onFileSystemChange,
  isBuilding,
  iframeUrl,
  previewStatus,
}) => {
  const [explorerWidth, setExplorerWidth] = useState(256);
  const [mobileCodeView, setMobileCodeView] = useState<'explorer' | 'editor'>('explorer');

  const isResizing = useRef(false);

  const handleResize = useCallback((e: MouseEvent) => {
    if (isResizing.current) {
      // Adjusting for the left panel width being dynamic now
      const centerPanelStart = document.querySelector('.resizer')?.getBoundingClientRect().right || 0;
      setExplorerWidth(prev => Math.max(150, Math.min(e.clientX - centerPanelStart, 500)));
    }
  }, []);

  const stopResize = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResize);
  }, [handleResize]);
  
  const startResize = useCallback((e: React.MouseEvent) => {
    if (window.innerWidth < 768) return;
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResize);
  }, [handleResize, stopResize]);


  const handleCodeChange = (newContent: string) => {
    if (activeFile) {
        onFileSystemChange({
            ...fileSystem,
            [activeFile]: newContent
        });
    }
  };
    
  return (
    <div className="flex-grow w-full h-full flex flex-col bg-ide-bg-darker">
      {viewMode === 'code' ? (
        <div className="flex flex-grow overflow-hidden">
          {/* File Explorer Container */}
          <div 
            style={{ width: `${explorerWidth}px` }} 
            className={`
              flex-shrink-0 
              ${mobileCodeView === 'explorer' ? 'flex w-full' : 'hidden'}
              md:flex md:w-auto
            `}
          >
            <FileExplorer
                fileSystem={fileSystem}
                activeFile={activeFile}
                onFileSelect={(path) => { 
                  onFileSelect(path); 
                  setMobileCodeView('editor'); 
                }}
            />
          </div>
          <div onMouseDown={startResize} className="resizer hidden md:block" />

          {/* Code Editor Container */}
          <div className={`
              flex-grow
              ${mobileCodeView === 'editor' ? 'flex w-full' : 'hidden'}
              md:flex
            `}>
            <CodeEditor
                code={activeFile ? fileSystem[activeFile] : '// Select a file to view its content'}
                onCodeChange={handleCodeChange}
                filePath={activeFile}
                onShowExplorer={() => setMobileCodeView('explorer')}
            />
          </div>
        </div>
      ) : (
        <div className="flex-grow p-4 h-full">
            <WebContainerPreview 
              iframeUrl={iframeUrl}
              status={previewStatus}
            />
        </div>
      )}
    </div>
  );
};

export default CenterPanel;
