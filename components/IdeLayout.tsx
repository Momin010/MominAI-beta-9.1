import React, { useState, useEffect, useCallback, useRef } from 'react';
import LeftPanel from './LeftPanel';
import CenterPanel from './CenterPanel';
import Header from './Header';
import DiffModal from './DiffModal';
import { FileSystem, Message, MessageType, AiProvider, Project, SimplifiedGenerateContentResponse } from '../types';
import { generateContentWithTools } from '../services/aiService';
import { projectService } from '../services/projectService';
import { WebContainer } from '@webcontainer/api';
import { transformFileSystem, diffFileSystems } from '../utils/fileUtils';
import { ProjectStartData } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { cacheService } from '../services/cacheService';
import { collaborationService } from '../services/collaborationService';
import { memoryService } from '../services/memoryService';
import { errorHandlingService } from '../services/errorHandlingService';

interface IdeLayoutProps {
  initialProjectData: ProjectStartData;
  onExit: () => void;
  onProjectDataChange: (project: Partial<Project>) => void;
  onManageKeysClick: () => void;
  onOpenSettings: (projectId?: string) => void;
  onOpenGithubModal: () => void;
}

// Helper to encode Uint8Array to a Base64 string.
function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to decode Base64 string to a Uint8Array.
function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// A heuristic to identify text files based on their extension.
// Files not on this list will be treated as binary and Base64-encoded for safety.
const TEXT_FILE_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html', '.md', '.svg', '.txt', 
  '.lock', '.yml', '.yaml', '.toml', '.ini', '.sh', '.py', '.rb', '.java', '.go',
  '.c', '.cpp', '.h', '.hpp', '.rs', '.php', 'Dockerfile', '.env', '.gitignore',
  '.babelrc', '.eslintrc', '.prettierrc', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js'
];

const isTextFile = (path: string): boolean => {
    if (path.toUpperCase().includes('LICENSE') || path.includes('.tldraw')) return true;
    const lowerPath = path.toLowerCase();
    return TEXT_FILE_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
};

const readDirectory = async (wc: WebContainer, path: string): Promise<FileSystem> => {
  const fs: FileSystem = {};
  // Start with an empty string for the root of the target path to build clean relative paths
  const queue: string[] = [""]; 

  while (queue.length > 0) {
    const currentRelativeDir = queue.shift()!;
    const fullDirPath = currentRelativeDir ? `${path}/${currentRelativeDir}` : path;
    
    let entries;
    try {
      entries = await wc.fs.readdir(fullDirPath, { withFileTypes: true });
    } catch (e) {
      // If the directory doesn't exist (e.g., first run, no cache), it's not an error we need to log loudly.
      // This is a normal "cache miss" scenario.
      if (e.message.includes('ENOENT')) {
          if (currentRelativeDir === "") {
             console.log(`[readDirectory] Cache path ${path} not found, returning empty cache.`);
             return {}; // Return empty object, signaling a cache miss.
          }
          // If a subdirectory is missing, that's more unusual, maybe log it as a warning.
          console.warn(`[readDirectory] Subdirectory not found during scan: ${fullDirPath}`);
          continue; // Skip this branch of the directory tree.
      }
      // For other, unexpected errors, log them.
      console.error(`Error reading directory ${fullDirPath}:`, e);
      continue;
    }
      
    if (entries.length === 0 && currentRelativeDir) {
        fs[currentRelativeDir + '/'] = '__DIR__';
    }

    for (const entry of entries) {
      const entryRelativePath = currentRelativeDir ? `${currentRelativeDir}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        queue.push(entryRelativePath);
      } else if (entry.isFile()) {
        try {
            const contentBytes = await wc.fs.readFile(`${path}/${entryRelativePath}`);
            if (isTextFile(entryRelativePath)) {
                fs[entryRelativePath] = new TextDecoder().decode(contentBytes);
            } else {
                fs[entryRelativePath] = `base64:${uint8ArrayToBase64(contentBytes)}`;
            }
        } catch (fileReadError) {
             console.error(`Error reading file ${path}/${entryRelativePath}:`, fileReadError);
        }
      }
    }
  }
  return fs;
};

const writeDirectory = async (wc: WebContainer, fs: FileSystem, targetPath: string) => {
    await wc.fs.mkdir(targetPath, { recursive: true });

    const dirs: string[] = [];
    const files: { path: string, content: string }[] = [];

    for (const relPath in fs) {
        if (fs[relPath] === '__DIR__') {
            dirs.push(relPath.endsWith('/') ? relPath.slice(0, -1) : relPath);
        } else {
            files.push({ path: relPath, content: fs[relPath] });
        }
    }

    for (const dirRelPath of dirs) {
        await wc.fs.mkdir(`${targetPath}/${dirRelPath}`, { recursive: true });
    }

    for (const { path: relPath, content } of files) {
        const fullPath = `${targetPath}/${relPath}`;
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        if (dir) {
            await wc.fs.mkdir(dir, { recursive: true });
        }
        
        let fileContents: string | Uint8Array;
        if (content.startsWith('base64:')) {
            fileContents = base64ToUint8Array(content.substring(7));
        } else {
            fileContents = content;
        }
        await wc.fs.writeFile(fullPath, fileContents);
    }
};


const IdeLayout: React.FC<IdeLayoutProps> = ({ 
  initialProjectData, 
  onExit, 
  onProjectDataChange, 
  onManageKeysClick, 
  onOpenSettings,
  onOpenGithubModal
}) => {
  const { session } = useAuth();

  const [project, setProject] = useState<ProjectStartData>(initialProjectData);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // liveFileSystem powers the running WebContainer preview
  const [liveFileSystem, setLiveFileSystem] = useState<FileSystem>(project.file_system || {});
  // draftFileSystem is where the AI makes its changes
  const [draftFileSystem, setDraftFileSystem] = useState<FileSystem>(project.file_system || {});
  
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [agentActivity, setAgentActivity] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(true);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('code');
  const [leftPanelWidth, setLeftPanelWidth] = useState(384);
  const [previewStatus, setPreviewStatus] = useState('Waiting for agent to finish...');
  const [iframeUrl, setIframeUrl] = useState('');
  const [aiProvider, setAiProvider] = useState<AiProvider>(project.provider || 'gemini');
  const [mobileView, setMobileView] = useState<'chat' | 'editor'>('chat');
  const [diffModalData, setDiffModalData] = useState<{ isOpen: boolean; diff?: Message['diff']; files?: string[] }>({ isOpen: false });

  const [pendingPlan, setPendingPlan] = useState<{
    messageId: string;
    planData: { call: any; result: any };
    fileSystem: FileSystem;
  } | null>(null);

  // Collaboration state
  const [collaborationEnabled, setCollaborationEnabled] = useState(false);
  const [activeCollaborators, setActiveCollaborators] = useState<{ [userId: string]: string }>({});

  // Loading states for better UX
  const [isBootingWebContainer, setIsBootingWebContainer] = useState(false);
  const [isInstallingDeps, setIsInstallingDeps] = useState(false);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);

  const isResizing = useRef(false);
  const conversationHistoryRef = useRef<{ role: string, parts: any[] }[]>([]);
  const webcontainerRef = useRef<WebContainer | null>(null);
  const previousLiveFileSystemRef = useRef<FileSystem>({});
  const lastSavedFileSystem = useRef<FileSystem | null>(null);
  const isBootingRef = useRef(false);
  const initialPromptSentRef = useRef(false);
  const [isDesktop, setIsDesktop] = useState(true);


  const showDiffModal = (diff: Message['diff'], files: string[]) => {
    if (diff) {
        setDiffModalData({ isOpen: true, diff, files });
    } else {
        alert('No diff information available for these changes.');
    }
  };

  const closeDiffModal = () => setDiffModalData({ isOpen: false });


  useEffect(() => {
    const checkSize = () => setIsDesktop(window.innerWidth >= 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleResize = useCallback((e: MouseEvent) => {
    if (isResizing.current) {
      setLeftPanelWidth(prev => Math.max(300, Math.min(e.clientX, 700)));
    }
  }, []);

  const stopResize = useCallback(() => {
    isResizing.current = false;
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResize);
  }, [handleResize]);
  
  const startResize = useCallback((e: React.MouseEvent) => {
    if (!isDesktop) return;
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResize);
  }, [handleResize, stopResize, isDesktop]);

  const addMessage = (message: Omit<Message, 'id'> & { id?: string }) => {
    const id = message.id || Date.now().toString() + Math.random();
    const messageWithMeta = {
      ...message,
      id,
      timestamp: Date.now(),
      userId: session?.user?.id,
      userName: session?.user?.email?.split('@')[0] || 'Anonymous'
    };
    setMessages(prev => [...prev, messageWithMeta]);

    // Send to collaboration service if enabled
    if (collaborationEnabled && collaborationService.getSessionId()) {
      collaborationService.sendMessage(messageWithMeta);
    }
  };

  const handleDraftFileSystemChange = (newFs: FileSystem) => {
    setDraftFileSystem(newFs);
  }
  
  const runNpmInstall = async (wc: WebContainer) => {
      console.log("[npm install] Spawning `npm install` process.");
      setPreviewStatus('Installing dependencies (npm install)...');
      const installProcess = await wc.spawn('npm', ['install']);
      
      installProcess.output.pipeTo(new WritableStream({
          write(data) {
              console.log('[npm install output]', data); // Log the raw output
              setPreviewStatus(`npm install: ${data.trim()}`);
          }
      }));

      const exitCode = await installProcess.exit;
      console.log(`[npm install] Process exited with code: ${exitCode}`);
      if (exitCode !== 0) {
          setPreviewStatus('Error during npm install. Check console for details.');
          throw new Error('npm install failed');
      }
  };
  
  const startDevServer = async (wc: WebContainer) => {
      setPreviewStatus('Starting dev server (npm run dev)...');

      wc.on('server-ready', (port, url) => {
          setPreviewStatus(`Server ready at ${url}`);
          setIframeUrl(url);
      });

       wc.on('error', (error) => {
          console.error('WebContainer Error:', error);
          setPreviewStatus(`Error: ${error.message}`);
      });
      
      const devProcess = await wc.spawn('npm', ['run', 'dev', '--', '--host']);

      devProcess.output.pipeTo(new WritableStream({
          write(data) {
              console.log('Dev Server:', data);
              setPreviewStatus(`vite dev: ${data.trim()}`);
          }
      }));

  };

  useEffect(() => {
    const bootAndRun = async () => {
        console.log("[Boot] bootAndRun triggered.");
        if (isBuilding || webcontainerRef.current || isBootingRef.current) {
            console.log("[Boot] Aborting: already building, booted, or booting.", { isBuilding, hasWc: !!webcontainerRef.current, isBooting: isBootingRef.current });
            return;
        }
        isBootingRef.current = true;
        let wc: WebContainer | null = null;
        
        // In WebContainer, npm runs as root, so the cache is in /root/.npm
        const NPM_CACHE_PATH = '/root/.npm';

        try {
            console.log("[Boot] Booting WebContainer...");
            setIsBootingWebContainer(true);
            setBootProgress(10);
            setPreviewStatus('Booting WebContainer...');
            wc = await WebContainer.boot();
            webcontainerRef.current = wc;
            setBootProgress(30);
            console.log("[Boot] WebContainer booted.");

            setPreviewStatus('Mounting project files...');
            await wc.mount(transformFileSystem(liveFileSystem));
            setBootProgress(50);
            console.log("[Boot] Project files mounted.");

            if (project.id) {
                console.log(`[Cache Check] Project ID found: ${project.id}. Checking for cached dependencies.`);
                setIsInstallingDeps(true);
                setBootProgress(60);
                setPreviewStatus('Checking for cached dependencies...');
                const cachedData = await cacheService.getProjectCache(project.id);
                const currentPackageJson = liveFileSystem['package.json'];

                if (cachedData && cachedData.npmCache && typeof cachedData.npmCache === 'object' && Object.keys(cachedData.npmCache).length > 0 && currentPackageJson && cachedData.packageJsonContent === currentPackageJson) {
                    console.log("[Cache Check] Cache HIT! Restoring dependencies from cache.", { cachedItems: Object.keys(cachedData.npmCache).length });
                    setPreviewStatus('Cache hit! Restoring dependencies...');
                    await writeDirectory(wc, cachedData.npmCache, NPM_CACHE_PATH);
                    setBootProgress(80);
                    console.log("[Cache Write] Finished writing cache to WebContainer FS.");
                    setPreviewStatus('Restored dependencies from cache.');
                } else {
                    console.log("[Cache Check] Cache MISS.", {
                        hasCachedData: !!cachedData,
                        hasNpmCache: !!(cachedData && cachedData.npmCache),
                        isCacheEmpty: cachedData?.npmCache ? Object.keys(cachedData.npmCache).length === 0 : 'N/A',
                        hasPackageJson: !!currentPackageJson,
                        projectId: project.id
                    });
                    if (cachedData) {
                          console.log("[Cache Check] Reason: Cache data is invalid, incomplete, or package.json mismatch.");
                          if (cachedData.packageJsonContent !== currentPackageJson) {
                             console.log("--> Cached package.json did not match current package.json.");
                          }
                          setPreviewStatus('Dependencies changed or cache invalid. Clearing old cache...');
                          await cacheService.clearProjectCache(project.id);
                    } else {
                        console.log("[Cache Check] Reason: No cached data found for this project.");
                    }
                    setPreviewStatus('Cache miss. Installing from scratch.');
                    await runNpmInstall(wc);
                }
            } else {
              console.log("[Cache Check] No project ID. Skipping cache check and installing from scratch.");
              setIsInstallingDeps(true);
              setBootProgress(60);
              await runNpmInstall(wc);
            }
            
            if (project.id) {
                console.log("[Cache Save] Attempting to cache dependencies...");
                setPreviewStatus('Caching dependencies for next time...');
                const npmCacheFileSystem = await readDirectory(wc, NPM_CACHE_PATH);
                console.log(`[Cache Save] Read ${Object.keys(npmCacheFileSystem).length} entries from ${NPM_CACHE_PATH}`);
                const packageJsonContent = liveFileSystem['package.json'];
                if (packageJsonContent && Object.keys(npmCacheFileSystem).length > 0) {
                   console.log("[Cache Save] Saving cache to IndexedDB...");
                   await cacheService.setProjectCache(project.id, npmCacheFileSystem, packageJsonContent);
                   setPreviewStatus('Dependencies cached!');
                   console.log("[Cache Save] Dependencies cached successfully.");
                } else {
                   setPreviewStatus('Skipped caching (no package.json or empty npm cache).');
                   console.log("[Cache Save] Skipped caching.", { hasPackageJson: !!packageJsonContent, cacheSize: Object.keys(npmCacheFileSystem).length });
                }
            }

            console.log("[Dev Server] Starting dev server...");
            setIsStartingServer(true);
            setBootProgress(90);
            await startDevServer(wc);
            setBootProgress(100);
            console.log("[Dev Server] Dev server process started.");

        } catch (error) {
            console.error(error);
            setPreviewStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsBootingWebContainer(false);
            setIsInstallingDeps(false);
            setIsStartingServer(false);
            setBootProgress(0);
            isBootingRef.current = false;
        }
    };

    if (!isBuilding && Object.keys(liveFileSystem).length > 0) {
        bootAndRun();
    }

    return () => {
        const wc = webcontainerRef.current;
        if (wc) {
            console.log(`Tearing down WebContainer for project: ${project.id || project.name}`);
            wc.teardown();
            webcontainerRef.current = null;
            isBootingRef.current = false; // Reset on teardown
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuilding, project.id]);


  // Add beforeunload listener
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? The development server will be shut down.';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Autosave and Versioning logic
  useEffect(() => {
    if (!agentActivity && project.id && liveFileSystem !== lastSavedFileSystem.current) {
        // Find the summary of the last completed task
        const lastSummary = [...messages].reverse().find(m => m.type === MessageType.AgentSummary)?.text;

        projectService.updateProject(project.id, liveFileSystem)
            .then((updatedProject) => {
                lastSavedFileSystem.current = liveFileSystem;
                onProjectDataChange(updatedProject);
                console.log("Project autosaved successfully.");
                // After updating the main record, create a version checkpoint
                return projectService.createProjectVersion(project.id!, liveFileSystem, lastSummary);
            })
            .then(() => {
                console.log("Project version checkpoint created.");
            })
            .catch(error => {
                console.error("Autosave/Versioning failed:", error);
                // Check for specific Supabase error code for missing table (PGRST205)
                // This makes the app more robust by catching the specific schema error
                // and providing a user-friendly message instead of just a console error.
                if (error && error.code === 'PGRST205' && error.message?.includes('project_versions')) {
                    addMessage({
                        type: MessageType.System,
                        text: `Autosave Warning: The 'project_versions' table is missing. Version history is disabled. Please run the required SQL in your Supabase dashboard to fix this.`
                    });
                } else {
                    addMessage({type: MessageType.System, text: `Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`});
                }
            });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentActivity, liveFileSystem, project.id, onProjectDataChange]);


  useEffect(() => {
      const syncFiles = async () => {
          if (!webcontainerRef.current || isBuilding || isBootingRef.current) return;
          
          const wc = webcontainerRef.current;
          const { added, modified, deleted } = diffFileSystems(previousLiveFileSystemRef.current, liveFileSystem);
          
          let packageJsonChanged = false;

          for (const path of deleted) {
              await wc.fs.rm(path, { recursive: true });
          }
          for (const path of [...Object.keys(added), ...Object.keys(modified)]) {
              if(path === 'package.json') packageJsonChanged = true;
              const dir = path.substring(0, path.lastIndexOf('/'));
              if(dir) {
                await wc.fs.mkdir(dir, { recursive: true });
              }
              await wc.fs.writeFile(path, liveFileSystem[path]);
          }

          if (packageJsonChanged) {
              try {
                if (project.id) {
                    setPreviewStatus("package.json changed, clearing cache...");
                    await cacheService.clearProjectCache(project.id);
                }
                setPreviewStatus("Re-installing dependencies...");
                await runNpmInstall(wc);
                
                if (project.id) {
                    setPreviewStatus('Re-caching dependencies...');
                    const npmCache = await readDirectory(wc, '/root/.npm');
                    const packageJsonContent = liveFileSystem['package.json'];
                    if (packageJsonContent) {
                       await cacheService.setProjectCache(project.id, npmCache, packageJsonContent);
                       setPreviewStatus('Dependencies re-cached!');
                    }
                }
              } catch (e) {
                console.error("Failed to re-run npm install after package.json change");
                setPreviewStatus("Error re-installing dependencies.");
              }
          }
      };

      if (!isBuilding) {
        syncFiles();
      }
      
      previousLiveFileSystemRef.current = liveFileSystem;
  }, [liveFileSystem, isBuilding, project.id]);

  const getTurnActivity = (calls: { name: string; args: any }[]): string => {
    if (calls.some(c => c.name === 'run_build_and_lint')) return 'MominAI is verifying the build...';
    if (calls.some(c => ['create_or_update_files', 'delete_file'].includes(c.name))) return 'MominAI is writing code...';
    if (calls.some(c => c.name === 'search_pexels_for_images')) return 'MominAI is searching for images...';
    if (calls.some(c => c.name === 'plan_steps')) return 'MominAI is creating a plan...';
    if (calls.some(c => ['read_file', 'list_files'].includes(c.name))) return 'MominAI is reviewing the files...';
    return 'MominAI is thinking...';
  };

  const processAgentResponse = useCallback(async (response: SimplifiedGenerateContentResponse, currentDraftFileSystem: FileSystem) => {
    let functionCalls = response.functionCalls;
    if (!functionCalls) {
        if (response.text) {
            addMessage({ type: MessageType.AgentThought, text: response.text });
            conversationHistoryRef.current.push({ role: 'model', parts: [{ text: response.text }] });
        } else {
            addMessage({ type: MessageType.System, text: "Agent finished its turn without text or tool calls." });
        }
        setAgentActivity(null);
        return;
    }

    if (!Array.isArray(functionCalls)) {
        functionCalls = [functionCalls];
    }

    setAgentActivity(getTurnActivity(functionCalls));
    
    // Handle plan approval workflow
    const planCall = functionCalls.find(c => c.name === 'plan_steps');
    if (planCall) {
        const { args } = planCall;
        const steps = Array.isArray(args.steps) ? args.steps : [args.steps];
        const planText = `Plan:\n${steps.map((s, i) => `${i+1}. ${s}`).join('\n')}`;
        const messageId = Date.now().toString() + Math.random();

        addMessage({
            id: messageId,
            type: MessageType.AgentThought,
            text: planText,
            isAwaitingApproval: true,
        });

        const toolResult = { success: true, plan: steps };

        setPendingPlan({
            messageId,
            planData: { call: planCall, result: toolResult },
            fileSystem: currentDraftFileSystem,
        });
        
        // Push the model's turn to history so it's there for the next step
        conversationHistoryRef.current.push({ role: 'model', parts: [{ functionCall: planCall }] });

        return; // Halt execution until user approves
    }

    let tempFileSystem = currentDraftFileSystem;
    let fsBeforeEdits = currentDraftFileSystem;
    const functionCallParts: any[] = [];
    const functionResponseParts: any[] = [];
    let edits: string[] = [];
    let newActiveFile: string | null = null;
    
    const applyEditsToState = (fs: FileSystem) => {
        setDraftFileSystem(fs);
        if (newActiveFile) setActiveFile(newActiveFile);
        if (edits.length > 0) {
            addMessage({
            type: MessageType.AgentEdits,
            text: `${edits.length} file${edits.length > 1 ? 's' : ''} changed`,
            files: edits,
            diff: { oldFS: fsBeforeEdits, newFS: fs }
            });
            fsBeforeEdits = fs; // Update for the next batch in this turn
            edits = [];
        }
    };

    for (const call of functionCalls) {
        const { name, args } = call;
        let toolResult: any;

        if (name === 'create_or_update_files') {
            const { files } = args; // files is an object: { "path/to/file": "content", ... }
            if (files && typeof files === 'object') {
                const newFs = { ...tempFileSystem };
                const paths = Object.keys(files);
                for (const path of paths) {
                    newFs[path] = files[path];
                    edits.push(path);
                    if (!activeFile && !newActiveFile) {
                        newActiveFile = path;
                    }
                }
                tempFileSystem = newFs;
                toolResult = { success: true, files_written: paths };
            } else {
                    toolResult = { success: false, error: "Invalid 'files' argument. Expected an object." };
            }
        } else if (name === 'delete_file') {
            edits.push(args.path as string);
            const newFs = { ...tempFileSystem };
            delete newFs[args.path as string];
            tempFileSystem = newFs;
            if (activeFile === args.path) newActiveFile = null;
            toolResult = { success: true, path: args.path };
        } else {
            applyEditsToState(tempFileSystem);
            switch (name) {
                case 'list_files':
                    toolResult = { files: Object.keys(tempFileSystem) };
                    break;
                case 'read_file':
                    toolResult = { content: tempFileSystem[args.path as string] || 'File not found.' };
                    break;
                case 'run_build_and_lint': {
                    addMessage({ type: MessageType.System, text: `Verifying code... This might take a moment.` });
                    let verificationWC: WebContainer | null = null;
                    try {
                        verificationWC = await WebContainer.boot();
                        await verificationWC.mount(transformFileSystem(tempFileSystem));

                        const installProcess = await verificationWC.spawn('npm', ['install']);
                        let installOutput = '';
                        installProcess.output.pipeTo(new WritableStream({ write(data) { installOutput += data; } }));
                        const installExitCode = await installProcess.exit;
                        if (installExitCode !== 0) {
                            throw new Error(`'npm install' failed in verification environment.\n${installOutput}`);
                        }

                        const packageJsonContent = tempFileSystem['package.json'];
                        if (!packageJsonContent || !JSON.parse(packageJsonContent).scripts?.build) {
                            throw new Error("No 'build' script found in package.json. Cannot verify.");
                        }

                        const buildProcess = await verificationWC.spawn('npm', ['run', 'build']);
                        let buildOutput = '';
                        buildProcess.output.pipeTo(new WritableStream({ write(data) { buildOutput += data; } }));
                        const buildExitCode = await buildProcess.exit;

                        if (buildExitCode === 0) {
                            toolResult = { success: true, output: "Build succeeded." };
                        } else {
                            toolResult = { success: false, error: `Build failed with exit code ${buildExitCode}.`, output: buildOutput };
                        }
                    } catch (e) {
                        toolResult = { success: false, error: e instanceof Error ? e.message : 'Unknown error during verification.' };
                    } finally {
                        if (verificationWC) {
                            verificationWC.teardown();
                        }
                    }
                    break;
                }
                case 'search_pexels_for_images':
                    const pexelsApiKey = localStorage.getItem('pexels_api_key');
                    if (!pexelsApiKey) {
                        toolResult = { success: false, error: 'Pexels API key is missing. Please ask the user to add it via the "Manage API Keys" option.' };
                    } else {
                        try {
                            const query = encodeURIComponent(args.query as string);
                            const orientation = args.orientation || 'landscape';
                            const pexelsUrl = `/api/pexels/v1/search?query=${query}&orientation=${orientation}&per_page=1`;
                            
                            const pexelsResponse = await fetch(pexelsUrl, {
                                headers: { 'Authorization': pexelsApiKey }
                            });

                            if (!pexelsResponse.ok) {
                                const errorData = await pexelsResponse.json();
                                throw new Error(errorData.error || `Pexels API request failed with status ${pexelsResponse.status}`);
                            }

                            const pexelsData = await pexelsResponse.json();
                            const photo = pexelsData.photos?.[0];

                            if (photo) {
                                toolResult = {
                                    success: true,
                                    imageUrl: photo.src.large2x || photo.src.original,
                                    altText: photo.alt,
                                    photographer: photo.photographer,
                                    photographerUrl: photo.photographer_url,
                                    photoUrl: photo.url
                                };
                            } else {
                                toolResult = { success: false, error: `No photos found for query: "${args.query}"` };
                            }
                        } catch (e) {
                            toolResult = { success: false, error: e instanceof Error ? e.message : 'Unknown error calling Pexels API.' };
                        }
                    }
                    break;
                case 'chat':
                    addMessage({ type: MessageType.AgentThought, text: args.response as string });
                    setAgentActivity(null);
                    return; // End of processing for this turn
                case 'finish_task':
                    addMessage({ type: MessageType.AgentSummary, text: args.summary as string});
                    toolResult = { success: true, summary: args.summary };
                    
                    // This is the handover point. The verified draft becomes the new live version.
                    setLiveFileSystem(tempFileSystem);
                    
                    setAgentActivity(null);
                    setIsBuilding(false); // Triggers WebContainer to boot/update
                    setViewMode('preview');
                    setMobileView('editor');
                    
                    if (!project.id && project.name) {
                        try {
                            const newProject = await projectService.createProject(project.name, aiProvider, tempFileSystem);
                            setProject(newProject);
                            onProjectDataChange(newProject);
                            lastSavedFileSystem.current = tempFileSystem;
                        } catch(e) {
                            console.error("Error saving project:", e);
                            addMessage({ type: MessageType.System, text: `Error saving project: ${e instanceof Error ? e.message : 'Unknown error'}`});
                        }
                    }
                    return; // End of recursive processing
                default:
                    toolResult = { error: 'Unknown tool' };
            }
        }
        functionCallParts.push({ functionCall: call });
        functionResponseParts.push({ functionResponse: { name, response: toolResult } });
    }

    applyEditsToState(tempFileSystem);

    if (functionCallParts.length > 0) {
        conversationHistoryRef.current.push({ role: 'model', parts: functionCallParts });
        conversationHistoryRef.current.push({ role: 'function', parts: functionResponseParts });

        const nextResponse = await generateContentWithTools(aiProvider, conversationHistoryRef.current, tempFileSystem);
        await processAgentResponse(nextResponse, tempFileSystem);
    } else if (response.text) {
        addMessage({ type: MessageType.AgentThought, text: response.text });
        conversationHistoryRef.current.push({ role: 'model', parts: [{ text: response.text }] });
        setAgentActivity(null);
    } else {
        addMessage({ type: MessageType.System, text: "Agent finished its turn without text or tool calls." });
        setAgentActivity(null);
    }
  }, [activeFile, aiProvider, project.id, project.name, onProjectDataChange]);


  const handlePromptSubmit = useCallback(async (promptText: string, attachments: { mimeType: string; data: string }[]) => {
    setAgentActivity('MominAI is thinking...');

    // FIX: Do not reset draftFileSystem. The agent should continue working on the current draft.
    const currentDraft = { ...draftFileSystem };

    const attachmentUrls = attachments.map(a => `data:${a.mimeType};base64,${a.data}`);
    addMessage({ type: MessageType.User, text: promptText, attachments: attachmentUrls });

    const userParts: any[] = [{ text: promptText }];
    for (const attachment of attachments) {
        userParts.push({
            inlineData: {
                mimeType: attachment.mimeType,
                data: attachment.data
            }
        });
    }

    conversationHistoryRef.current.push({
      role: 'user', parts: userParts
    });

    try {
      // Retrieve conversation context from memory for better AI responses
      if (project.id) {
        const context = await memoryService.getConversationContext(project.id);
        if (context.length > 0) {
          // Add context to conversation history
          conversationHistoryRef.current.unshift({
            role: 'system',
            parts: [{ text: `Previous conversation context: ${JSON.stringify(context)}` }]
          });
        }
      }

      // FIX: Pass the current draft file system to the AI for context and as the starting point for edits.
      const response = await generateContentWithTools(aiProvider, conversationHistoryRef.current, currentDraft);
      await processAgentResponse(response, currentDraft);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Report error through error handling service
      if (project.id) {
        await errorHandlingService.reportError(project.id, 'api_error', errorMessage, {
          provider: aiProvider,
          promptLength: promptText.length,
          attachmentsCount: attachments.length
        });
      }

      addMessage({
        type: MessageType.System,
        text: `An error occurred: ${errorMessage}`,
      });

      if (errorMessage.includes("API key not found")) {
        onManageKeysClick();
      }

      console.error(error);
      setAgentActivity(null);
      setIsBuilding(false);
    }
  }, [draftFileSystem, processAgentResponse, aiProvider, onManageKeysClick, project.id]);

  const handlePlanApproved = useCallback(async () => {
    if (!pendingPlan) return;

    const { messageId, planData, fileSystem: fsAtPlanTime } = pendingPlan;
    
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isAwaitingApproval: false } : m));
    setPendingPlan(null);

    const { call, result } = planData;
    const functionResponseParts = [{ functionResponse: { name: call.name, response: result } }];
    
    conversationHistoryRef.current.push({ role: 'function', parts: functionResponseParts });

    try {
        setAgentActivity('MominAI is executing the plan...');
        const nextResponse = await generateContentWithTools(aiProvider, conversationHistoryRef.current, fsAtPlanTime);
        await processAgentResponse(nextResponse, fsAtPlanTime);
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       addMessage({ type: MessageType.System, text: `An error occurred after plan approval: ${errorMessage}`});
       setAgentActivity(null);
       setIsBuilding(false);
    }
  }, [pendingPlan, aiProvider, processAgentResponse]);

  const handlePlanRejected = useCallback(() => {
    if (!pendingPlan) return;
    const { messageId } = pendingPlan;

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isAwaitingApproval: false, text: m.text + "\n\n**Plan Rejected by user.**" } : m));
    setPendingPlan(null);
    setAgentActivity(null);
    
    addMessage({
        type: MessageType.System,
        text: "Plan rejected. The agent has stopped. Please refine your prompt and try again."
    });
    
    // Pop the last two messages from history: the user prompt and the model's plan
    if (conversationHistoryRef.current.length >= 2) {
        conversationHistoryRef.current.pop(); // model's plan_steps call
        conversationHistoryRef.current.pop(); // user's prompt
    }

  }, [pendingPlan]);


  // Initialize collaboration when project is loaded
  useEffect(() => {
    if (project.id && session?.user) {
      const userName = session.user.email?.split('@')[0] || 'Anonymous';

      // Initialize collaboration service
      collaborationService.joinSession(project.id, userName)
        .then(() => {
          setCollaborationEnabled(true);
          console.log('Collaboration session joined');
        })
        .catch(error => {
          console.error('Failed to join collaboration session:', error);
        });

      // Set up collaboration event handlers
      collaborationService.setMessageHandler((message: Message) => {
        // Only add messages from other users
        if (message.userId !== session.user.id) {
          setMessages(prev => [...prev, message]);
        }
      });

      collaborationService.setUserJoinedHandler((userId: string, userName: string) => {
        setActiveCollaborators(prev => ({ ...prev, [userId]: userName }));
        addMessage({
          type: MessageType.System,
          text: `${userName} joined the session`
        });
      });

      collaborationService.setUserLeftHandler((userId: string) => {
        const userName = activeCollaborators[userId];
        setActiveCollaborators(prev => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
        if (userName) {
          addMessage({
            type: MessageType.System,
            text: `${userName} left the session`
          });
        }
      });

      return () => {
        collaborationService.leaveSession();
        setCollaborationEnabled(false);
      };
    }
  }, [project.id, session?.user]);

  useEffect(() => {
    if (!project.id && project.name && !initialPromptSentRef.current) {
      initialPromptSentRef.current = true;
      handlePromptSubmit(`Create a new React application for: ${project.name}`, project.initialAttachments || []);
    } else if (project.id) {
        setIsBuilding(false);
        if (!isDesktop) {
            setViewMode('preview');
            setMobileView('editor');
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.name, isDesktop]);
  
  const handleExitWithConfirmation = () => {
    if (window.confirm("Are you sure you want to exit? The development server will be shut down and will need to restart if you return.")) {
      onExit();
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-ide-bg text-white font-sans">
      <DiffModal 
        isOpen={diffModalData.isOpen}
        onClose={closeDiffModal}
        files={diffModalData.files || []}
        diff={diffModalData.diff}
      />
      <Header
        projectName={project.name || 'New Project'}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isBuilding={isBuilding}
        onExit={handleExitWithConfirmation}
        projectUpdatedAt={project.updated_at}
        onOpenSettings={() => onOpenSettings(project.id)}
        onOpenGithubModal={onOpenGithubModal}
        mobileView={mobileView}
        onMobileViewChange={setMobileView}
        isBootingWebContainer={isBootingWebContainer}
        isInstallingDeps={isInstallingDeps}
        isStartingServer={isStartingServer}
        bootProgress={bootProgress}
      />
      <div className="flex flex-row flex-grow overflow-hidden min-h-0">
        <div
          style={isDesktop ? { width: leftPanelWidth } : {}}
          className={`h-full flex-shrink-0 flex-col ${isDesktop || mobileView === 'chat' ? 'flex' : 'hidden'} ${!isDesktop ? 'w-full' : ''}`}
        >
          <LeftPanel
            initialPrompt={project.name || ''}
            messages={messages}
            onPromptSubmit={handlePromptSubmit}
            agentActivity={agentActivity}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            aiProvider={aiProvider}
            onAiProviderChange={setAiProvider}
            onManageKeysClick={onManageKeysClick}
            onShowDiff={showDiffModal}
            pendingPlanMessageId={pendingPlan?.messageId || null}
            onPlanApproved={handlePlanApproved}
            onPlanRejected={handlePlanRejected}
          />
        </div>
        {isDesktop && <div onMouseDown={startResize} className="resizer" />}
        <div className={`h-full flex-grow flex-col ${isDesktop || mobileView === 'editor' ? 'flex' : 'hidden'} ${!isDesktop ? 'w-full' : ''}`}>
          <CenterPanel
              fileSystem={draftFileSystem}
              activeFile={activeFile}
              onFileSelect={setActiveFile}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onFileSystemChange={handleDraftFileSystemChange}
              isBuilding={isBuilding}
              iframeUrl={iframeUrl}
              previewStatus={previewStatus}
          />
        </div>
      </div>
    </div>
  );
};

export default IdeLayout;