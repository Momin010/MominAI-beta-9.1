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
  timestamp?: number; // for real-time collaboration
  userId?: string; // for real-time collaboration
  userName?: string; // for real-time collaboration
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

export interface CollaborationSession {
  id: string;
  projectId: string;
  participants: string[];
  activeUsers: { [userId: string]: { name: string; cursor?: { line: number; column: number; file: string } } };
  lastActivity: number;
}

export interface MemoryEntry {
  id: string;
  projectId: string;
  userId: string;
  type: 'user_preference' | 'code_pattern' | 'error_context' | 'conversation_context';
  key: string;
  value: any;
  timestamp: number;
  expiresAt?: number;
}


export type { User };