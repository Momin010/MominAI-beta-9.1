import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { XIcon, GithubIcon } from './icons';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message);
        } else {
            onAuthSuccess();
        }
        setLoading(false);
    };

    const handleSignUp = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setError(error.message);
        } else {
            setMessage('Check your email for a confirmation link!');
        }
        setLoading(false);
    };
    
    const handleOAuthSignIn = async (provider: 'google' | 'github') => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({ provider });
        if (error) {
            setError(error.message);
            setLoading(false);
        }
        // The user will be redirected, so no need to call onAuthSuccess here.
        // The AuthProvider's onAuthStateChange will handle the session update.
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-md" onClick={onClose}>
            <div className="glass-panel rounded-lg shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-white/20">
                    <h2 className="text-lg font-semibold text-white">Join to Start Building</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20">
                        <XIcon className="w-5 h-5 text-gray-300" />
                    </button>
                </div>
                <div className="p-6">
                    {error && <p className="bg-red-500/30 text-red-100 text-sm p-3 rounded-md mb-4">{error}</p>}
                    {message && <p className="bg-green-500/30 text-green-100 text-sm p-3 rounded-md mb-4">{message}</p>}
                    
                    <form onSubmit={handleSignIn}>
                        <div className="space-y-4">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/20 border border-white/20 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                required
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/20 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                required
                            />
                        </div>
                        <div className="flex items-center gap-4 mt-6">
                             <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold disabled:bg-blue-600/50">
                                {loading ? 'Signing In...' : 'Sign In'}
                            </button>
                            <button type="button" onClick={handleSignUp} disabled={loading} className="flex-1 px-4 py-2 bg-white/10 text-white rounded-md hover:bg-white/20 font-semibold disabled:bg-white/10">
                                {loading ? '...' : 'Sign Up'}
                            </button>
                        </div>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/20"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-gray-800/20 text-gray-300 backdrop-blur-sm">Or continue with</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                         <button onClick={() => handleOAuthSignIn('google')} disabled={loading} className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-white/20 text-white rounded-md hover:bg-white/10 font-semibold">
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5"/>
                            Google
                        </button>
                        <button onClick={() => handleOAuthSignIn('github')} disabled={loading} className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-white/20 text-white rounded-md hover:bg-white/10 font-semibold">
                            <GithubIcon className="w-5 h-5" />
                            GitHub
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
