import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Message, MessageType, AiProvider } from '../types';
import { ArrowUpIcon, PlusIcon, CodeBracketIcon, CheckCircleIcon, EditIcon, MicrophoneIcon, XCircleIcon, ThumbsUpIcon, ThumbsDownIcon } from './icons/Icons';
import AiProviderDropdown from './AiProviderDropdown';
import { fileToBase64 } from '../utils/fileUtils';
import { FixedSizeList as List } from 'react-window';

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
  messages: Message[];
  onPromptSubmit: (prompt: string, attachments: { mimeType: string; data: string }[]) => void;
  agentActivity: string | null;
  viewMode: 'preview' | 'code';
  onViewModeChange: (mode: 'preview' | 'code') => void;
  aiProvider: AiProvider;
  onAiProviderChange: (provider: AiProvider) => void;
  onManageKeysClick: () => void;
  onShowDiff: (diff: Message['diff'], files: string[]) => void;
  pendingPlanMessageId: string | null;
  onPlanApproved: () => void;
  onPlanRejected: () => void;
}

const MessageRenderer: React.FC<{
    message: Message;
    messages: Message[];
    onShowDiff: (diff: Message['diff'], files: string[]) => void;
    index: number;
    onPlanApproved: () => void;
    onPlanRejected: () => void;
    style?: React.CSSProperties;
}> = ({ message, messages, onShowDiff, index, onPlanApproved, onPlanRejected, style }) => {

  const content = useMemo(() => {
    switch (message.type) {
      case MessageType.User:
        return (
          <div className="bg-brand-surface p-4 rounded-xl">
            <p className="text-white text-sm whitespace-pre-wrap">{message.text}</p>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.attachments.map((attachment, index) => (
                  <img key={index} src={attachment} alt={`attachment ${index + 1}`} className="max-w-xs max-h-48 rounded-lg" />
                ))}
              </div>
            )}
          </div>
        );
      case MessageType.AgentThought:
          if (message.isAwaitingApproval) {
              return (
                  <div className="bg-ide-bg-darker p-3 rounded-lg border border-brand-accent">
                      <p className="text-white text-sm whitespace-pre-wrap font-medium">MominAI's Plan:</p>
                      <p className="text-white text-sm whitespace-pre-wrap mt-2">{message.text.replace('Plan:\n', '')}</p>
                      <div className="mt-4 pt-3 border-t border-brand-subtle flex items-center justify-end space-x-2">
                          <p className="text-sm text-brand-muted mr-auto">Do you approve this plan?</p>
                          <button onClick={onPlanRejected} className="px-3 py-1.5 text-sm rounded-lg border border-red-500 text-red-400 hover:bg-red-900/50 flex items-center space-x-1">
                              <ThumbsDownIcon className="w-4 h-4" /> <span>Reject</span>
                          </button>
                          <button onClick={onPlanApproved} className="px-3 py-1.5 text-sm rounded-lg bg-green-600 hover:bg-green-500 text-white flex items-center space-x-1.5">
                              <ThumbsUpIcon className="w-4 h-4" />
                              <span>Approve</span>
                          </button>
                      </div>
                  </div>
              )
          }
          return (
              <div className="bg-ide-bg-darker p-4 rounded-xl border border-brand-subtle">
                  <p className="text-white text-sm whitespace-pre-wrap">{message.text}</p>
              </div>
          );
      case MessageType.AgentEdits:
          // This is now handled within the summary/commit block to reduce clutter
        return null;
      case MessageType.AgentSummary:
          const precedingEdit = messages.slice(0, index).reverse().find(m => m.type === MessageType.AgentEdits);
          const filesChanged = precedingEdit?.files;

          return (
              <div className="bg-ide-bg-darker p-3 rounded-lg border border-brand-subtle">
                  <div className="flex items-start space-x-3">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                          <p className="text-white text-sm font-medium">{message.text}</p>
                          {filesChanged && filesChanged.length > 0 && (
                               <button onClick={() => onShowDiff(precedingEdit?.diff, filesChanged)} className="text-xs text-brand-muted hover:text-white mt-1 underline">
                                  {filesChanged.length} file{filesChanged.length > 1 ? 's' : ''} changed
                               </button>
                           )}
                      </div>
                  </div>
              </div>
          );
      case MessageType.System:
          return (
              <div className="bg-red-900/50 p-3 rounded-lg border border-red-700">
                  <p className="text-red-200 text-sm">{message.text}</p>
              </div>
          )
      default:
        return null;
    }
  }, [message, messages, index, onShowDiff, onPlanApproved, onPlanRejected]);

  return (
    <div style={style}>
      {content}
    </div>
  );
};


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
// Group messages for better UI rendering
const messageTurns = useMemo(() => messages.reduce((acc, msg, index) => {
  if (msg.type === MessageType.User) {
      acc.push({ user: msg, agent: [], originalIndex: index });
  } else if (acc.length > 0) {
      acc[acc.length - 1].agent.push({ ...msg, originalIndex: index });
  } else if (msg.type === MessageType.AgentThought && msg.isAwaitingApproval) {
      // Handle case where a plan is the very first message
      acc.push({ user: null, agent: [{...msg, originalIndex: index}], originalIndex: index });
  }
  return acc;
}, [] as { user: Message | null, agent: (Message & { originalIndex: number })[], originalIndex: number }[]), [messages]);

// Virtual scrolling setup
const ITEM_HEIGHT = 150; // Estimated height per message turn
const CONTAINER_HEIGHT = 600; // Height of the scrollable area

const MessageRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
  const turn = messageTurns[index];
  if (!turn) return null;

  return (
    <div style={style} className="px-4 py-3">
      <div className="space-y-4">
        {turn.user && <MessageRenderer message={turn.user} messages={messages} onShowDiff={onShowDiff} index={turn.originalIndex} onPlanApproved={onPlanApproved} onPlanRejected={onPlanRejected}/>}
        {turn.agent.map(agentMsg => (
          <MessageRenderer key={agentMsg.id} message={agentMsg} messages={messages} onShowDiff={onShowDiff} index={agentMsg.originalIndex} onPlanApproved={onPlanApproved} onPlanRejected={onPlanRejected} />
        ))}
      </div>
    </div>
  );
};


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
      <div className="flex-grow flex flex-col">
        <div className="flex-shrink-0 p-4">
          <div className="bg-brand-surface rounded-xl p-4">
            <span className="text-sm font-medium">feat: {initialPrompt}</span>
            <div className="mt-3 flex space-x-2">
              <button className="text-xs bg-ide-bg-darker border border-brand-subtle rounded-md px-3 py-1 text-white hover:bg-brand-subtle" onClick={() => onViewModeChange('preview')}>Preview Latest</button>
              <button className="text-xs bg-ide-bg-darker border border-brand-subtle rounded-md px-3 py-1 text-white hover:bg-brand-subtle flex items-center" onClick={() => onViewModeChange('code')}>
                <CodeBracketIcon className="w-3 h-3 mr-1"/> Code
              </button>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto">
          <List
            height={CONTAINER_HEIGHT}
            itemCount={messageTurns.length}
            itemSize={ITEM_HEIGHT}
            className="scrollbar-thin scrollbar-thumb-brand-subtle scrollbar-track-transparent"
          >
            {MessageRow}
          </List>
        </div>

        {agentActivity && !pendingPlanMessageId && (
            <div className="flex-shrink-0 flex items-center space-x-2 text-brand-muted px-4 py-2">
                <div className="w-2 h-2 bg-brand-muted rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-brand-muted rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-brand-muted rounded-full animate-pulse"></div>
                <span className="text-sm">{agentActivity}</span>
            </div>
        )}
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