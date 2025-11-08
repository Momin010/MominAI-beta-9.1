import React, { useState, useEffect } from 'react';
import { X, FileIcon } from 'lucide-react';
import { Message, FileSystem } from '../types';

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: string[];
  diff: Message['diff'];
}

const DiffViewer: React.FC<{ oldContent: string; newContent: string }> = ({ oldContent, newContent }) => {
    const isBinary = oldContent.startsWith('base64:') || newContent.startsWith('base64:');

    if (isBinary) {
        return (
            <div className="flex-grow flex items-center justify-center text-brand-muted">
                <p>Binary file content not displayed.</p>
            </div>
        );
    }
  return (
    <div className="flex-grow grid grid-cols-2 gap-4 font-mono text-xs overflow-auto">
      <div className="bg-red-900/20 p-3 rounded-lg overflow-auto">
        <pre className="text-red-200 whitespace-pre-wrap break-all">{oldContent}</pre>
      </div>
      <div className="bg-green-900/20 p-3 rounded-lg overflow-auto">
        <pre className="text-green-200 whitespace-pre-wrap break-all">{newContent}</pre>
      </div>
    </div>
  );
};

const DiffModal: React.FC<DiffModalProps> = ({ isOpen, onClose, files, diff }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && files.length > 0) {
      setSelectedFile(files[0]);
    } else {
      setSelectedFile(null);
    }
  }, [isOpen, files]);

  if (!isOpen) return null;

  const getFileStatus = (path: string) => {
    const oldExists = diff?.oldFS.hasOwnProperty(path);
    const newExists = diff?.newFS.hasOwnProperty(path);
    if (newExists && !oldExists) return 'A'; // Added
    if (!newExists && oldExists) return 'D'; // Deleted
    if (newExists && oldExists && diff?.oldFS[path] !== diff?.newFS[path]) return 'M'; // Modified
    return '';
  };

  const oldContent = (selectedFile && diff?.oldFS[selectedFile]) || '';
  const newContent = (selectedFile && diff?.newFS[selectedFile]) || '';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-brand-surface rounded-xl border border-brand-subtle w-full max-w-6xl h-[80vh] p-4 shadow-2xl mx-4 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0 flex justify-between items-center mb-4 pb-4 border-b border-brand-subtle">
          <h2 className="text-xl font-semibold">File Changes</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-brand-subtle/50 text-brand-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-grow flex flex-row min-h-0">
          <div className="w-1/4 flex-shrink-0 pr-4 border-r border-brand-subtle overflow-y-auto">
            <ul className="space-y-1">
              {files.map(file => {
                const status = getFileStatus(file);
                return (
                  <li key={file}>
                    <button
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-left p-2 rounded-md text-sm flex items-center space-x-2 ${selectedFile === file ? 'bg-brand-accent/30 text-white' : 'hover:bg-brand-subtle/50'}`}
                    >
                      <span className={`w-4 h-4 rounded text-xs flex items-center justify-center font-bold ${
                          status === 'A' ? 'bg-green-500' : 
                          status === 'D' ? 'bg-red-500' : 
                          status === 'M' ? 'bg-yellow-500' : ''
                        }`}
                      >
                        {status}
                      </span>
                      <FileIcon className="w-4 h-4 text-brand-muted flex-shrink-0" />
                      <span className="truncate">{file}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="w-3/4 pl-4 flex flex-col">
            {selectedFile ? (
              <>
                <div className="flex-shrink-0 mb-2 flex justify-around text-sm font-semibold">
                    <span className="text-red-300">Before</span>
                    <span className="text-green-300">After</span>
                </div>
                <DiffViewer oldContent={oldContent} newContent={newContent} />
              </>
            ) : (
              <div className="flex-grow flex items-center justify-center text-brand-muted">
                <p>Select a file to view changes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffModal;
