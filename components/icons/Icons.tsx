import React from 'react';
import {
  ArrowUp,
  Plus,
  Send,
  File,
  Folder,
  ChevronDown,
  ChevronRight,
  Eye,
  Code2,
  Search,
  Undo2,
  Redo2,
  Share2,
  Github,
  FilePenLine,
  CheckCircle2,
  Settings,
  Mic,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  type LucideProps,
} from 'lucide-react';

// Re-exporting with old names to minimize breaking changes
export const ArrowUpIcon: React.FC<LucideProps> = (props) => <ArrowUp {...props} />;
export const PlusIcon: React.FC<LucideProps> = (props) => <Plus {...props} />;
export const PaperAirplaneIcon: React.FC<LucideProps> = (props) => <Send {...props} />;
export const FileIcon: React.FC<LucideProps> = (props) => <File {...props} />;
export const FolderIcon: React.FC<LucideProps> = (props) => <Folder {...props} />;
export const ChevronDownIcon: React.FC<LucideProps> = (props) => <ChevronDown {...props} />;
export const ChevronRightIcon: React.FC<LucideProps> = (props) => <ChevronRight {...props} />;
export const EyeIcon: React.FC<LucideProps> = (props) => <Eye {...props} />;
export const CodeBracketIcon: React.FC<LucideProps> = (props) => <Code2 {...props} />;
export const MagnifyingGlassIcon: React.FC<LucideProps> = (props) => <Search {...props} />;
export const ArrowUturnLeftIcon: React.FC<LucideProps> = (props) => <Undo2 {...props} />;
export const ArrowUturnRightIcon: React.FC<LucideProps> = (props) => <Redo2 {...props} />;
export const ShareIcon: React.FC<LucideProps> = (props) => <Share2 {...props} />;
export const GithubIcon: React.FC<LucideProps> = (props) => <Github {...props} />;
export const EditIcon: React.FC<LucideProps> = (props) => <FilePenLine {...props} />;
export const CheckCircleIcon: React.FC<LucideProps> = (props) => <CheckCircle2 {...props} />;
export const SettingsIcon: React.FC<LucideProps> = (props) => <Settings {...props} />;
export const MicrophoneIcon: React.FC<LucideProps> = (props) => <Mic {...props} />;
export const XCircleIcon: React.FC<LucideProps> = (props) => <XCircle {...props} />;
export const ThumbsUpIcon: React.FC<LucideProps> = (props) => <ThumbsUp {...props} />;
export const ThumbsDownIcon: React.FC<LucideProps> = (props) => <ThumbsDown {...props} />;


// --- Custom Brand Icons ---

export const GoogleIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className || "w-6 h-6"}>
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.904,36.213,44,30.605,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>
);

export const GeminiIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"}>
        <path d="M4.53 14.283a3.5 3.5 0 0 1 0-4.566L7.518 7.37a.5.5 0 0 1 .753.41v7.44a.5.5 0 0 1-.753.41l-2.988-2.347Z" fill="url(#gemini-a)" />
        <path d="M9.818 20.25a3.5 3.5 0 0 1-1.6-6.419l6.516-5.114a2.5 2.5 0 0 1 3.535 3.535l-5.114 6.516a3.489 3.489 0 0 1-3.337 1.482Z" fill="url(#gemini-b)" />
        <path d="M12 5.25a3.5 3.5 0 0 0-1.6 6.419l6.516 5.114a2.5 2.5 0 0 0 3.535-3.535L15.337 6.732A3.489 3.489 0 0 0 12 5.25Z" fill="#8E8E93" />
        <defs>
            <linearGradient id="gemini-a" x1="4.53" y1="9.717" x2="4.53" y2="14.283" gradientUnits="userSpaceOnUse"><stop stopColor="#4285F4" /><stop offset="1" stopColor="#9B72CB" /></linearGradient>
            <linearGradient id="gemini-b" x1="16.953" y1="18.768" x2="8.218" y2="13.831" gradientUnits="userSpaceOnUse"><stop stopColor="#4285F4" /><stop offset="1" stopColor="#9B72CB" /></linearGradient>
        </defs>
    </svg>
);

export const OpenAIIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"}>
        <path d="M250 42a208 208 0 1 0 0 416 208 208 0 0 0 0-416Z" fill="#10A37F" />
        <path d="M363 218c-3-10-10-17-20-17-7 0-14 4-17 11-13 1-25-10-25-23s12-24 25-24c10 0 18-9 18-18s-8-18-18-18c-23 0-42 19-42 42s19 42 42 42c3 10 10 17 20 17 7 0 14-4 17-11 13-1 25 10 25 23s-12 24-25 24c-10 0-18 8-18 18s8 18 18 18c23 0 42-19 42-42s-19-42-42-42Zm-131 63c-3 10-10 17-20 17-7 0-14-4-17-11-13-1-25 10-25 23s12 24 25 24c10 0 18 8 18 18s-8 18-18 18c-23 0-42-19-42-42s19-42 42-42c3-10 10-17 20-17 7 0 14 4 17 11 13 1 25-10 25-23s-12-24-25-24c-10 0-18-8-18-18s8-18 18-18c23 0 42 19 42 42s-19 42-42 42Z" fill="#fff" />
    </svg>
);

export const ClaudeIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"}>
        <path d="M16.533 21.085c.66-.46 1.282-.99 1.76-1.683.477-.693.8-1.547.8-2.457v-9.89c0-.91-.323-1.764-.8-2.457a4.321 4.321 0 0 0-1.76-1.683c-1.3-.906-2.922-1.415-4.533-1.415-1.61 0-3.233.51-4.533 1.415a4.321 4.321 0 0 0-1.76 1.683c-.477.693-.8 1.547-.8 2.457v9.89c0 .91.323 1.764.8 2.457.477.693 1.1 1.222 1.76 1.683 1.3.906 2.922 1.415 4.533 1.415 1.61 0 3.233-.51 4.533-1.415Z" fill="#D9D9D9" />
    </svg>
);

export const GroqIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.28 14.77l-3.23-3.23c-.1-.1-.15-.22-.15-.35v-1.07c0-.13.05-.25.15-.35l3.23-3.23c.2-.2.51-.2.71 0l1.06 1.06c.2.2.2.51 0 .71L10.3 12l2.18 2.18c.2.2.2.51 0 .71l-1.06 1.06c-.2.2-.51.2-.71 0zM17 14.5c0 .28-.22.5-.5.5h-3c-.28 0-.5-.22-.5-.5v-5c0-.28.22-.5.5-.5h3c.28 0 .5.22.5.5v5z" />
    </svg>
);

export const OpenRouterIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"}>
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm4.636 14.636-2.121-2.121a3 3 0 1 0-4.243-4.243L7.364 7.364a7 7 0 1 1 9.272 9.272Z" fill="#4f46e5"/>
    </svg>
);