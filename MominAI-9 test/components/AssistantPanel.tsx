import React from 'react';
import type { ChatMessage, ImageData, Settings } from '../types';
import { PromptInput } from './PromptInput';
import { MessageStream } from './MessageStream';

interface AssistantPanelProps {
  chatHistory: ChatMessage[];
  isLoading: boolean;
  onPromptSubmit: (prompt: string, image: ImageData | null, isThinkingMode: boolean) => void;
  settings: Settings;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = (props) => {
  return (
    <div className="bg-transparent h-full flex flex-col p-4">
      <div className="flex-grow overflow-y-auto mb-4 pr-2 space-y-4">
        <MessageStream chatHistory={props.chatHistory} />
        
        {props.chatHistory.length === 0 && (
          <div className="text-center text-gray-200 dark:text-gray-300 mt-8">Ask a question or provide an image to start the conversation.</div>
        )}
      </div>
      <PromptInput onSubmit={props.onPromptSubmit} isLoading={props.isLoading} settings={props.settings} />
    </div>
  );
};