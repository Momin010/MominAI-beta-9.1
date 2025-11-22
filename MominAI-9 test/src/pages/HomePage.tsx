import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from '../components/AuthModal';
import { ArrowUpIcon, SparklesIcon } from '../components/icons';

const HomePage: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const navigate = useNavigate();
    const { session } = useAuth();

    if (session) {
        navigate('/dashboard');
        return null; 
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            setIsAuthModalOpen(true);
        }
    };

    const handleAuthSuccess = () => {
        setIsAuthModalOpen(false);
        // Navigate to the IDE, passing the prompt in the state
        navigate('/ide/project-1', { state: { initialPrompt: prompt } });
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen p-4">
            <div className="text-center">
                <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
                    The AI-Powered React IDE
                </h1>
                <p className="text-lg md:text-xl text-gray-200 mb-12 max-w-2xl mx-auto">
                    Describe your application, feature, or component in plain English. Our AI agent will build it for you, file by file.
                </p>
            </div>

            <div className="w-full max-w-3xl">
                <form onSubmit={handleSubmit} className="relative">
                    <div className="bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/20 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-2 shadow-2xl">
                        <SparklesIcon className="w-6 h-6 text-purple-300 flex-shrink-0 ml-2" />
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Build a kanban board with drag-and-drop functionality..."
                            className="w-full bg-transparent text-lg text-white dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-300/80 focus:outline-none py-2"
                        />
                        <button
                            type="submit"
                            disabled={!prompt.trim()}
                            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0
                                        disabled:bg-blue-500/50 disabled:text-gray-300
                                        bg-blue-500 hover:bg-blue-600 text-white"
                            aria-label="Submit prompt"
                        >
                            <ArrowUpIcon className="w-6 h-6" />
                        </button>
                    </div>
                </form>
            </div>
            
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onAuthSuccess={handleAuthSuccess}
            />

            <footer className="absolute bottom-4 text-center text-gray-300 text-sm">
                <p>Ready to build at the speed of thought? Let's get started.</p>
            </footer>
        </div>
    );
};

export default HomePage;
