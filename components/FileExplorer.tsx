import React, { useMemo, useState } from 'react';
import { FileSystem, FileNode } from '../types';
import { FileIcon, FolderIcon, ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon } from './icons/Icons';

interface FileExplorerProps {
  fileSystem: FileSystem;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
}

const buildFileTree = (fileSystem: FileSystem): FileNode[] => {
    // This approach correctly builds a tree from a flat path map
    const root: FileNode = { name: '/', path: '/', children: [] };
    const nodeMap: { [path: string]: FileNode } = { '/': root };

    Object.keys(fileSystem).sort().forEach(path => {
        const parts = path.split('/');
        parts.reduce((accPath, part, index) => {
            const currentPath = accPath ? `${accPath}/${part}` : part;
            if (!nodeMap[currentPath]) {
                // FIX: When accPath is an empty string, it means the parent is the root node ('/').
                // The original code `nodeMap[accPath]` would be `nodeMap['']` which is undefined and causes a crash.
                const parentNode = nodeMap[accPath || '/'];
                const newNode: FileNode = { name: part, path: currentPath };
                
                if (index < parts.length - 1) { // Directory
                    newNode.children = [];
                } else { // File
                    newNode.content = fileSystem[path];
                }
                
                // This check is now safe because parentNode is guaranteed to be found.
                // It also gracefully handles adding children to what might have been a file, converting it to a directory in the tree.
                parentNode.children = parentNode.children || [];
                parentNode.children.push(newNode);
                parentNode.children.sort((a, b) => {
                    if (a.children && !b.children) return -1;
                    if (!a.children && b.children) return 1;
                    return a.name.localeCompare(b.name);
                });
                nodeMap[currentPath] = newNode;
            }
            return currentPath;
        }, '');
    });

    return root.children || [];
};


const FileTree: React.FC<{ node: FileNode; activeFile: string | null; onFileSelect: (path: string) => void; level: number }> = ({ node, activeFile, onFileSelect, level }) => {
  const [isOpen, setIsOpen] = React.useState(true);

  if (node.children) { // Directory
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-1 cursor-pointer hover:bg-brand-surface/50 p-1 rounded-md"
          style={{ paddingLeft: `${level * 0.75}rem` }}
        >
          {isOpen ? <ChevronDownIcon className="w-4 h-4 flex-shrink-0" /> : <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />}
          <FolderIcon className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && node.children.map(child => (
          <FileTree key={child.path} node={child} activeFile={activeFile} onFileSelect={onFileSelect} level={level + 1} />
        ))}
      </div>
    );
  } else { // File
    return (
      <div
        onClick={() => onFileSelect(node.path)}
        className={`flex items-center space-x-2 cursor-pointer p-1 rounded-md ${activeFile === node.path ? 'bg-brand-accent/30' : 'hover:bg-brand-surface/50'}`}
        style={{ paddingLeft: `${level * 0.75}rem` }}
      >
        <FileIcon className="w-4 h-4 text-brand-muted flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }
};

const FileExplorer: React.FC<FileExplorerProps> = ({ fileSystem, activeFile, onFileSelect }) => {
  const fileTree = useMemo(() => buildFileTree(fileSystem), [fileSystem]);

  return (
    <div className="h-full w-full flex-shrink-0 bg-ide-bg border-r border-brand-subtle flex flex-col text-sm">
        <div className="p-2 border-b border-brand-subtle">
            <div className="flex items-center space-x-2 bg-brand-surface p-1 rounded-lg">
                <button className="flex-1 bg-ide-bg-darker shadow-sm p-1.5 rounded-md text-sm">Files</button>
                <button className="flex-1 p-1.5 rounded-md text-sm text-brand-muted hover:bg-ide-bg-darker/50">Search</button>
            </div>
            <div className="relative mt-2">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input type="text" placeholder="Search files" className="w-full bg-brand-surface/80 border border-brand-subtle rounded-lg pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"/>
            </div>
        </div>
      <div className="flex-grow p-2 overflow-y-auto">
        {fileTree.map(node => (
          <FileTree key={node.path} node={node} activeFile={activeFile} onFileSelect={onFileSelect} level={0} />
        ))}
      </div>
    </div>
  );
};

export default FileExplorer;