import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { MainPanel } from '../components/MainPanel';
import { AssistantPanel } from '../components/AssistantPanel';
import { Header } from '../components/Header';
import { CanvasView } from '../components/CanvasView';
import { SettingsPanel } from '../components/SettingsPanel';
import { geminiService, serializeRelevantFiles } from '../services/geminiService';
import type { FileNode, AIAction, FileContentUpdate, ImageData, ChatMessage, ViewMode, FlowData, Settings, GroundingSource, UsageMetadata, MainViewMode, AnalysisResults, TaskStatus, AITask } from '../types';
import { produce } from 'immer';
import { ComingSoonPanel } from '../components/ComingSoonPanel';
import { AnalyticsPanel } from '../components/AnalyticsPanel';

const initialFiles: FileNode = {
  name: 'root',
  type: 'folder',
  children: [
    {
      name: 'frontend',
      type: 'folder',
      children: [
        {
          name: 'public',
          type: 'folder',
          children: [
            { name: 'index.html', type: 'file', content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>` },
          ]
        },
        {
          name: 'src',
          type: 'folder',
          children: [
            { name: 'index.tsx', type: 'file', content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);` },
            { name: 'App.tsx', type: 'file', content: `import React from 'react';\n\nfunction App() {\n  return (\n    <div>\n      <h1>Hello, World!</h1>\n    </div>\n  );\n}\n\nexport default App;` },
          ]
        },
        { name: 'package.json', type: 'file', content: `{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}`},
      ],
    },
    {
      name: 'backend',
      type: 'folder',
      children: [
        { name: 'package.json', type: 'file', content: `{
  "name": "backend-server",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}`},
        { name: '.gitignore', type: 'file', content: `node_modules`},
      ]
    },
    {
      name: 'knowledge-base',
      type: 'folder',
      children: [
        { name: '.gitkeep', type: 'file', content: '' },
      ]
    },
    { name: 'README.md', type: 'file', content: `# AI Full-Stack IDE

This project contains both a frontend and a backend.

## Frontend

The \`frontend\` directory contains a standard React application.

## Backend

The \`backend\` directory contains a Node.js server. To run it, you would typically use \`npm install\` and then \`npm start\` from within the directory.`},
    { name: '.gitignore', type: 'file', content: `frontend/node_modules\nbackend/node_modules`},
  ],
};


const defaultSettings: Settings = {
  theme: 'dark',
  editorFontSize: 14,
  aiModel: 'gemini-2.5-flash',
  deepThinkingDefault: false,
};

const IDEPage: React.FC = () => {
  const [files, setFiles] = useState<FileNode>(() => JSON.parse(JSON.stringify(initialFiles)));
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('IDE');
  const [mainViewMode, setMainViewMode] = useState<MainViewMode>('CODE');
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [agentContext, setAgentContext] = useState<string>('');
  
  const location = useLocation();
  const initialPromptRef = useRef((location.state as { initialPrompt?: string })?.initialPrompt);

  const currentTaskRef = useRef<Promise<void> | null>(null);
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);


  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('ai-react-ide-settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ai-react-ide-settings', JSON.stringify(settings));
      if(settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  }, [settings]);

  const findFileAndGetContent = (path: string, root: FileNode = files): string | undefined => {
      const parts = path.split('/');
      let currentNode: FileNode | undefined = root;
      // Start from root's children if path is not 'root'
      let children = currentNode.children;
      for (const part of parts) {
        if (!children) return undefined;
        currentNode = children.find(child => child.name === part);
        if (!currentNode) return undefined;
        children = currentNode.children;
      }
      return currentNode?.type === 'file' ? currentNode.content : undefined;
  }

  const handleFileSelect = useCallback((path: string) => {
    setActiveFile(path);
    if (!openFiles.includes(path)) {
      setOpenFiles(prev => [...prev, path]);
    }
  }, [openFiles]);

  const handleCloseTab = (path: string) => {
    setOpenFiles(prev => prev.filter(p => p !== path));
    if (activeFile === path) {
      const newActiveFile = openFiles.filter(p => p !== path)[0] || null;
      setActiveFile(newActiveFile);
    }
  };
  
  const updateFileContent = (path: string, newContent: string, isNew: boolean) => {
    setFiles(
      produce(draft => {
        const pathParts = path.split('/');
        let currentChildren = draft.children;
  
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          let folder = currentChildren?.find(c => c.name === part && c.type === 'folder');
          if (!folder) {
            const newFolder: FileNode = { name: part, type: 'folder', children: [] };
            currentChildren?.push(newFolder);
            folder = newFolder;
          }
          currentChildren = folder.children;
        }
  
        const fileName = pathParts[pathParts.length - 1];
        const fileIndex = currentChildren?.findIndex(c => c.name === fileName);
  
        if (fileIndex !== undefined && fileIndex > -1) {
          const file = currentChildren?.[fileIndex];
          if (file?.type === 'file') {
             file.content = isNew ? newContent : (file.content || '') + newContent;
          }
        } else {
          currentChildren?.push({ name: fileName, type: 'file', content: newContent });
        }
      })
    );
  };

  const runAutoValidation = async () => {
    // Add "VALIDATING" action to the most recent assistant message's journal.
    setChatHistory(prev => produce(prev, draft => {
      const lastAssistantMessage = [...draft].reverse().find(m => m.role === 'assistant');
      if (lastAssistantMessage) {
        if (!lastAssistantMessage.actions) lastAssistantMessage.actions = [];
        lastAssistantMessage.actions.push({ type: 'VALIDATING', target: 'Running automated code review...' });
      }
    }));

    let analysisResultsData: AnalysisResults | null = null;
    try {
      const analysisStream = geminiService('analyze_project', 'Analyze the project codebase.', null, files, 'gemini-2.5-pro');
      for await (const chunk of analysisStream) {
        if (chunk.type === 'analysis_result') {
          analysisResultsData = chunk.data;
          break;
        }
      }
    } catch (error) {
      console.error("Auto-validation analysis failed:", error);
      setChatHistory(prev => produce(prev, draft => {
        const lastAssistantMessage = [...draft].reverse().find(m => m.role === 'assistant');
        if (lastAssistantMessage) {
          lastAssistantMessage.actions = lastAssistantMessage.actions?.filter(a => a.type !== 'VALIDATING');
        }
        draft.push({ role: 'assistant', content: 'Automated code review failed to run.', isLoading: false });
      }));
      return;
    }

    if (!analysisResultsData) return;

    const allFindings = [...analysisResultsData.bugs, ...analysisResultsData.improvements, ...analysisResultsData.security, ...analysisResultsData.features];
    
    if (allFindings.length === 0) {
      setChatHistory(prev => produce(prev, draft => {
        const msgWithValidation = [...draft].reverse().find(m => m.actions?.some(a => a.type === 'VALIDATING'));
        if (msgWithValidation) {
          msgWithValidation.actions = msgWithValidation.actions?.filter(a => a.type !== 'VALIDATING');
        }
        draft.push({ role: 'assistant', content: "Automated code review complete. No issues found!", isLoading: false });
      }));
      return;
    }

    setChatHistory(prev => [...prev, { role: 'assistant', content: '', isLoading: true }]);

    try {
      const summaryStream = geminiService('summarize_analysis', JSON.stringify(analysisResultsData), null, files, 'gemini-2.5-flash');
      for await (const chunk of summaryStream) {
         if (chunk.type === 'message') {
           setChatHistory(prev => produce(prev, draft => {
              const lastMessage = draft[draft.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.content += chunk.data.content;
              }
            }));
        } else if (chunk.type === 'usage_metadata') {
           setChatHistory(prev => produce(prev, draft => {
              const lastMessage = draft[draft.length - 1];
              if (lastMessage?.role === 'assistant') {
                lastMessage.usageMetadata = chunk.data;
              }
            }));
        }
      }
    } catch (error) {
       console.error("Failed to summarize analysis:", error);
       setChatHistory(prev => produce(prev, draft => {
          const lastMessage = draft[draft.length - 1];
          if (lastMessage?.role === 'assistant') {
            lastMessage.content = "I ran into an issue while summarizing the code review findings.";
          }
       }));
    } finally {
        setChatHistory(prev => produce(prev, draft => {
            const summaryMessage = draft[draft.length - 1];
            if (summaryMessage?.role === 'assistant') {
                summaryMessage.isLoading = false;
            }
            const originalMessageWithValidation = [...draft].reverse().find(m => m.actions?.some(a => a.type === 'VALIDATING'));
             if (originalMessageWithValidation) {
                originalMessageWithValidation.actions = originalMessageWithValidation.actions?.filter(a => a.type !== 'VALIDATING');
            }
        }));
    }
  };

  const processGenerationStream = useCallback(async (stream: AsyncGenerator<{ type: string; data: any; }, void, unknown>) => {
    let isNewFile: { [key: string]: boolean } = {};
    for await (const chunk of stream) {
      if (chunk.type === 'action') {
        const newAction = chunk.data as AIAction;
        setChatHistory(produce(draft => {
          const lastMessage = draft[draft.length - 1];
          if (!lastMessage || lastMessage.role !== 'assistant') return;

          if (!lastMessage.actions) lastMessage.actions = [];
          lastMessage.actions.push(newAction);

          if (!lastMessage.tasks) return;
          
          if (newAction.type === 'TASK_START' || newAction.type === 'TASK_COMPLETE' || newAction.type === 'TASK_FAIL') {
              const statusMap = { 'TASK_START': 'IN_PROGRESS', 'TASK_COMPLETE': 'COMPLETED', 'TASK_FAIL': 'FAILED' };
              const task = lastMessage.tasks.find(t => t.id === newAction.target);
              if (task) {
                  task.status = statusMap[newAction.type] as TaskStatus;
              }
          } else if (['WRITE', 'EDIT', 'READ', 'INSTALL', 'COMMAND'].includes(newAction.type)) {
              const currentTask = lastMessage.tasks.find(t => t.status === 'IN_PROGRESS');
              if (currentTask) {
                  if (!currentTask.actions) currentTask.actions = [];
                  currentTask.actions.push(newAction);
              }
          }
        }));
        
        if(newAction.type === 'WRITE') {
            isNewFile[newAction.target!] = true;
        }
      } else if (chunk.type === 'file-content') {
        const { path, content } = chunk.data as FileContentUpdate;
        if (isNewFile[path]) {
            updateFileContent(path, content, true);
            isNewFile[path] = false; 
        } else {
            updateFileContent(path, content, false);
        }
        if (!openFiles.includes(path)) {
            setOpenFiles(prev => [...prev, path]);
        }
        if (activeFile === null || activeFile !== path) {
            setActiveFile(path);
        }
      } else if(chunk.type === 'message') {
          const messageChunk = chunk.data as ChatMessage;
          setChatHistory(produce(draft => {
              const lastMessage = draft[draft.length-1];
              if(lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.content += messageChunk.content;
              }
          }));
      } else if (chunk.type === 'usage_metadata') {
        const metadata = chunk.data as UsageMetadata;
        setChatHistory(produce(draft => {
          const lastMessage = draft[draft.length-1];
          if (lastMessage?.role === 'assistant') {
            lastMessage.usageMetadata = metadata;
          }
        }));
      }
    }
  }, [openFiles, activeFile]);

  const executeCodeGeneration = async (prompt: string, image: ImageData | null, isThinkingMode: boolean, approvedPlan: {prd: string, flow: FlowData}) => {
    setIsProcessing(true);
    setChatHistory(prev => produce(prev, draft => {
      const lastMessage = draft[draft.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.actions?.push({type: 'PLANNING', target: 'Plan approved. Starting code generation.'});
        lastMessage.isLoading = true;
      } else {
        draft.push({ role: 'assistant', content: '', isLoading: true, actions: [{type: 'PLANNING', target: 'Plan approved. Starting code generation.'}] });
      }
    }));

    const task = async () => {
      const modelName = isThinkingMode ? 'gemini-2.5-pro' : settings.aiModel;
      
      // Initial run
      try {
        const stream = geminiService('code', prompt, image, filesRef.current, modelName, approvedPlan);
        await processGenerationStream(stream);
      } catch (error) {
        console.error('Error processing initial stream:', error);
      }

      // Self-healing continuation loop
      let allTasksCompleted = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!allTasksCompleted && attempts < maxAttempts) {
        attempts++;
        
        let incompleteTasks: AITask[] = [];
        setChatHistory(currentHistory => {
            const lastMessageWithTasks = [...currentHistory].reverse().find(m => m.role === 'assistant' && m.tasks);
            if (lastMessageWithTasks?.tasks) {
                incompleteTasks = lastMessageWithTasks.tasks.filter(t => t.status !== 'COMPLETED');
            }
            return currentHistory;
        });

        if (incompleteTasks.length === 0) {
            allTasksCompleted = true;
            continue;
        }

        setChatHistory(prev => produce(prev, draft => {
            const assistantMessage = draft[draft.length - 1];
            if (assistantMessage) {
                if(!assistantMessage.actions) assistantMessage.actions = [];
                assistantMessage.actions.push({ type: 'FIXING', target: `Generation was interrupted. Resuming with ${incompleteTasks.length} pending tasks.` });
                assistantMessage.isLoading = true;
            }
        }));

        try {
            const stream = geminiService('continue_code', prompt, image, filesRef.current, modelName, { ...approvedPlan, incompleteTasks });
            await processGenerationStream(stream);
        } catch (error) {
            console.error(`Error during continuation attempt ${attempts}:`, error);
        }
      }

      // Final state updates
      setIsProcessing(false);
      setChatHistory(prev => produce(prev, draft => {
          const lastMessage = draft[draft.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.isLoading = false;
            if (!allTasksCompleted) {
                if(!lastMessage.actions) lastMessage.actions = [];
                lastMessage.actions.push({ type: 'TASK_FAIL', target: 'Failed to complete all tasks after multiple attempts.' });
            }
          }
      }));
    };

    currentTaskRef.current = task();
    await currentTaskRef.current;
    await runAutoValidation();
  };

  const handleAcceptPlan = useCallback(async (approvedFlow: FlowData) => {
    setViewMode('IDE');
    const minPrdContent = findFileAndGetContent('min-prd.md');
    if (minPrdContent === undefined) {
      console.warn("min-prd.md file not found! Proceeding without it.");
    }
    
    const lastUserMessage = [...chatHistory].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) {
        console.error("Could not find original user prompt");
        return;
    }

    const { content, image } = lastUserMessage;
    const isThinkingMode = chatHistory.some(m => m.role === 'assistant' && m.actions?.some(a => a.type === 'THINKING'));

    await executeCodeGeneration(content, image || null, isThinkingMode, { prd: minPrdContent || '', flow: approvedFlow });

  }, [files, chatHistory, settings.aiModel]);


  const handlePromptSubmit = useCallback(async (prompt: string, image: ImageData | null, isThinkingMode: boolean) => {
    if (isProcessing) return;

    let processedPrompt = prompt;
    const shouldStudy = prompt.includes('@study');
    const shouldSearch = prompt.includes('@search');

    if (shouldStudy) {
      processedPrompt = processedPrompt.replace(/@study/g, '').trim();
    }
    if (shouldSearch) {
      processedPrompt = `(User has explicitly requested a web search. Prioritize using the search tool for this query.)\n\n${processedPrompt.replace(/@search/g, '').trim()}`;
    }
    if (processedPrompt.includes('@context')) {
        processedPrompt = processedPrompt.replace(/@context/g, `\n\nHere is the agent context you should consider:\n---BEGIN CONTEXT---\n${agentContext}\n---END CONTEXT---\n\n`);
    }

    setIsProcessing(true);
    setViewMode('IDE');
    setFlowData(null);
    
    const userMessage: ChatMessage = { role: 'user', content: processedPrompt, ...(image && { image }) };
    setChatHistory(prev => [...prev, userMessage, { role: 'assistant', content: '', isLoading: true, actions: [{type: 'THINKING', target: 'Routing request...'}] }]);
    
    let phase: 'plan' | 'chat' | 'study_only' = 'chat';
    let topicForSummary = '';
    
    try {
        const preProcessStream = geminiService('pre_process', processedPrompt, image, files, 'gemini-2.5-flash');
        for await (const chunk of preProcessStream) {
            if (chunk.type === 'routing_decision') {
                phase = chunk.data.phase;
                if (chunk.data.topic) {
                    topicForSummary = chunk.data.topic;
                }
                break;
            }
        }
    } catch (e) {
        console.error("Pre-processing failed, defaulting to chat phase.", e);
        phase = 'chat';
    }
    
    // Override routing if @study is used
    if (shouldStudy && phase !== 'plan') {
        phase = 'study_only';
    }


    const modelName = isThinkingMode ? 'gemini-2.5-pro' : settings.aiModel;
    let knowledgeContext = '';
    let didPerformCodeActions = false;

    // --- Main Execution Flow ---
    const task = async () => {
      try {
        // --- Phase 1: Research (if needed) ---
        if (phase === 'plan' || phase === 'study_only') {
          let isNewFile: { [key: string]: boolean } = {};
          const researchStream = geminiService('research_and_synthesize', processedPrompt, image, files, 'gemini-2.5-pro', undefined, undefined, undefined, shouldStudy);
          for await (const chunk of researchStream) {
            if (chunk.type === 'action') {
              const newAction = chunk.data as AIAction;
              setChatHistory(prev => produce(prev, draft => {
                  const lastMessage = draft[draft.length - 1];
                  if (!lastMessage || lastMessage.role !== 'assistant') return;
                  if (!lastMessage.actions) lastMessage.actions = [];
                  if (lastMessage.actions.length === 1 && lastMessage.actions[0].type === 'THINKING') {
                      lastMessage.actions = [newAction]; // Replace initial 'Thinking'
                  } else {
                      lastMessage.actions.push(newAction);
                  }
              }));
              if (newAction.type === 'WRITE') isNewFile[newAction.target!] = true;
            } else if (chunk.type === 'file-content') {
              const { path, content } = chunk.data as FileContentUpdate;
              if (isNewFile[path]) {
                  updateFileContent(path, content, true);
                  isNewFile[path] = false;
              } else {
                  updateFileContent(path, content, false);
              }
              if (!openFiles.includes(path)) setOpenFiles(prev => [...prev, path]);
              if (activeFile === null || activeFile !== path) setActiveFile(path);
            } else if (chunk.type === 'knowledge_context') {
               knowledgeContext = chunk.data as string;
            }
          }
        }

        // --- Phase 2: Main Action (Plan, Study Summary, or Chat) ---
        if (phase === 'study_only') {
          // Just study and summarize
          const summaryStream = geminiService('summarize_research', '', null, files, 'gemini-2.5-flash', undefined, undefined, knowledgeContext, false, topicForSummary);
          for await (const chunk of summaryStream) {
             if(chunk.type === 'message') {
                const messageChunk = chunk.data as ChatMessage;
                setChatHistory(prev => produce(prev, draft => {
                    const lastMessage = draft[draft.length-1];
                    if(lastMessage && lastMessage.role === 'assistant') {
                        lastMessage.content += messageChunk.content;
                    }
                }));
            } else if (chunk.type === 'usage_metadata') {
                setChatHistory(prev => produce(prev, draft => {
                    const lastMessage = draft[draft.length - 1];
                    if (lastMessage?.role === 'assistant') {
                        lastMessage.usageMetadata = chunk.data;
                    }
                }));
            }
          }

        } else { // Handle 'plan' and 'chat' phases
            let relevantFilesContent = serializeRelevantFiles(files, ['*']);
            if (knowledgeContext) {
                 relevantFilesContent += `\n\n${knowledgeContext}`;
            }

            const stream = geminiService(phase, processedPrompt, image, files, modelName, undefined, [userMessage], relevantFilesContent);
            let isNewFile: { [key: string]: boolean } = {};
      
            for await (const chunk of stream) {
              if (chunk.type === 'action') {
                const newAction = chunk.data as AIAction;
                if (newAction.type === 'WRITE' || newAction.type === 'EDIT') {
                  didPerformCodeActions = true;
                }
    
                setChatHistory(prev => produce(prev, draft => {
                    const lastMessage = draft[draft.length - 1];
                    if (!lastMessage || lastMessage.role !== 'assistant') return;
                    if (!lastMessage.actions) lastMessage.actions = [];
                     if (lastMessage.actions.length === 1 && lastMessage.actions[0].type === 'THINKING') {
                        lastMessage.actions = [newAction]; // Replace initial 'Thinking'
                    } else {
                        lastMessage.actions.push(newAction);
                    }
                    if (!lastMessage.tasks) return;
                    if (newAction.type === 'TASK_START' || newAction.type === 'TASK_COMPLETE' || newAction.type === 'TASK_FAIL') {
                        const statusMap = { 'TASK_START': 'IN_PROGRESS', 'TASK_COMPLETE': 'COMPLETED', 'TASK_FAIL': 'FAILED' };
                        const task = lastMessage.tasks.find(t => t.id === newAction.target);
                        if (task) {
                            task.status = statusMap[newAction.type] as TaskStatus;
                        }
                    } else if (['WRITE', 'EDIT', 'READ', 'INSTALL', 'COMMAND', 'SEARCH'].includes(newAction.type)) {
                        const currentTask = lastMessage.tasks.find(t => t.status === 'IN_PROGRESS');
                        if (currentTask) {
                            if (!currentTask.actions) currentTask.actions = [];
                            currentTask.actions.push(newAction);
                        }
                    }
                }));
    
                if(newAction.type === 'WRITE') {
                    isNewFile[newAction.target!] = true;
                    if (newAction.target === 'min-prd.md') {
                        setAgentContext('');
                    }
                }
              } else if (chunk.type === 'file-content') {
                const { path, content } = chunk.data as FileContentUpdate;
                if (path === 'min-prd.md') {
                    setAgentContext(prev => prev + content);
                }
                if (isNewFile[path]) {
                    updateFileContent(path, content, true);
                    isNewFile[path] = false; 
                } else {
                    updateFileContent(path, content, false);
                }
                if (!openFiles.includes(path)) {
                    setOpenFiles(prev => [...prev, path]);
                }
                if (activeFile === null || activeFile !== path) {
                    setActiveFile(path);
                }
              } else if(chunk.type === 'message') {
                  const messageChunk = chunk.data as ChatMessage;
                  setChatHistory(prev => produce(prev, draft => {
                      const lastMessage = draft[draft.length-1];
                      if(lastMessage && lastMessage.role === 'assistant') {
                          lastMessage.content += messageChunk.content;
                      }
                  }));
              } else if (chunk.type === 'task_list') {
                const tasks = (chunk.data as any[]).map(t => ({...t, status: 'PENDING', actions: []}));
                setChatHistory(prev => produce(prev, draft => {
                    const lastMessage = draft[draft.length-1];
                    if(lastMessage && lastMessage.role === 'assistant') {
                        lastMessage.tasks = tasks as AITask[];
                    }
                }));
              } else if (chunk.type === 'flow-data') {
                const flow = chunk.data as FlowData;
                setFlowData(flow);
                setViewMode('CANVAS');
              } else if (chunk.type === 'search_sources') {
                const sources = chunk.data as GroundingSource[];
                setChatHistory(prev => produce(prev, draft => {
                    const lastMessage = draft[draft.length-1];
                    if(lastMessage && lastMessage.role === 'assistant') {
                        lastMessage.sources = sources;
                    }
                }));
              } else if (chunk.type === 'usage_metadata') {
                const metadata = chunk.data as UsageMetadata;
                setChatHistory(prev => produce(prev, draft => {
                  const lastMessage = draft[draft.length-1];
                  if (lastMessage?.role === 'assistant') {
                    lastMessage.usageMetadata = metadata;
                  }
                }));
              }
            }
        }

      } catch (error) {
        console.error('Error processing stream:', error);
        setChatHistory(prev => produce(prev, draft => {
            const lastMessage = draft[draft.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              if (!lastMessage.actions) lastMessage.actions = [];
              lastMessage.actions.push({ type: 'FIXING', target: 'An error occurred.' });
            }
        }));
      } finally {
        setIsProcessing(false);
        setChatHistory(prev => produce(prev, draft => {
            const lastMessage = draft[draft.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              if(viewMode !== 'CANVAS') {
                 lastMessage.isLoading = false;
              }
            }
        }));
      }
    };

    currentTaskRef.current = task();
    await currentTaskRef.current;
  
    if (phase === 'chat' && didPerformCodeActions) {
      await runAutoValidation();
    }

  }, [isProcessing, openFiles, activeFile, files, viewMode, chatHistory, settings.aiModel, agentContext]);

  useEffect(() => {
    if (initialPromptRef.current) {
        handlePromptSubmit(initialPromptRef.current, null, settings.deepThinkingDefault);
        initialPromptRef.current = undefined; // Consume it
    }
  }, [handlePromptSubmit, settings.deepThinkingDefault]);

  const editorContent = activeFile ? findFileAndGetContent(activeFile) : "// Select a file to view its content";

  const handleResetWorkspace = () => {
    if (window.confirm("Are you sure you want to reset the workspace? All files will be reverted to their initial state.")) {
      setFiles(JSON.parse(JSON.stringify(initialFiles)));
      setActiveFile(null);
      setOpenFiles([]);
      setChatHistory([]);
      setAgentContext('');
      setIsSettingsOpen(false);
    }
  }

  const renderMainView = () => {
    switch (mainViewMode) {
      case 'CODE':
        return (
          <>
            <div className="w-64 flex-shrink-0">
              <Sidebar 
                files={files} 
                onFileSelect={handleFileSelect} 
                activeFile={activeFile} 
                agentContext={agentContext}
                onAgentContextChange={setAgentContext}
              />
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <MainPanel
                editorContent={editorContent || ''}
                activeFile={activeFile}
                openFiles={openFiles}
                onTabSelect={setActiveFile}
                onTabClose={handleCloseTab}
                settings={settings}
              />
            </div>
          </>
        );
      case 'ANALYTICS':
        return <AnalyticsPanel 
          files={files}
          chatHistory={chatHistory}
          theme={settings.theme}
        />;
      case 'PREVIEW':
      case 'CLOUD':
        return <ComingSoonPanel view={mainViewMode} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen text-gray-800 dark:text-gray-200 font-sans overflow-hidden">
      <Header 
        onSettingsClick={() => setIsSettingsOpen(true)}
        mainViewMode={mainViewMode}
        onMainViewModeChange={setMainViewMode}
      />
      <main className="flex-1 flex overflow-hidden p-2 sm:p-4 gap-2 sm:gap-4">
        <div className="w-1/3 flex flex-col rounded-xl glass-panel min-w-[350px]">
            <AssistantPanel
              chatHistory={chatHistory}
              isLoading={isProcessing}
              onPromptSubmit={handlePromptSubmit}
              settings={settings}
            />
        </div>

        <div className="w-2/3 flex min-w-0 glass-panel rounded-xl overflow-hidden">
          {viewMode === 'IDE' ? (
            renderMainView()
          ) : (
            <div className="flex-1 flex flex-col min-w-0">
              {flowData && <CanvasView initialFlow={flowData} onAcceptPlan={handleAcceptPlan} theme={settings.theme} />}
            </div>
          )}
        </div>
      </main>
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        onResetWorkspace={handleResetWorkspace}
      />
    </div>
  );
};

export default IDEPage;
