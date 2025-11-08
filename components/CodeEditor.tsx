import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Editor } from '@monaco-editor/react';

interface CodeEditorProps {
  code: string;
  onCodeChange: (newCode: string | undefined) => void;
  filePath: string | null;
  onShowExplorer?: () => void;
}

const getLanguageForPath = (path: string | null): string => {
  if (!path) return 'plaintext';
  const extension = path.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
};

const CodeEditor: React.FC<CodeEditorProps> = ({ code, onCodeChange, filePath, onShowExplorer }) => {
  return (
    <div className="flex-grow flex flex-col h-full bg-ide-bg-darker">
       <div className="flex-shrink-0 h-10 bg-ide-bg border-b border-brand-subtle flex items-center">
            <button onClick={onShowExplorer} className="md:hidden p-2 text-brand-muted hover:text-white" aria-label="Back to files">
                <ChevronLeft className="w-5 h-5"/>
            </button>
            <div className={`h-full flex items-center px-4 text-sm text-white bg-ide-bg-darker ${filePath ? 'border-r border-brand-subtle' : ''}`}>
                {filePath || "No file selected"}
            </div>
      </div>
      <div className="flex-grow w-full h-full relative">
        <Editor
          height="100%"
          path={filePath || 'untitled'}
          language={getLanguageForPath(filePath)}
          value={code}
          onChange={onCodeChange}
          theme="vs-dark"
          defaultValue="// Select a file to view its content"
          options={{
            minimap: { enabled: false },
            fontFamily: '"Fira Code", monospace',
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
          loading={<div className="text-brand-muted">Loading editor...</div>}
        />
      </div>
    </div>
  );
};

export default CodeEditor;