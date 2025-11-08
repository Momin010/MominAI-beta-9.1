import React, { useState, useEffect, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import IdeLayout from './components/IdeLayout';
import ApiKeyModal from './components/ApiKeyModal';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import { AiProvider, Project } from './types';
import { useAuth } from './contexts/AuthContext';
import SettingsModal from './components/SettingsModal';
import GithubModal from './components/GithubModal';

export interface ProjectStartData extends Partial<Project> {
  initialAttachments?: { mimeType: string; data: string }[];
}

type View = 'landing' | 'auth' | 'dashboard' | 'ide';

function App() {
  const { session } = useAuth();
  
  const [view, setView] = useState<View>('landing');
  const [projectStartData, setProjectStartData] = useState<ProjectStartData | null>(null);

  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);
  
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);

  useEffect(() => {
    // This effect handles view transitions based on auth state
    if (session) {
      if (view === 'landing' || view === 'auth') {
        const pendingProjectJSON = localStorage.getItem('pendingProject');
        if (pendingProjectJSON) {
          try {
            const projectData = JSON.parse(pendingProjectJSON);
            localStorage.removeItem('pendingProject');
            setProjectStartData(projectData);
            setView('ide');
          } catch (e) {
            console.error("Failed to parse pending project", e);
            setView('dashboard');
          }
        } else {
          setView('dashboard');
        }
      }
    } else {
      if (view !== 'landing' && view !== 'auth') {
        setView('landing');
      }
    }
  }, [session, view]);

  // This effect handles post-GitHub OAuth action to reopen the modal.
  useEffect(() => {
    const postAuthActionJSON = localStorage.getItem('postGithubAuthAction');
    if (session?.provider_token && postAuthActionJSON) {
        try {
            const { projectId } = JSON.parse(postAuthActionJSON);
            // We need to load the project data again to pass to the modal
            if (projectId && projectStartData?.id === projectId) {
                setIsGithubModalOpen(true);
                localStorage.removeItem('postGithubAuthAction');
            } else {
              // If project data isn't loaded, we can't open the modal.
              // This is a simplification; a full solution would re-fetch project data.
              console.warn("Could not open GitHub modal: project data not loaded.");
              localStorage.removeItem('postGithubAuthAction');
            }
        } catch (e) {
            console.error("Error processing post-auth action:", e);
            localStorage.removeItem('postGithubAuthAction');
        }
    }
  }, [session, projectStartData]);

  const handleNewProject = useCallback((prompt: string, provider: AiProvider, attachments: { mimeType: string; data: string }[]) => {
    const newProjectData: ProjectStartData = { name: prompt, provider, initialAttachments: attachments };
    if (session) {
        setProjectStartData(newProjectData);
        setView('ide');
    } else {
        localStorage.setItem('pendingProject', JSON.stringify(newProjectData));
        setView('auth');
    }
  }, [session]);

  const handleLoadProject = useCallback((project: Project) => {
    setProjectStartData(project);
    setView('ide');
  }, []);

  const handleExitIde = useCallback(() => {
    setProjectStartData(null);
    setView('dashboard');
  }, []);

  const openApiKeyModal = useCallback(() => setIsApiKeyModalOpen(true), []);
  const openSettingsModal = useCallback((projectId?: string) => {
    setSettingsProjectId(projectId || null);
    setIsSettingsModalOpen(true);
  }, []);
  const openGithubModal = useCallback(() => setIsGithubModalOpen(true), []);

  const renderView = () => {
    // Protected views
    if (!session && (view === 'dashboard' || view === 'ide')) {
      return <LandingPage onStart={handleNewProject} onNavigateToAuth={() => setView('auth')} />;
    }

    switch (view) {
      case 'landing':
        return <LandingPage onStart={handleNewProject} onNavigateToAuth={() => setView('auth')} />;
      case 'auth':
        return <AuthPage onAuthSuccess={() => { /* Effect will handle view change */ }} />;
      case 'dashboard':
        return <Dashboard onNewProject={handleNewProject} onLoadProject={handleLoadProject} onManageKeysClick={openApiKeyModal} />;
      case 'ide':
        if (!projectStartData) {
          // Should not happen, but as a fallback
          setView('dashboard');
          return null;
        }
        return (
          <IdeLayout 
            initialProjectData={projectStartData}
            onExit={handleExitIde}
            onProjectDataChange={setProjectStartData} // This allows IDE to update project data (e.g., with ID after save)
            onManageKeysClick={openApiKeyModal}
            onOpenSettings={openSettingsModal}
            onOpenGithubModal={openGithubModal}
          />
        );
      default:
        return <LandingPage onStart={handleNewProject} onNavigateToAuth={() => setView('auth')} />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        projectId={settingsProjectId}
      />
      <GithubModal
        isOpen={isGithubModalOpen}
        onClose={() => setIsGithubModalOpen(false)}
        projectName={projectStartData?.name || 'New Project'}
        projectFileSystem={projectStartData?.file_system || {}}
        projectId={projectStartData?.id || null}
      />
      {renderView()}
    </div>
  );
}

export default App;