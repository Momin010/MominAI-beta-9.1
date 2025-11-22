import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowUpIcon, PlusIcon, MicrophoneIcon, XCircleIcon } from './icons/Icons';
import AiProviderDropdown from './AiProviderDropdown';
import { AiProvider } from '../types';
import { fileToBase64 } from '../utils/fileUtils';


// SpeechRecognition types for browsers that support it.
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

interface LandingPageProps {
  onStart: (prompt: string, provider: AiProvider, attachments: { mimeType: string; data: string }[]) => void;
  onNavigateToAuth: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onNavigateToAuth }) => {
  const [prompt, setPrompt] = useState('');
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

   const handleFileChange = (files: FileList | null) => {
    if (files) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      setAttachments(prev => [...prev, ...imageFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
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
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        setPrompt(prev => prev + finalTranscript);
      };
      recognition.start();
      recognitionRef.current = recognition;
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200; // 5 lines of text roughly
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [prompt]);

  const sanitizePrompt = (input: string) => {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedPrompt = sanitizePrompt(prompt);
    if(sanitizedPrompt || attachments.length > 0) {
      const processedAttachments = await Promise.all(
        attachments.map(async (file) => {
          const base64Data = await fileToBase64(file);
          return { mimeType: file.type, data: base64Data };
        })
      );
      onStart(sanitizedPrompt, aiProvider, processedAttachments);
    }
  };


  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen relative overflow-hidden px-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
       {isDragging && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 border-2 border-dashed border-brand-accent rounded-lg m-4">
                <p className="text-white text-lg font-semibold">Drop files to attach</p>
            </div>
        )}
      <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-purple-600/30 to-orange-500/30 rounded-full blur-3xl animate-blob"></div>
      <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-pink-600/30 to-indigo-500/30 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
      
      <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
        <div className="flex items-center space-x-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
            <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 7L12 12L22 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 12V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-lg font-bold">MominAI</span>
        </div>
        <div className="hidden md:flex items-center space-x-4">
          <button onClick={onNavigateToAuth} className="text-sm text-brand-muted hover:text-white">Sign In</button>
          <button onClick={onNavigateToAuth} className="px-4 py-2 text-sm font-semibold rounded-lg bg-white text-black hover:bg-gray-200">Sign Up</button>
        </div>
      </header>
      
      <main className="z-10 text-center flex flex-col items-center w-full">
        <div className="bg-brand-surface border border-brand-subtle rounded-full px-4 py-1.5 text-sm text-blue-300 mb-6">
          Introducing MominAI Cloud
        </div>
        <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-4">
          Build something <span className="bg-gradient-to-r from-pink-500 to-violet-500 text-transparent bg-clip-text">Usefull</span>
        </h1>
        <p className="text-base md:text-xl text-brand-muted max-w-2xl mb-12">
          Create apps and websites by chatting with an AI exactly like Chatgpt but more powerfull.
        </p>
        
        <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-brand-surface/70 border border-brand-subtle rounded-2xl p-3 flex flex-col backdrop-blur-sm">
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
              placeholder="Ask MominAI to create a pomodoro timer..."
              className="w-full bg-transparent text-lg text-white placeholder-brand-muted focus:outline-none resize-none overflow-y-hidden"
              rows={1}
            />
            <div className="flex justify-between items-center mt-2">
                <div className="flex items-center space-x-1">
                    <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e.target.files)} multiple accept="image/*" className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-brand-subtle/50 text-brand-muted hover:text-white" aria-label="Attach file">
                        <PlusIcon className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={handleToggleListening} className={`p-2 rounded-full hover:bg-brand-subtle/50 text-brand-muted hover:text-white ${isListening ? 'text-red-500 animate-pulse' : ''}`} aria-label="Use voice input">
                        <MicrophoneIcon className="w-5 h-5"/>
                    </button>
                </div>
                <button
                    type="submit"
                    className="bg-white text-black rounded-full p-2.5 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:bg-gray-600"
                    disabled={!prompt.trim() && attachments.length === 0}
                    aria-label="Submit prompt"
                >
                    <ArrowUpIcon className="w-5 h-5" />
                </button>
            </div>
        </form>
      </main>
    </div>
  );
};

export default LandingPage;
