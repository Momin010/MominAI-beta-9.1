import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { githubService } from '../services/githubService';
import { FileSystem } from '../types';
import { X, Github } from 'lucide-react';

interface GithubModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectFileSystem: FileSystem;
  projectId: string | null;
}

type Status = 'idle' | 'connecting' | 'creating_repo' | 'pushing_files' | 'success' | 'error';

const GithubModal: React.FC<GithubModalProps> = ({ isOpen, onClose, projectName, projectFileSystem, projectId }) => {
  const { session, signInWithProvider } = useAuth();
  const [repoName, setRepoName] = useState(projectName.toLowerCase().replace(/\s+/g, '-'));
  const [description, setDescription] = useState(`AI-generated project: ${projectName}`);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);

  if (!isOpen) return null;
  
  const hasGithubToken = !!session?.provider_token;
  const showConnectUI = !hasGithubToken || needsReauth;

  const handleConnect = async () => {
    setStatus('connecting');
    setError(null);
    setNeedsReauth(false); // Reset re-auth flag on new connect attempt
    localStorage.setItem('postGithubAuthAction', JSON.stringify({ action: 'openPushModal', projectId }));
    // Explicitly request the 'repo' scope required for creating repositories
    await signInWithProvider('github', { scopes: 'repo' });
    // After this, the browser will redirect. The logic in App.tsx will handle re-opening the modal.
  };

  const handleCreateAndPush = async () => {
    setError(null);
    if (!session?.provider_token || !session.user) {
      setError("GitHub authentication is missing. Please reconnect.");
      setNeedsReauth(true);
      return;
    }

    try {
      setStatus('creating_repo');
      const newRepo = await githubService.createRepo(session.provider_token, repoName, description);
      setRepoUrl(newRepo.html_url);
      
      setStatus('pushing_files');
      const githubUsername = session.user.user_metadata?.user_name;
      if (!githubUsername) {
          throw new Error("Could not determine GitHub username from session.");
      }

      await githubService.pushFilesToRepo(
        session.provider_token,
        githubUsername,
        repoName,
        projectFileSystem,
        "Initial commit from MominAI"
      );
      setStatus('success');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      console.error(e);
      
      // This is the key change: detecting a wider range of authentication errors.
      const isAuthError = 
        errorMessage.toLowerCase().includes('bad credentials') || 
        errorMessage.toLowerCase().includes('resource not accessible') || 
        errorMessage.toLowerCase().includes('not found'); // GitHub can return 404 if token lacks scope
      
      if (isAuthError) {
        setError("Authentication failed. Your token might be invalid, expired, or missing the required 'repo' scope. Please reconnect to grant access.");
        setNeedsReauth(true);
      } else {
        setError(`Failed to push to GitHub: ${errorMessage}`);
      }
      setStatus('error');
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'connecting': return 'Redirecting to GitHub for authentication...';
      case 'creating_repo': return 'Creating GitHub repository...';
      case 'pushing_files': return 'Pushing files to repository...';
      case 'success': return 'Successfully pushed to GitHub!';
      case 'error': return 'An error occurred.';
      default: return '';
    }
  };

  const resetState = () => {
    setStatus('idle');
    setError(null);
    setRepoUrl('');
    setNeedsReauth(false);
    setRepoName(projectName.toLowerCase().replace(/\s+/g, '-'));
    onClose();
  };

  const renderContent = () => {
      if (showConnectUI) {
          return (
             <div className="text-center">
                {needsReauth && error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}
                <p className="text-sm text-brand-muted mb-6">
                  {needsReauth
                    ? 'Please reconnect to grant repository access.'
                    : 'Connect your GitHub account to create a new repository and push your project files.'}
                </p>
                {status === 'connecting' && (
                    <div className="text-center text-sm text-brand-muted mb-4 flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-brand-muted rounded-full animate-pulse"></div>
                        <span>{getStatusMessage()}</span>
                    </div>
                )}
                 <button
                    onClick={handleConnect}
                    disabled={status === 'connecting'}
                    className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#24292e] hover:bg-[#333] text-white disabled:opacity-50 flex items-center justify-center space-x-2"
                 >
                    <Github className="w-5 h-5" />
                    <span>{needsReauth ? 'Reconnect to GitHub' : 'Connect to GitHub'}</span>
                 </button>
             </div>
          );
      }

      if (status === 'success') {
           return (
             <div className="text-center py-4">
                <p className="text-lg font-semibold text-green-400 mb-4">{getStatusMessage()}</p>
                <a 
                    href={repoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full block px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#24292e] hover:bg-[#333] text-white"
                >
                    View Repository
                </a>
                <button onClick={resetState} className="mt-4 text-sm text-brand-muted hover:underline">Done</button>
            </div>
        );
      }

      return (
        <>
            <p className="text-sm text-brand-muted mb-6">This will create a new public repository on your GitHub account and push the current project files.</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white block mb-1">Repository Name</label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full bg-ide-bg-darker border border-brand-subtle rounded-lg p-2.5 text-sm placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  disabled={status !== 'idle'}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white block mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-ide-bg-darker border border-brand-subtle rounded-lg p-2.5 text-sm placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  disabled={status !== 'idle'}
                />
              </div>
            </div>

            <div className="mt-6">
              {status !== 'idle' && status !== 'error' && (
                  <div className="text-center text-sm text-brand-muted mb-4 flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-brand-muted rounded-full animate-pulse"></div>
                    <span>{getStatusMessage()}</span>
                  </div>
              )}
              {status === 'error' && error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}
              <button
                onClick={handleCreateAndPush}
                disabled={status !== 'idle' && status !== 'error' || !repoName}
                className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#24292e] hover:bg-[#333] text-white disabled:opacity-50 disabled:bg-gray-700"
              >
                Create & Push
              </button>
            </div>
          </>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={resetState}>
      <div className="bg-brand-surface rounded-xl border border-brand-subtle w-full max-w-md p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Github className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Push to GitHub</h2>
          </div>
          <button onClick={resetState} className="p-1.5 rounded-full hover:bg-brand-subtle/50 text-brand-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default GithubModal;