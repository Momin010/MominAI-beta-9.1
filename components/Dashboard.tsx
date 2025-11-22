import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AiProvider, Project } from '../types';
import AiProviderDropdown from './AiProviderDropdown';
// FIX: Changed import from Settings to SettingsIcon to match the exported component from ./icons/Icons.
import { ArrowUpIcon, CodeBracketIcon, PlusIcon, MicrophoneIcon, XCircleIcon, SettingsIcon } from './icons/Icons';
import { projectService } from '../services/projectService';
import { fileToBase64 } from '../utils/fileUtils';
import Logo from './Logo';

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

interface DashboardProps {
  onNewProject: (prompt: string, provider: AiProvider, attachments: { mimeType: string; data: string }[]) => void;
  onLoadProject: (project: Project) => void;
  onManageKeysClick: () => void;
}

const ProjectList: React.FC<{ projects: Project[], onLoadProject: (p: Project) => void }> = ({ projects, onLoadProject }) => (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map(p => (
            <div key={p.id} className="bg-brand-surface border border-brand-subtle rounded-lg p-4 text-left hover:border-brand-accent/50 transition-colors cursor-pointer group" onClick={() => onLoadProject(p)}>
                <div className="w-full aspect-video bg-ide-bg-darker rounded-md mb-4 flex items-center justify-center">
                    <CodeBracketIcon className="w-10 h-10 text-brand-subtle group-hover:text-brand-accent transition-colors"/>
                </div>
                <h3 className="font-semibold text-white truncate">{p.name}</h3>
                <p className="text-xs text-brand-muted">
                    Edited {new Date(p.updated_at).toLocaleDateString()}
                </p>
            </div>
        ))}
    </div>
);


const UserProfile: React.FC<{ onManageKeysClick: () => void }> = ({ onManageKeysClick }) => {
    const { user, signOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        const { error } = await signOut();
        if (error) {
            console.error('Error signing out:', error);
            alert('Failed to sign out. Please try again.');
        }
        // onAuthStateChange listener in AuthContext handles redirect
    };

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-8 h-8 bg-brand-surface rounded-full flex items-center justify-center hover:ring-2 hover:ring-brand-accent">
                <span className="text-sm font-semibold text-white">{user.email?.charAt(0).toUpperCase()}</span>
            </button>
            {isOpen && (
                 <div className="absolute right-0 mt-2 w-56 bg-brand-surface rounded-lg border border-brand-subtle shadow-2xl z-20 overflow-hidden">
                    <div className="p-3 border-b border-brand-subtle">
                        <p className="text-sm font-medium text-white truncate">{user.email}</p>
                    </div>
                    <div className="p-1">
                         <button onClick={() => { onManageKeysClick(); setIsOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm text-brand-muted rounded-md hover:bg-brand-subtle/50 hover:text-white flex items-center space-x-2">
                            {/* FIX: Changed component from Settings to SettingsIcon to match the corrected import. */}
                            <SettingsIcon className="w-4 h-4" />
                            <span>Manage API Keys</span>
                         </button>
                         <button onClick={handleSignOut} className="w-full text-left px-3 py-1.5 text-sm text-brand-muted rounded-md hover:bg-brand-subtle/50 hover:text-white">
                            Sign Out
                         </button>
                    </div>
                </div>
            )}
        </div>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ onNewProject, onLoadProject, onManageKeysClick }) => {
  const [prompt, setPrompt] = useState('');
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
      const fetchProjects = async () => {
          try {
              const userProjects = await projectService.getProjectsForUser();
              setProjects(userProjects);
          } catch (error) {
              console.error("Failed to fetch projects:", error);
          } finally {
              setIsLoadingProjects(false);
          }
      };
      fetchProjects();
  }, []);

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
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [prompt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(prompt.trim() || attachments.length > 0) {
       const processedAttachments = await Promise.all(
        attachments.map(async (file) => {
          const base64Data = await fileToBase64(file);
          return { mimeType: file.type, data: base64Data };
        })
      );
      onNewProject(prompt.trim(), aiProvider, processedAttachments);
    }
  };

  return (
    <div 
      className="flex flex-col items-center min-h-screen py-8 px-4 sm:px-8 relative overflow-hidden"
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
         <Logo className="h-8 w-auto" />
         <UserProfile onManageKeysClick={onManageKeysClick} />
      </header>

      <main className="z-10 text-center flex flex-col items-center px-4 w-full mt-20">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
          Let's build something new.
        </h1>
        <p className="text-base md:text-lg text-brand-muted max-w-2xl mb-8 md:mb-12">
          Describe the application you want to create, or show me with a screenshot.
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
              placeholder="A Pomodoro timer with a clean, minimalist UI..."
              className="w-full bg-transparent text-lg text-white placeholder-brand-muted focus:outline-none resize-none overflow-y-hidden max-h-48"
              rows={1}
            />
            <div className="flex justify-between items-center mt-2">
                <div className="flex items-center space-x-1">
                    <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e.target.files)} multiple accept="image/*" className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-brand-subtle/50 text-brand-muted hover:text-white">
                        <PlusIcon className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={handleToggleListening} className={`p-2 rounded-full hover:bg-brand-subtle/50 text-brand-muted hover:text-white ${isListening ? 'text-red-500 animate-pulse' : ''}`}>
                        <MicrophoneIcon className="w-5 h-5"/>
                    </button>
                    <AiProviderDropdown 
                      selectedProvider={aiProvider}
                      onProviderChange={setAiProvider}
                      onManageKeysClick={onManageKeysClick}
                    />
                </div>
                <button
                    type="submit"
                    className="bg-white text-black rounded-full p-2.5 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:bg-gray-600"
                    disabled={!prompt.trim() && attachments.length === 0}
                >
                    <ArrowUpIcon className="w-5 h-5" />
                </button>
            </div>
        </form>

        <div className="mt-16 md:mt-20 w-full max-w-7xl">
          <h2 className="text-2xl font-bold text-left">Your Projects</h2>
          {isLoadingProjects ? (
             <div className="mt-8 text-brand-muted">Loading projects...</div>
          ) : projects.length > 0 ? (
            <ProjectList projects={projects} onLoadProject={onLoadProject} />
          ) : (
            <div className="mt-8 text-center text-brand-muted bg-brand-surface rounded-lg py-12 border border-brand-subtle">
              <p>You don't have any saved projects yet.</p>
              <p className="text-sm">Start by describing an app above.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;