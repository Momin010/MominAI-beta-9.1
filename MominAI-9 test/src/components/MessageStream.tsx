import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, GroundingSource } from '../types';
import { AIActionJournal } from './AIActionJournal';
import { SparklesIcon, GlobeIcon, ChevronUpIcon, ChevronDownIcon } from './icons';

// A simple markdown-to-html converter
const formatMessage = (content: string) => {
    // Note: This is a very basic implementation. For production, a library like 'marked' or 'react-markdown' would be better.
    let html = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="bg-black/20 dark:bg-black/30 rounded px-1 py-0.5 font-mono text-sm">$1</code>');
    
    html = html.replace(/```(\w+)?\n([\s\S]+?)\n```/g, (match, lang, code) => {
        return `<pre class="bg-black/20 dark:bg-black/30 rounded p-3 my-2 overflow-x-auto"><code class="language-${lang || ''}">${code.trim()}</code></pre>`;
    });

    return { __html: html };
}

const getTokenTier = (tokenCount: number): string => {
    if (tokenCount <= 30) return 'Minimal';
    if (tokenCount <= 100) return 'Ultra Low';
    if (tokenCount <= 250) return 'Very Low';
    if (tokenCount <= 500) return 'Low';
    if (tokenCount <= 1200) return 'Mid Low';
    if (tokenCount <= 2500) return 'Moderate';
    if (tokenCount <= 5000) return 'Mid High';
    if (tokenCount <= 10000) return 'High';
    if (tokenCount <= 25000) return 'Very High';
    return 'Ultra High';
};

const StreamingText: React.FC<{ text: string }> = ({ text }) => {
    const [displayedText, setDisplayedText] = useState('');
    // FIX: Initialize useRef with null to provide an initial value and fix the error.
    const animationFrameId = useRef<number | null>(null);

    useEffect(() => {
        let currentIndex = displayedText.length;
        // If the target text is shorter, it's a new message, so reset.
        if (text.length < currentIndex) {
            currentIndex = 0;
        }
        
        let lastUpdateTime = performance.now();
        const speed = 50; // Chars per second

        const animate = (now: number) => {
            const elapsed = now - lastUpdateTime;
            if (elapsed > (1000 / speed)) {
                const charsToRender = Math.floor(elapsed / (1000 / speed));
                const nextIndex = Math.min(currentIndex + charsToRender, text.length);
                
                if (nextIndex > currentIndex) {
                    setDisplayedText(text.substring(0, nextIndex));
                    currentIndex = nextIndex;
                }
                lastUpdateTime = now;
            }
            
            if (currentIndex < text.length) {
                animationFrameId.current = requestAnimationFrame(animate);
            }
        };
        
        animationFrameId.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId.current !== null) cancelAnimationFrame(animationFrameId.current);
        };
    }, [text, displayedText.length]);

    return (
        <div
            className="text-gray-100 dark:text-gray-200 whitespace-pre-wrap prose dark:prose-invert prose-sm prose-p:text-white prose-strong:text-white prose-code:text-white"
            dangerouslySetInnerHTML={formatMessage(displayedText)}
        >
        </div>
    );
};

const SourcesList: React.FC<{ sources: GroundingSource[] }> = ({ sources }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    if (!sources || sources.length === 0) return null;

    return (
        <div className="mt-4 border-t border-white/20 pt-3">
            <button 
                className="w-full text-sm font-semibold text-gray-300 dark:text-gray-300 mb-2 flex items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <GlobeIcon className="w-4 h-4 mr-2" />
                Sources ({sources.length})
                <div className="flex-grow"></div>
                {isOpen ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
            {isOpen && (
                <ul className="space-y-1.5 pl-1">
                    {sources.map((source, i) => (
                        <li key={i} className="text-xs flex items-start">
                            <div className="w-4 h-4 flex-shrink-0 mr-2 mt-0.5 text-gray-400 dark:text-gray-400">{i+1}.</div>
                            <a 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 dark:text-blue-300 hover:underline break-all"
                                title={source.title || source.uri}
                            >
                                {source.title || source.uri}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

// FIX: Define MessageStreamProps interface to fix TypeScript error.
interface MessageStreamProps {
    chatHistory: ChatMessage[];
}

export const MessageStream: React.FC<MessageStreamProps> = ({ chatHistory }) => {
    if (chatHistory.length === 0) {
        return null;
    }
  
    return (
        <div className="space-y-6">
        {chatHistory.map((message, index) => {
            const isLastMessage = index === chatHistory.length - 1;
            const isStreaming = isLastMessage && message.isLoading && message.role === 'assistant';

            return (
                <div key={index} className={`flex flex-col ${message.role === 'user' ? 'items-start' : 'items-start'}`}>
                <div className={`text-xs font-semibold mb-1 px-1 ${message.role === 'user' ? 'text-gray-300 dark:text-gray-300' : 'text-blue-300 dark:text-blue-300'}`}>
                    {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className={`p-3 rounded-lg max-w-full ${message.role === 'user' ? 'bg-black/10 dark:bg-black/20' : 'bg-transparent'}`}>
                    {message.image && (
                        <div className="mb-2">
                            <img 
                                src={`data:${message.image.mimeType};base64,${message.image.base64}`} 
                                alt="User upload" 
                                className="max-w-xs max-h-64 rounded-lg border border-white/20"
                            />
                        </div>
                    )}

                    {/* Render thinking indicator */}
                    {message.isLoading && (!message.actions || message.actions.length === 0) && !message.tasks && (
                         <div className="flex items-center text-gray-200 dark:text-gray-300">
                            <SparklesIcon className="w-5 h-5 mr-2 animate-pulse-opacity" />
                            <span>Thinking...</span>
                        </div>
                    )}
                    
                    {/* Render action/task journal */}
                    {(message.actions || message.tasks) && (
                        <AIActionJournal 
                            actions={message.actions || []} 
                            tasks={message.tasks} 
                            isLoading={!!message.isLoading} 
                        />
                    )}
                    
                    {/* Render message content */}
                    {message.content && (
                        isStreaming ? 
                            <StreamingText text={message.content} /> : 
                            <div 
                                className="text-gray-100 dark:text-gray-200 whitespace-pre-wrap prose dark:prose-invert prose-sm prose-p:text-white prose-strong:text-white prose-code:text-white"
                                dangerouslySetInnerHTML={formatMessage(message.content)}
                            >
                            </div>
                    )}

                    {/* Render sources */}
                    {message.sources && message.sources.length > 0 && (
                        <SourcesList sources={message.sources} />
                    )}

                    {/* Render Token Usage */}
                    {message.usageMetadata && !message.isLoading && (
                        <div className="mt-4 pt-2 border-t border-white/20 text-right text-xs text-gray-300 dark:text-gray-400 font-mono">
                            {getTokenTier(message.usageMetadata.totalTokenCount)} · {message.usageMetadata.totalTokenCount.toLocaleString()} tokens
                        </div>
                    )}
                </div>
                </div>
            );
        })}
        </div>
    );
};