import React, { useRef, useEffect, useState } from 'react';
import type { Settings } from '../types';

declare const window: any;

interface EditorPanelProps {
  content: string;
  activeFile: string | null;
  openFiles: string[];
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
  settings: Settings;
}

const loadMonaco = (callback: () => void) => {
    if (window.monaco) {
        callback();
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js';
    script.onload = () => {
        window.MonacoEnvironment = {
            getWorkerUrl: function (_moduleId: any, label: string) {
                if (label === 'json') {
                    return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/json/json.worker.js';
                }
                if (label === 'css' || label === 'scss' || label === 'less') {
                    return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/css/css.worker.js';
                }
                if (label === 'html' || label === 'handlebars' || label === 'razor') {
                    return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/html/html.worker.js';
                }
                if (label === 'typescript' || label === 'javascript') {
                    return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/typescript/ts.worker.js';
                }
                return 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/editor/editor.worker.js';
            }
        };
        window.require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }});
        window.require(['vs/editor/editor.main'], callback);
    };
    document.body.appendChild(script);
};

export const EditorPanel: React.FC<EditorPanelProps> = ({ content, activeFile, openFiles, onTabSelect, onTabClose, settings }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoInstanceRef = useRef<any>(null);
  const [isMonacoReady, setIsMonacoReady] = useState(false);

  useEffect(() => {
    loadMonaco(() => {
        setIsMonacoReady(true);
    });
  }, []);

  useEffect(() => {
    if (isMonacoReady && editorRef.current && !monacoInstanceRef.current) {
        window.monaco.editor.defineTheme('glass-theme-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#00000000', // Transparent background
                'editorGutter.background': '#00000000',
                'editorLineNumber.foreground': '#ffffff50',
            },
        });
        window.monaco.editor.defineTheme('glass-theme-light', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#ffffff10', // Slightly white for readability
                'editorGutter.background': '#00000000',
                'editorLineNumber.foreground': '#00000050',
            },
        });

        monacoInstanceRef.current = window.monaco.editor.create(editorRef.current, {
            value: '',
            language: 'typescript',
            theme: settings.theme === 'dark' ? 'glass-theme-dark' : 'glass-theme-light',
            automaticLayout: true,
            fontSize: settings.editorFontSize,
            minimap: { enabled: false },
        });
    }

    return () => {
        // No aggressive disposal to keep models alive
    };
  }, [isMonacoReady, settings.theme, settings.editorFontSize]);

  useEffect(() => {
    if (monacoInstanceRef.current) {
        window.monaco.editor.setTheme(settings.theme === 'dark' ? 'glass-theme-dark' : 'glass-theme-light');
        monacoInstanceRef.current.updateOptions({ fontSize: settings.editorFontSize });
    }
  }, [settings.theme, settings.editorFontSize]);


  useEffect(() => {
    if (monacoInstanceRef.current && activeFile) {
      const uri = window.monaco.Uri.parse(activeFile);
      let model = window.monaco.editor.getModel(uri);

      if (!model) {
        const fileExtension = activeFile.split('.').pop();
        let language = 'plaintext';
        if (fileExtension === 'ts' || fileExtension === 'tsx') language = 'typescript';
        else if (fileExtension === 'js' || fileExtension === 'jsx') language = 'javascript';
        else if (fileExtension === 'json') language = 'json';
        else if (fileExtension === 'html') language = 'html';
        else if (fileExtension === 'css') language = 'css';
        else if (fileExtension === 'md') language = 'markdown';

        model = window.monaco.editor.createModel(content, language, uri);
      }
      
      if(model.getValue() !== content){
          // Use pushEditOperations to not reset the undo stack
          model.pushEditOperations([], [{
              range: model.getFullModelRange(),
              text: content
          }], () => null);
      }
      
      if(monacoInstanceRef.current.getModel() !== model){
          monacoInstanceRef.current.setModel(model);
      }
    } else if (monacoInstanceRef.current && !activeFile) {
        monacoInstanceRef.current.setModel(null);
    }
  }, [activeFile, content, isMonacoReady]);

  const handleTabClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const modelToDispose = window.monaco.editor.getModel(window.monaco.Uri.parse(path));
    if (modelToDispose) {
      modelToDispose.dispose();
    }
    onTabClose(path);
  }

  return (
    <div className="h-full w-full flex flex-col bg-transparent">
      <div className="flex bg-black/10 dark:bg-black/20 backdrop-blur-sm">
        {openFiles.map(path => (
          <div
            key={path}
            onClick={() => onTabSelect(path)}
            className={`flex items-center px-4 py-2 cursor-pointer border-r border-white/20 dark:border-white/20 transition-all duration-200 ${activeFile === path ? 'bg-white/20 backdrop-blur-md' : 'bg-transparent text-gray-200 dark:text-gray-300'}`}
          >
            <span className="text-sm text-white">{path.split('/').pop()}</span>
            <button onClick={(e) => handleTabClose(e, path)} className="ml-3 text-gray-300 hover:text-white">&times;</button>
          </div>
        ))}
      </div>
      <div className="relative flex-1">
        <div ref={editorRef} className="absolute inset-0" />
      </div>
    </div>
  );
};