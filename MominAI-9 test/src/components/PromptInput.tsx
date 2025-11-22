import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUpIcon, VisualEditsIcon, WaveformIcon, XIcon, SparklesIcon, BrainCircuitIcon, GlobeIcon, MessageSquareIcon } from './icons';
import type { ImageData, Settings } from '../types';

// FIX: Add types for Web Speech API which are not standard in TS DOM lib
// This is necessary because the SpeechRecognition API is not part of the standard DOM typings.
interface SpeechRecognitionAlternative {
    transcript: string;
}
interface SpeechRecognitionResult {
    isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
    length: number;
}
interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
}
interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: () => void;
    onend: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
}
declare global {
    interface Window {
        SpeechRecognition: { new (): SpeechRecognition };
        webkitSpeechRecognition: { new (): SpeechRecognition };
    }
}


interface PromptInputProps {
  onSubmit: (prompt: string, image: ImageData | null, isThinkingMode: boolean) => void;
  isLoading: boolean;
  settings: Settings;
}

const AT_COMMANDS = [
  { command: 'study', description: 'Deep research on a new technology', icon: <BrainCircuitIcon className="w-4 h-4" /> },
  { command: 'search', description: 'Force a web search for the query', icon: <GlobeIcon className="w-4 h-4" /> },
  { command: 'context', description: 'Inject agent context into prompt', icon: <MessageSquareIcon className="w-4 h-4" /> },
];

const fileToImageData = (file: File): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target && typeof event.target.result === 'string') {
                const base64 = event.target.result.split(',')[1];
                resolve({ base64, mimeType: file.type });
            } else {
                reject(new Error("Failed to read file as base64 string."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

export const PromptInput: React.FC<PromptInputProps> = ({ onSubmit, isLoading, settings }) => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<ImageData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(settings.deepThinkingDefault);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const promptBeforeRecordingRef = useRef<string>('');
  
  // State for @command palette
  const [showAtCommands, setShowAtCommands] = useState(false);
  const [atCommandQuery, setAtCommandQuery] = useState('');
  const [atCommandIndex, setAtCommandIndex] = useState(-1); // Position of '@'
  const [activeAtCommandIndex, setActiveAtCommandIndex] = useState(0);

  const filteredCommands = AT_COMMANDS.filter(c => c.command.startsWith(atCommandQuery));

  useEffect(() => {
    setIsThinkingMode(settings.deepThinkingDefault);
  }, [settings.deepThinkingDefault]);

  const handleToggleRecording = () => {
    if (isRecording) {
        recognitionRef.current?.stop();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser.");
        return;
    }

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        promptBeforeRecordingRef.current = prompt;
        setIsRecording(true);
    };

    recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
    };

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
        const newPrompt = promptBeforeRecordingRef.current + finalTranscript + interimTranscript;
        setPrompt(newPrompt);
    };
    
    recognition.start();
  };
  
  const handleSelectCommand = useCallback((command: string) => {
      const newPrompt = prompt.substring(0, atCommandIndex) + `@${command} ` + prompt.substring(textareaRef.current?.selectionStart || 0);
      setPrompt(newPrompt);
      setShowAtCommands(false);
      textareaRef.current?.focus();
  }, [prompt, atCommandIndex]);


  useEffect(() => {
    return () => {
        recognitionRef.current?.abort();
    }
  }, []);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    const textBeforeCursor = text.substring(0, cursorPosition);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowAtCommands(true);
      setAtCommandQuery(atMatch[1]);
      setAtCommandIndex(atMatch.index || 0);
      setActiveAtCommandIndex(0);
    } else {
      setShowAtCommands(false);
    }
    
    setPrompt(text);
  };

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((prompt.trim() || image) && !isLoading) {
      if (isRecording) {
        recognitionRef.current?.stop();
      }
      onSubmit(prompt, image, isThinkingMode);
      setPrompt('');
      setImage(null);
      setImagePreview(null);
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAtCommands) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveAtCommandIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveAtCommandIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if(filteredCommands.length > 0) {
                handleSelectCommand(filteredCommands[activeAtCommandIndex].command);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowAtCommands(false);
        }
    } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const imageData = await fileToImageData(file);
          setImage(imageData);
          setImagePreview(URL.createObjectURL(file));
      }
  };

  const handleRemoveImage = () => {
      setImage(null);
      setImagePreview(null);
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      {showAtCommands && filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-full sm:w-80 p-2 glass-panel rounded-lg shadow-lg z-10">
              <p className="text-xs text-gray-300 px-2 pb-1 font-semibold">AI Tools</p>
              <ul>
                  {filteredCommands.map((cmd, index) => (
                      <li key={cmd.command}
                          onClick={() => handleSelectCommand(cmd.command)}
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer ${index === activeAtCommandIndex ? 'bg-white/20' : 'hover:bg-white/10'}`}
                      >
                          <span className="text-blue-300">{cmd.icon}</span>
                          <div>
                            <span className="text-sm font-medium text-white">@{cmd.command}</span>
                            <p className="text-xs text-gray-300">{cmd.description}</p>
                          </div>
                      </li>
                  ))}
              </ul>
          </div>
      )}
      {imagePreview && (
          <div className="absolute bottom-full left-0 mb-2 p-1 glass-panel rounded-lg">
              <div className="relative">
                <img src={imagePreview} alt="Image preview" className="max-h-24 rounded-md" />
                <button 
                    type="button" 
                    onClick={handleRemoveImage}
                    className="absolute top-0 right-0 -mt-2 -mr-2 bg-gray-800 rounded-full p-0.5 text-white hover:bg-gray-600"
                    aria-label="Remove image"
                >
                    <XIcon className="w-4 h-4" />
                </button>
              </div>
          </div>
      )}
      <div className="bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/20 backdrop-blur-sm rounded-2xl p-2 flex flex-col gap-2">
        <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or use @ to trigger a tool..."
            className="w-full bg-transparent text-base text-white dark:text-gray-200 placeholder-gray-200 dark:placeholder-gray-300/80 resize-none focus:outline-none overflow-y-hidden py-1"
            rows={1}
            disabled={isLoading}
        />
        <div className="flex justify-between items-center">
            {/* Left controls */}
            <div className="flex items-center gap-1 sm:gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageChange}
                    accept="image/png, image/jpeg, image/webp" 
                    className="hidden" 
                />
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-7 h-7 flex-shrink-0 rounded-lg bg-white/10 dark:bg-white/10 text-white dark:text-white flex items-center justify-center hover:bg-white/20 dark:hover:bg-white/20 transition-colors"
                    disabled={isLoading}
                    aria-label="Attach file"
                >
                    <span className="text-xl font-light">+</span>
                </button>
                <button 
                    type="button"
                    className="w-7 h-7 flex-shrink-0 rounded-lg bg-white/10 dark:bg-white/10 text-gray-300 dark:text-gray-300 flex items-center justify-center hover:bg-white/20 dark:hover:bg-white/20 transition-colors"
                    disabled={true}
                    aria-label="Visual edits"
                >
                    <VisualEditsIcon className="w-5 h-5 flex-shrink-0" />
                </button>
                 <button 
                    type="button"
                    onClick={() => setIsThinkingMode(!isThinkingMode)}
                    className={`w-7 h-7 flex-shrink-0 rounded-lg transition-colors flex items-center justify-center ${
                        isThinkingMode 
                        ? 'bg-purple-500/80 text-white' 
                        : 'bg-white/10 dark:bg-white/10 text-gray-200 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-white/20'
                    }`}
                    disabled={isLoading}
                    aria-label={isThinkingMode ? "Disable deep thinking mode" : "Enable deep thinking mode"}
                >
                    <SparklesIcon className="w-5 h-5 flex-shrink-0" />
                </button>
            </div>
            
            {/* Right controls */}
            <div className="flex items-center gap-1 sm:gap-2">
                <button
                    type="button"
                    onClick={handleToggleRecording}
                    className={`w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 dark:hover:bg-white/20 transition-colors flex-shrink-0 ${
                        isRecording 
                        ? 'bg-red-500/70 text-white animate-pulse'
                        : 'text-gray-200 dark:text-gray-200'
                    }`}
                    disabled={isLoading}
                    aria-label={isRecording ? "Stop listening" : "Use voice"}
                >
                    <WaveformIcon className="w-5 h-5" />
                </button>
                <button
                    type="submit"
                    disabled={isLoading || (!prompt.trim() && !image)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0
                                disabled:bg-blue-500/50 disabled:text-gray-300
                                bg-blue-500 hover:bg-blue-600 text-white"
                    aria-label="Submit prompt"
                >
                    <ArrowUpIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
      </div>
    </form>
  );
};