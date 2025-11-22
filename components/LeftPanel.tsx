import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, AiProvider } from '../types';
import { ArrowUpIcon, PlusIcon, CodeBracketIcon, MicrophoneIcon, XCircleIcon } from './icons/Icons';
import AiProviderDropdown from './AiProviderDropdown';
import { fileToBase64 } from '../utils/fileUtils';
import { MessageStream } from './MessageStream';

// Fix for SpeechRecognition API types not being available in default lib.
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onstart: () => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface LeftPanelProps {
  initialPrompt: string;
  messages: ChatMessage[];
  onPromptSubmit: (prompt: string, attachments: { mimeType: string; data: string }[]) => void;
  agentActivity: string | null;
  viewMode: 'preview' | 'code';
  onViewModeChange: (mode: 'preview' | 'code') => void;
  aiProvider: AiProvider;
  onAiProviderChange: (provider: AiProvider) => void;
  onManageKeysClick: () => void;
  pendingPlanMessageId: string | null;
  onPlanApproved: () => void;
  onPlanRejected: () => void;
}



const LeftPanel: React.FC<LeftPanelProps> = ({ 
    initialPrompt, 
    messages, 
    onPromptSubmit, 
    agentActivity, 
    viewMode, 
    onViewModeChange, 
    aiProvider, 
    onAiProviderChange, 
    onManageKeysClick, 
    onShowDiff, 
    pendingPlanMessageId,
    onPlanApproved,
    onPlanRejected
}) => {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: 'end' });
  };
  
  useEffect(scrollToBottom, [messages, agentActivity]);

  const handleFileChange = (files: FileList | null) => {
    if (files) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      setAttachments(prev => [...prev, ...imageFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  }, []);

  const handleToggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition not supported in this browser.");
        return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (e) => console.error("Speech recognition error", e);

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setPrompt(prev => prev + finalTranscript);
      };

      recognition.start();
      recognitionRef.current = recognition;
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((prompt.trim() || attachments.length > 0) && !agentActivity) {
      const processedAttachments = await Promise.all(
        attachments.map(async (file) => {
          const base64Data = await fileToBase64(file);
          return { mimeType: file.type, data: base64Data };
        })
      );
      onPromptSubmit(prompt.trim(), processedAttachments);
      setPrompt('');
      setAttachments([]);
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [prompt]);



  return (
    <div 
      className="h-full w-full flex-shrink-0 bg-ide-bg border-r border-brand-subtle flex flex-col relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
        {isDragging && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20 border-2 border-dashed border-brand-accent rounded-lg">
                <p className="text-white text-lg font-semibold">Drop files to attach</p>
            </div>
        )}
      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        <div className="bg-brand-surface rounded-xl p-4">
          <span className="text-sm font-medium">feat: {initialPrompt}</span>
          <div className="mt-3 flex space-x-2">
            <button className="text-xs bg-ide-bg-darker border border-brand-subtle rounded-md px-3 py-1 text-white hover:bg-brand-subtle" onClick={() => onViewModeChange('preview')}>Preview Latest</button>
            <button className="text-xs bg-ide-bg-darker border border-brand-subtle rounded-md px-3 py-1 text-white hover:bg-brand-subtle flex items-center" onClick={() => onViewModeChange('code')}>
              <CodeBracketIcon className="w-3 h-3 mr-1"/> Code
            </button>
          </div>
        </div>
        
        <MessageStream chatHistory={messages} />

        {agentActivity && !pendingPlanMessageId && (
            <div className="flex items-center space-x-2 text-brand-muted px-4">
                <div className="w-2 h-2 bg-brand-muted rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-brand-muted rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-brand-muted rounded-full animate-pulse"></div>
                <span className="text-sm">{agentActivity}</span>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 p-4 border-t border-brand-subtle bg-ide-bg">
        <form onSubmit={handleSubmit} className="bg-brand-surface border border-brand-subtle rounded-2xl p-3 flex flex-col">
          {attachments.length > 0 && (
            <div className="flex items-center space-x-2 mb-2 overflow-x-auto p-1">
              {attachments.map((file, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img src={URL.createObjectURL(file)} alt={file.name} className="w-16 h-16 object-cover rounded-lg"/>
                  <button type="button" onClick={() => removeAttachment(index)} className="absolute -top-1.5 -right-1.5 bg-gray-800 rounded-full text-white hover:bg-gray-700">
                    <XCircleIcon className="w-5 h-5"/>
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={pendingPlanMessageId ? "Waiting for plan approval..." : "Ask MominAI..."}
            className="w-full bg-transparent text-sm text-white placeholder-brand-muted focus:outline-none resize-none overflow-y-hidden max-h-48"
            rows={1}
            disabled={!!agentActivity || !!pendingPlanMessageId}
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center space-x-1">
                <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e.target.files)} multiple accept="image/*" className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-brand-subtle/50 text-brand-muted hover:text-white"  disabled={!!agentActivity || !!pendingPlanMessageId}>
                    <PlusIcon className="w-5 h-5" />
                </button>
                <button type="button" onClick={handleToggleListening} className={`p-2 rounded-full hover:bg-brand-subtle/50 text-brand-muted hover:text-white ${isListening ? 'text-red-500 animate-pulse' : ''}`} disabled={!!agentActivity || !!pendingPlanMessageId}>
                    <MicrophoneIcon className="w-5 h-5"/>
                </button>
                <AiProviderDropdown 
                    selectedProvider={aiProvider}
                    onProviderChange={onAiProviderChange}
                    onManageKeysClick={onManageKeysClick}
                />
            </div>
            <button
                type="submit"
                className="bg-gray-200 text-black rounded-full p-2.5 hover:bg-white transition-colors disabled:opacity-50 disabled:bg-gray-600"
                disabled={(!prompt.trim() && attachments.length === 0) || !!agentActivity || !!pendingPlanMessageId}
            >
                <ArrowUpIcon className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeftPanel;