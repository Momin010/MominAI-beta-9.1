
import React from 'react';
import { EditorPanel } from './EditorPanel';
import type { Settings } from '../types';

interface MainPanelProps {
  editorContent: string;
  activeFile: string | null;
  openFiles: string[];
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
  settings: Settings;
}

export const MainPanel: React.FC<MainPanelProps> = (props) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-transparent">
      <EditorPanel 
        content={props.editorContent} 
        activeFile={props.activeFile}
        openFiles={props.openFiles}
        onTabSelect={props.onTabSelect}
        onTabClose={props.onTabClose}
        settings={props.settings}
      />
    </div>
  );
};