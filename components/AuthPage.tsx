import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GithubIcon, GoogleIcon } from './icons/Icons';
import { Provider } from '@supabase/supabase-js';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithProvider } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const action = isLogin ? signIn : signUp;
    const { error } = await action({ email, password });

    if (error) {
      setError(error.message);
    } else {
        if(!isLogin) {
            setError("Check your email for a confirmation link!")
        } else {
             onAuthSuccess();
        }
    }
    setLoading(false);
  };

  const handleOAuthSignIn = async (provider: Provider) => {
    setLoading(true);
    setError(null);

    // For GitHub, we must request the 'repo' scope upfront to allow pushing.
    const options = provider === 'github' ? { scopes: 'repo' } : undefined;

    const { error } = await signInWithProvider(provider, options);
    if (error) {
        setError(error.message);
        setLoading(false);
    }
    // On success, Supabase handles the redirect.
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
       <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-purple-600/30 to-orange-500/30 rounded-full blur-3xl animate-blob"></div>
      <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-pink-600/30 to-indigo-500/30 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
      
      <div className="w-full max-w-md p-8 space-y-6 bg-brand-surface rounded-xl border border-brand-subtle z-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-brand-accent hover:underline ml-1">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>

        <div className="space-y-3">
            <button
                onClick={() => handleOAuthSignIn('github')}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#24292e] rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
            >
                <GithubIcon className="w-5 h-5" />
                <span>Continue with GitHub</span>
            </button>
            <button
                onClick={() => handleOAuthSignIn('google')}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
                <GoogleIcon className="w-5 h-5" />
                <span>Continue with Google</span>
            </button>
        </div>

        <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-subtle" />
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="bg-brand-surface px-2 text-brand-muted">OR</span>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-medium text-white block mb-2">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-ide-bg-darker border border-brand-subtle rounded-lg p-2.5 text-sm text-white placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-ide-bg-darker border border-brand-subtle rounded-lg p-2.5 text-sm text-white placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-brand-accent rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Continue')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;