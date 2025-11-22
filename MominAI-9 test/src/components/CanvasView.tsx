import React, { useState, useCallback, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import Panzoom from '@panzoom/panzoom';
import type { FlowData } from '../types';
import { PencilIcon, CheckCircle2Icon, SpinnerIcon, PlusIcon, MinusIcon, RefreshCwIcon } from './icons';

const lightTheme = {
    background: '#ffffff',
    primaryColor: '#f0f0f0',
    primaryTextColor: '#111827',
    lineColor: '#6b7280',
    nodeBorder: '#9ca3af',
    mainBkg: '#e5e7eb',
    textColor: '#1f2937',
};
const darkTheme = {
    background: '#00000000',
    primaryColor: '#3c3c3c50',
    primaryTextColor: '#e0e0e0',
    lineColor: '#a0a0a0',
    nodeBorder: '#ffffff',
    mainBkg: '#4a4a4a50',
    textColor: '#e0e0e0',
};

// FIX: Define CanvasViewProps interface to fix TypeScript error.
interface CanvasViewProps {
  initialFlow: FlowData;
  onAcceptPlan: (flow: FlowData) => void;
  theme: 'light' | 'dark';
}

export const CanvasView: React.FC<CanvasViewProps> = ({ initialFlow, onAcceptPlan, theme }) => {
  const [mermaidCode, setMermaidCode] = useState(initialFlow);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const panzoomInstanceRef = useRef<any>(null);
  
  const currentTheme = theme === 'dark' ? 'dark' : 'default';

  useEffect(() => {
    let panzoom: any = null;
    const container = mermaidRef.current;
    
    // FIX: Configure mermaid inside the useEffect to handle dynamic theme changes correctly.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: currentTheme,
      themeVariables: currentTheme === 'dark' ? darkTheme : lightTheme,
    });

    const renderMermaid = async () => {
      if (container) {
        setIsLoading(true);
        setError(null);
        try {
          // The key ensures that mermaid re-renders when the code and theme change
          const uniqueId = `mermaid-graph-${Date.now()}`;
          const { svg } = await mermaid.render(uniqueId, mermaidCode);
          container.innerHTML = svg;
          
          const svgElement = container.querySelector('svg');
          if (svgElement) {
              svgElement.style.cursor = 'grab';
              panzoom = Panzoom(svgElement, {
                maxScale: 5,
                minScale: 0.3,
                contain: 'outside',
              });
              panzoomInstanceRef.current = panzoom;
              container.addEventListener('wheel', panzoom.zoomWithWheel);
          }
        } catch (e: any) {
          console.error("Mermaid render error:", e);
          setError(e.message || 'Failed to render diagram. Check syntax.');
          container.innerHTML = '';
        } finally {
            setIsLoading(false);
        }
      }
    };
    
    renderMermaid();

    return () => {
      if (panzoom && container) {
        container.removeEventListener('wheel', panzoom.zoomWithWheel);
        panzoom.destroy();
        panzoomInstanceRef.current = null;
      }
    };
  }, [mermaidCode, currentTheme]);

  const handleAccept = () => {
    onAcceptPlan(mermaidCode);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleSave = () => {
    setIsEditing(false);
  };

  return (
    <div className="h-full w-full flex flex-col bg-transparent relative">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {isEditing ? (
            <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-green-600/80 text-white rounded-md hover:bg-green-700/80 transition-colors backdrop-blur-sm border border-white/20"
                >
                <CheckCircle2Icon className="w-5 h-5" />
                Save Plan
            </button>
        ) : (
            <>
                <button 
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-500/80 text-white rounded-md hover:bg-gray-600/80 transition-colors backdrop-blur-sm border border-white/20"
                >
                    <PencilIcon className="w-5 h-5" />
                    Edit Plan
                </button>
                <button 
                    onClick={handleAccept}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600/80 text-white rounded-md hover:bg-green-700/80 transition-colors backdrop-blur-sm border border-white/20"
                >
                    <CheckCircle2Icon className="w-5 h-5" />
                    Accept Plan
                </button>
            </>
        )}
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button onClick={() => panzoomInstanceRef.current?.zoomIn()} className="w-10 h-10 flex items-center justify-center bg-black/20 text-white rounded-md hover:bg-black/30 transition-colors backdrop-blur-sm border border-white/20"><PlusIcon className="w-5 h-5"/></button>
        <button onClick={() => panzoomInstanceRef.current?.zoomOut()} className="w-10 h-10 flex items-center justify-center bg-black/20 text-white rounded-md hover:bg-black/30 transition-colors backdrop-blur-sm border border-white/20"><MinusIcon className="w-5 h-5"/></button>
        <button onClick={() => panzoomInstanceRef.current?.reset()} className="w-10 h-10 flex items-center justify-center bg-black/20 text-white rounded-md hover:bg-black/30 transition-colors backdrop-blur-sm border border-white/20"><RefreshCwIcon className="w-5 h-5"/></button>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Mermaid Diagram */}
        <div className="flex-1 p-4 overflow-hidden flex items-center justify-center relative">
          {isLoading && <SpinnerIcon className="w-12 h-12 text-gray-300 dark:text-gray-300 animate-spin absolute" />}
          {error && <div className="absolute text-center text-red-400 bg-red-900/50 p-4 rounded-md glass-panel"><strong className="block mb-2">Diagram Error</strong><pre className="text-left">{error}</pre></div>}
          <div ref={mermaidRef} className={`transition-opacity w-full h-full flex items-center justify-center ${isLoading || error ? 'opacity-20' : 'opacity-100'}`} />
        </div>
        
        {/* Editor Panel */}
        {isEditing && (
            <div className="w-1/3 min-w-[300px] bg-black/10 backdrop-blur-md p-2 flex flex-col border-l border-white/20">
                <h3 className="text-lg font-semibold mb-2 text-white">Mermaid Syntax</h3>
                <textarea 
                    value={mermaidCode}
                    onChange={(e) => setMermaidCode(e.target.value)}
                    className="w-full flex-1 bg-black/20 border border-white/20 rounded-md text-sm p-2 text-gray-200 font-mono focus:ring-1 focus:ring-blue-400 focus:outline-none resize-none"
                    placeholder="graph TD; Start --> Stop;"
                />
            </div>
        )}
      </div>
    </div>
  );
};