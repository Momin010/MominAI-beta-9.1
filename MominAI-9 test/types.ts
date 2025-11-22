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

export type FileNode = {
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
};

export interface FileContentUpdate {
    path: string;
    content: string;
    isDone?: boolean;
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

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface AITask {
    id: string;
    description: string;
    status: TaskStatus;
    actions?: AIAction[];
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

export type ViewMode = 'IDE' | 'CANVAS';
export type MainViewMode = 'CODE' | 'PREVIEW' | 'CLOUD' | 'ANALYTICS';

// Simplified FlowData for Mermaid.js - it's just a string.
export type FlowData = string;

export interface Settings {
  theme: 'light' | 'dark';
  editorFontSize: number;
  aiModel: 'gemini-2.5-pro' | 'gemini-2.5-flash';
  deepThinkingDefault: boolean;
}

export type AnalysisCategory = 'Bug' | 'Improvement' | 'Security' | 'Feature';

export interface AnalysisFinding {
  category: AnalysisCategory;
  finding: string;
  suggestion: string;
}

export interface AnalysisResults {
  bugs: AnalysisFinding[];
  improvements: AnalysisFinding[];
  security: AnalysisFinding[];
  features: AnalysisFinding[];
}

export type GeminiPhase = 'select_files' | 'plan' | 'code' | 'chat' | 'analyze_project' | 'summarize_analysis' | 'pre_process' | 'research_and_synthesize' | 'continue_code' | 'study_only' | 'summarize_research';