import { User } from '@supabase/supabase-js';

export interface FileNode {
  name: string;
  path: string;
  content?: string;
  children?: FileNode[];
}

export type FileSystem = {
  [path: string]: string;
};

export enum MessageType {
  User = 'user',
  AgentThought = 'agent_thought',
  AgentEdits = 'agent_edits',
  AgentSummary = 'agent_summary',
  System = 'system',
}

export interface Message {
  id: string;
  type: MessageType;
  text: string;
  files?: string[]; // for AgentEdits
  attachments?: string[]; // for user message image attachments
  diff?: {
    oldFS: FileSystem;
    newFS: FileSystem;
  };
  isAwaitingApproval?: boolean;
}

// Enhanced types from MominAI-9 test for better infographics
export type ActionType =
  | 'THINKING'
  | 'PLANNING'
  | 'INSTALL'
  | 'READ'
  | 'WRITE'
  | 'EDIT'
  | 'BUILD'
  | 'FIXING'
  | 'COMMAND'
  | 'COMPLETE'
  | 'PLAN_GENERATE'
  | 'SEARCH'
  | 'RESEARCH'
  | 'TASK_START'
  | 'TASK_COMPLETE'
  | 'TASK_FAIL'
  | 'VALIDATING';

export interface AIAction {
  type: ActionType;
  target?: string;
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface AITask {
  id: string;
  description: string;
  status: TaskStatus;
  actions?: AIAction[];
}

export interface ImageData {
  base64: string;
  mimeType: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: ImageData;
  actions?: AIAction[];
  tasks?: AITask[];
  isLoading?: boolean;
  sources?: GroundingSource[];
  usageMetadata?: UsageMetadata;
}

// FIX: Removed 'pexels' as it is a tool used by providers, not a standalone content generation provider. This resolves type errors in components that use AiProvider as a key for Record types.
export type AiProvider = 'gemini' | 'claude' | 'openai' | 'groq' | 'openrouter';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  file_system: FileSystem;
  provider: AiProvider;
  created_at: string;
  updated_at: string;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  file_system: FileSystem;
  summary: string | null;
  created_at: string;
}

export interface SimplifiedGenerateContentResponse {
  text: string;
  functionCalls: ({ name: string; args: any; })[] | undefined;
}


export type { User };