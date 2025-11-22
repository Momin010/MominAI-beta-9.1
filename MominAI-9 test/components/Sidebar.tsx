
import React from 'react';
import type { FileNode } from '../types';
import { FileTree } from './FileTree';
import { AgentControl } from './AgentControl';

interface SidebarProps {
  files: FileNode;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  agentContext: string;
  onAgentContextChange: (newContext: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ files, activeFile, onFileSelect, agentContext, onAgentContextChange }) => {
  return (
    <div className="h-full flex flex-col bg-transparent">
      <div className="flex-grow overflow-y-auto pt-2 px-2">
        <FileTree node={files} onFileSelect={onFileSelect} activeFile={activeFile} />
      </div>
       <div className="hidden md:block">
        {/* FIX: Corrected prop name from onContextChange to onAgentContextChange. */}
        <AgentControl context={agentContext} onContextChange={onAgentContextChange} />
       </div>
    </div>
  );
};
