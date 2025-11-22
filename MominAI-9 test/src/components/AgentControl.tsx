
import React from 'react';

interface AgentControlProps {
    context: string;
    onContextChange: (newContext: string) => void;
}

export const AgentControl: React.FC<AgentControlProps> = ({ context, onContextChange }) => {
    return (
        <div className="p-2 border-t border-white/20">
            <label htmlFor="agent-context" className="block text-xs font-medium text-gray-300 dark:text-gray-300 mb-1 px-1">
                Agent Context
            </label>
            <textarea
                id="agent-context"
                rows={3}
                className="w-full bg-black/10 dark:bg-black/20 border border-white/20 rounded-md text-sm p-2 text-white dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                placeholder="High-level project goals and constraints will appear here..."
                value={context}
                onChange={(e) => onContextChange(e.target.value)}
            ></textarea>
        </div>
    );
};