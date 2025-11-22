import React, { useState } from 'react';
import type { FileNode } from '../types';
import { ChevronRightIcon, FolderIcon, FileIcon } from './icons';

interface FileTreeProps {
  node: FileNode;
  onFileSelect: (path: string) => void;
  activeFile: string | null;
  depth?: number;
  path?: string;
}

export const FileTree: React.FC<FileTreeProps> = ({ node, onFileSelect, activeFile, depth = 0, path = '' }) => {
  const [isOpen, setIsOpen] = useState(depth < 2);

  const currentPath = path ? `${path}/${node.name}` : node.name;
  
  if (node.name === 'root') {
      return (
        <div>
            {node.children?.map(child => (
                <FileTree key={child.name} node={child} onFileSelect={onFileSelect} activeFile={activeFile} depth={depth} path="" />
            ))}
        </div>
      )
  }

  if (node.type === 'folder') {
    return (
      <div style={{ paddingLeft: `${depth * 1}rem` }}>
        <div
          className="flex items-center cursor-pointer py-1 px-2 hover:bg-white/10 dark:hover:bg-white/10 rounded"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronRightIcon className={`w-4 h-4 mr-1 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          <FolderIcon className="w-5 h-5 mr-2 text-sky-400" />
          <span className="text-gray-200 dark:text-gray-200">{node.name}</span>
        </div>
        {isOpen && (
          <div>
            {node.children?.slice().sort((a,b) => {
                if (a.type === 'folder' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'folder') return 1;
                return a.name.localeCompare(b.name);
            }).map(child => (
              <FileTree key={child.name} node={child} onFileSelect={onFileSelect} activeFile={activeFile} depth={depth + 1} path={currentPath} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: `${depth * 1}rem` }}>
      <div
        className={`flex items-center cursor-pointer py-1 px-2 hover:bg-white/10 dark:hover:bg-white/10 rounded ${activeFile === currentPath ? 'bg-white/20' : ''}`}
        onClick={() => onFileSelect(currentPath)}
      >
        <FileIcon className="w-5 h-5 mr-2 text-gray-300" />
        <span className="text-gray-200 dark:text-gray-200">{node.name}</span>
      </div>
    </div>
  );
};