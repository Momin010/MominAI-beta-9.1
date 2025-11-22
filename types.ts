import { User } from '@supabase/supabase-js';

export interface FileNode {
  name: string;
  path: string;
  content?: string;
  children?: FileNode[];
}

// --- Error Handling Types ---

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  API = 'api',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  RUNTIME = 'runtime',
  RESOURCE = 'resource',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  userAgent?: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface AppError {
  id: string;
  message: string;
  code?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  originalError?: Error;
  stack?: string;
  retryable: boolean;
  userMessage: string;
  suggestedActions?: string[];
  technicalDetails?: string;
  timestamp: Date;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorInfo?: {
    componentStack: string;
  };
}

export interface ErrorOverlayProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  onReport?: () => void;
}

export interface ErrorPageProps {
  error: AppError;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export interface NetworkErrorDetails {
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  timeout?: boolean;
  responseSize?: number;
  responseTime?: number;
}

export interface APIErrorDetails {
  endpoint: string;
  method: string;
  statusCode: number;
  responseBody?: any;
  requestBody?: any;
  headers?: Record<string, string>;
}

export interface ValidationErrorDetails {
  field: string;
  value: any;
  rule: string;
  expected?: any;
}

export interface AuthErrorDetails {
  provider?: string;
  redirectUrl?: string;
  tokenExpired?: boolean;
  permissions?: string[];
}

export interface ConfigurationErrorDetails {
  missingVars: string[];
  invalidVars: string[];
  environment: string;
}

export interface ResourceErrorDetails {
  resource: string;
  available: number;
  required: number;
  limit: number;
}

// Error action types
export type ErrorAction =
  | { type: 'RETRY'; payload?: any }
  | { type: 'DISMISS' }
  | { type: 'REPORT'; payload: { userFeedback?: string } }
  | { type: 'RESET' }
  | { type: 'NAVIGATE'; payload: string };

// Error recovery strategies
export enum RecoveryStrategy {
  RETRY = 'retry',
  REFRESH = 'refresh',
  RELOAD = 'reload',
  REDIRECT = 'redirect',
  FALLBACK = 'fallback',
  IGNORE = 'ignore'
}

export interface ErrorRecovery {
  strategy: RecoveryStrategy;
  delay?: number;
  maxRetries?: number;
  fallbackData?: any;
  redirectUrl?: string;
}

// Error reporting
export interface ErrorReport {
  error: AppError;
  userFeedback?: string;
  userInfo: {
    id?: string;
    email?: string;
    plan?: string;
  };
  systemInfo: {
    browser: string;
    os: string;
    screenSize: string;
    timezone: string;
    language: string;
  };
  sessionInfo: {
    duration: number;
    actions: string[];
    lastAction: string;
  };
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