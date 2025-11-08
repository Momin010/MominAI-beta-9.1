import { FunctionDeclaration, Type, Content } from "@google/genai";
import { FileSystem, AiProvider, SimplifiedGenerateContentResponse } from '../types';
import { supabase } from '../lib/supabaseClient';

// --- API Key Storage (for fallback only) ---
const openRouterApiKeys = [
    "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",
    "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",
].map(key => key.trim()).filter(Boolean);

let openRouterKeyIndex = 0;

const getApiKey = (provider: AiProvider): string | null => {
    if (provider === 'openrouter') {
        return openRouterApiKeys[openRouterKeyIndex];
    }
    return localStorage.getItem(`${provider}_api_key`);
};

// --- Unified Native API Proxy Functions ---
// All providers now use the same authentication and session management as Gemini

const callGeminiApi = async (history: Content[], fileSystem: FileSystem): Promise<SimplifiedGenerateContentResponse> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
        throw new Error("User not authenticated.");
    }
    const token = data.session.access_token;
  
    const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history, fileSystem }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch from Gemini API proxy');
    }
    
    const responseData = await response.json();
    
    const candidates = responseData.candidates;
    let text = '';
    let functionCalls: ({ name: string; args: any; })[] | undefined = undefined;

    if (candidates && candidates.length > 0) {
        const firstCandidate = candidates[0];
        if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
            const calls = firstCandidate.content.parts
                .filter((part: any) => part.functionCall)
                .map((part: any) => ({
                    name: part.functionCall.name,
                    args: part.functionCall.args,
                }));
            
            if (calls.length > 0) {
                functionCalls = calls;
            }

            text = firstCandidate.content.parts
                .filter((part: any) => part.text)
                .map((part: any) => part.text)
                .join('');
        }
    }

    return {
        text: text,
        functionCalls: functionCalls
    };
};

const callClaudeApi = async (history: Content[], fileSystem: FileSystem): Promise<SimplifiedGenerateContentResponse> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
        throw new Error("User not authenticated.");
    }
    const token = data.session.access_token;
  
    const response = await fetch('/api/generate-claude', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history, fileSystem }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch from Claude API proxy');
    }
    
    const responseData = await response.json();
    
    const candidates = responseData.candidates;
    let text = '';
    let functionCalls: ({ name: string; args: any; })[] | undefined = undefined;

    if (candidates && candidates.length > 0) {
        const firstCandidate = candidates[0];
        if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
            const calls = firstCandidate.content.parts
                .filter((part: any) => part.functionCall)
                .map((part: any) => ({
                    name: part.functionCall.name,
                    args: part.functionCall.args,
                }));
            
            if (calls.length > 0) {
                functionCalls = calls;
            }

            text = firstCandidate.content.parts
                .filter((part: any) => part.text)
                .map((part: any) => part.text)
                .join('');
        }
    }

    return {
        text: text,
        functionCalls: functionCalls
    };
};

const callOpenAiApi = async (history: Content[], fileSystem: FileSystem): Promise<SimplifiedGenerateContentResponse> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
        throw new Error("User not authenticated.");
    }
    const token = data.session.access_token;
  
    const response = await fetch('/api/generate-openai', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history, fileSystem }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch from OpenAI API proxy');
    }
    
    const responseData = await response.json();
    
    const candidates = responseData.candidates;
    let text = '';
    let functionCalls: ({ name: string; args: any; })[] | undefined = undefined;

    if (candidates && candidates.length > 0) {
        const firstCandidate = candidates[0];
        if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
            const calls = firstCandidate.content.parts
                .filter((part: any) => part.functionCall)
                .map((part: any) => ({
                    name: part.functionCall.name,
                    args: part.functionCall.args,
                }));
            
            if (calls.length > 0) {
                functionCalls = calls;
            }

            text = firstCandidate.content.parts
                .filter((part: any) => part.text)
                .map((part: any) => part.text)
                .join('');
        }
    }

    return {
        text: text,
        functionCalls: functionCalls
    };
};

const callGroqApi = async (history: Content[], fileSystem: FileSystem): Promise<SimplifiedGenerateContentResponse> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
        throw new Error("User not authenticated.");
    }
    const token = data.session.access_token;
  
    const response = await fetch('/api/generate-groq', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history, fileSystem }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch from Groq API proxy');
    }
    
    const responseData = await response.json();
    
    const candidates = responseData.candidates;
    let text = '';
    let functionCalls: ({ name: string; args: any; })[] | undefined = undefined;

    if (candidates && candidates.length > 0) {
        const firstCandidate = candidates[0];
        if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
            const calls = firstCandidate.content.parts
                .filter((part: any) => part.functionCall)
                .map((part: any) => ({
                    name: part.functionCall.name,
                    args: part.functionCall.args,
                }));
            
            if (calls.length > 0) {
                functionCalls = calls;
            }

            text = firstCandidate.content.parts
                .filter((part: any) => part.text)
                .map((part: any) => part.text)
                .join('');
        }
    }

    return {
        text: text,
        functionCalls: functionCalls
    };
};

const callOpenRouterApi = async (history: Content[], fileSystem: FileSystem): Promise<SimplifiedGenerateContentResponse> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
        throw new Error("User not authenticated.");
    }
    const token = data.session.access_token;
  
    const response = await fetch('/api/generate-openrouter', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history, fileSystem }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch from OpenRouter API proxy');
    }
    
    const responseData = await response.json();
    
    const candidates = responseData.candidates;
    let text = '';
    let functionCalls: ({ name: string; args: any; })[] | undefined = undefined;

    if (candidates && candidates.length > 0) {
        const firstCandidate = candidates[0];
        if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
            const calls = firstCandidate.content.parts
                .filter((part: any) => part.functionCall)
                .map((part: any) => ({
                    name: part.functionCall.name,
                    args: part.functionCall.args,
                }));
            
            if (calls.length > 0) {
                functionCalls = calls;
            }

            text = firstCandidate.content.parts
                .filter((part: any) => part.text)
                .map((part: any) => part.text)
                .join('');
        }
    }

    return {
        text: text,
        functionCalls: functionCalls
    };
};

export const generateContentWithTools = async (
  provider: AiProvider,
  history: Content[],
  fileSystem: FileSystem
): Promise<SimplifiedGenerateContentResponse> => {
  switch(provider) {
      case 'gemini':
          return callGeminiApi(history, fileSystem);
      case 'claude':
          return callClaudeApi(history, fileSystem);
      case 'openai':
          return callOpenAiApi(history, fileSystem);
      case 'groq':
          return callGroqApi(history, fileSystem);
      case 'openrouter':
          return callOpenRouterApi(history, fileSystem);
      default:
          throw new Error(`Unsupported provider: ${provider}`);
  }
};