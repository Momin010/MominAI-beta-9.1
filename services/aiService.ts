import { FunctionDeclaration, Type, Content } from "@google/genai";
import { FileSystem, AiProvider, SimplifiedGenerateContentResponse } from '../types';
import { supabase } from '../lib/supabaseClient';

// --- API Key Storage ---
const getOpenRouterApiKeys = (): string[] => {
    const keysEnv = (window as any).ENV?.VITE_OPENROUTER_API_KEYS || '';
    return keysEnv.split(',').map((key: string) => key.trim()).filter(Boolean);
};

const openRouterApiKeys = getOpenRouterApiKeys();

let openRouterKeyIndex = 0;

const getApiKey = (provider: AiProvider): string | null => {
    if (provider === 'openrouter') {
        return openRouterApiKeys[openRouterKeyIndex];
    }
    return localStorage.getItem(`${provider}_api_key`);
};

// --- Unified Tool Definitions (Gemini format is the standard) ---
const tools: FunctionDeclaration[] = [
  {
    name: "plan_steps",
    description: "Outline a detailed plan and product requirements for the user's request. This should include core features, component breakdowns, and the file structure. This must be the first tool called for any new app generation or significant feature request.",
    parameters: { type: Type.OBJECT, properties: { steps: { type: Type.ARRAY, description: "An array of strings, where each string is a clear, high-level step to be executed.", items: { type: Type.STRING } } }, required: ["steps"] },
  },
  { name: "list_files", description: "List all files and directories in the current project structure.", parameters: { type: Type.OBJECT, properties: {}, required: [] } },
  { name: "read_file", description: "Read the content of a specific file.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "The full path of the file to read." } }, required: ["path"] } },
  {
    name: "create_or_update_files",
    description: "Create, update, or overwrite multiple files in the project. Use this for batch file operations.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        files: {
          type: Type.OBJECT,
          description: "An object where each key is the full file path (e.g., 'src/App.tsx') and the value is the content of the file."
        }
      },
      required: ["files"]
    }
  },
  { name: "delete_file", description: "Delete a file from the project.", parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "The full path of the file to delete." } }, required: ["path"] } },
  {
    name: "run_build_and_lint",
    description: "Runs the build process (e.g., 'npm run build') and a linter in a simulated environment to check for errors. You MUST call this after making code changes to verify they are correct before finishing the task.",
    parameters: { type: Type.OBJECT, properties: {}, required: [] }
  },
  { name: "finish_task", description: "Call this function when the entire task is complete, verified, and all files have been generated. This signals that the app is ready to be built and previewed.", parameters: { type: Type.OBJECT, properties: { summary: { type: Type.STRING, description: "A brief summary of what was accomplished." } }, required: ["summary"] } },
  { name: "chat", description: "Use this for conversational responses, acting as an AI friend. Use it to plan things together, talk about ideas, or have a fun, fast, and responsive chat that doesn't involve writing or changing code.", parameters: { type: Type.OBJECT, properties: { response: { type: Type.STRING, description: "The conversational response to the user, like a friend." } }, required: ["response"] } },
  {
    name: "search_pexels_for_images",
    description: "Search for a high-quality, royalty-free image from Pexels to use in the web application, for example as a hero background. Returns the image URL and attribution details.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "The search query, e.g., 'sushi', 'minimalist office', 'nature'." },
        orientation: { type: Type.STRING, description: "Optional. Desired photo orientation. Can be 'landscape', 'portrait', or 'square'. Defaults to 'landscape'." }
      },
      required: ["query"]
    }
  }
];

// --- Generic System Instruction ---
const getSystemInstruction = (fileSystem: FileSystem) => {
    const currentFiles = Object.keys(fileSystem).join('\n');
    return `You are MominAI, an expert AI software engineer. Your purpose is to build and modify fully functional, production-ready web applications based on user requests.

---
### Persona & Communication Style

*   **Your Name:** You are MominAI. Do NOT refer to yourself as Gemini, Claude, or any other model name.
*   **Tone:** Be friendly, encouraging, and a bit playful. You're a helpful coding partner, not a robot.
*   **Emojis:** Use emojis to add personality to your responses, especially when using the \`chat\` tool. 🎉🚀💡
*   **Clarity:** Always explain your plans and actions clearly.
---

### Development Philosophy

*   **"Go Overkill" Principle:** Do not just build the bare minimum. Your goal is to create exceptional, feature-rich, "overkill" applications that impress the user. If a user asks for a simple "habit tracker," you should deliver a complete application with features like:
    *   Adding, editing, and deleting habits.
    *   Daily tracking with checkboxes.
    *   Streak calculations (current and longest).
    *   Detailed statistics and visualizations.
    *   A calendar heatmap view for habit history.
    *   Bar charts for weekly/monthly performance.
    *   Use modals for forms and interactions.
*   **Production Quality UI/UX:** Always strive for a polished, professional, and responsive user interface.
    *   **Icons:** You MUST use icons from the \`lucide-react\` library to make the UI intuitive and visually appealing.
    *   **Styling:** Use Tailwind CSS for all styling. Create a clean, modern, and aesthetically pleasing design.
*   **Leverage Available Libraries:** The project is pre-configured with powerful libraries. You should use them:
    *   **\`recharts\`:** For creating beautiful, interactive charts and graphs (bar charts, pie charts, line graphs, etc.).
    *   **\`date-fns\`:** For all date and time manipulation. It is much more robust than the native Date object.
---

### Core Workflow: Plan -> Code -> Verify -> Finish

You must follow this workflow for every request. This is not optional.

**Step 1: Plan**
*   Analyze the user's request.
*   **You MUST start by calling the \`plan_steps\` tool.** Your plan should outline the features, component hierarchy, and file structure. Be detailed.

**Step 2: Code**
*   Execute your plan using the file system tools (\`create_or_update_files\`, \`read_file\`, etc.).
*   Write clean, functional, and modern code.
*   **CRITICAL: Complete Project Scaffolding** - For ANY new project, you MUST create ALL these files:
    *   \`package.json\` - with all required dependencies
    *   \`tsconfig.json\` - complete TypeScript configuration
    *   \`tsconfig.node.json\` - Node-specific TypeScript config
    *   \`vite.config.ts\` - optimized Vite build configuration
    *   \`tailwind.config.js\` - Tailwind CSS configuration
    *   \`postcss.config.js\` - PostCSS configuration
    *   \`index.html\` - proper HTML template
    *   \`src/main.tsx\` - React entry point
    *   \`src/App.tsx\` - main application component
    *   \`src/index.css\` - global styles
*   **Dependency Management:** If you use a new library (e.g., \`react-router-dom\`, \`lucide-react\`, \`recharts\`, \`date-fns\`), you MUST add it to the \`package.json\` file. Failure to do so will cause the build to fail.

**Step 3: Verify (CRITICAL)**
*   After you have written your code, **you MUST call the \`run_build_and_lint\` tool.**
*   This tool simulates the build process and catches errors (syntax errors, missing dependencies, incorrect imports, etc.).
*   **If the tool returns \`success: true\`:** Your code is valid. You can proceed to Step 4.
*   **If the tool returns \`success: false\`:** Your code is broken. You are now in a **Debugging Loop**.

**The Debugging Loop:**
1.  **Analyze the Error:** Carefully read the \`error\` and \`output\` from the \`run_build_and_lint\` result.
2.  **Fix the Code:** Use the file system tools to correct the error. This may involve reading files to get more context, then writing a fix.
3.  **Re-Verify:** Call \`run_build_and_lint\` again.
4.  **Repeat:** Continue this loop until the build succeeds.
*   **DO NOT exit the debugging loop until the build is successful.** Do not ask the user for help. Do not use the \`chat\` tool. Your job is to fix the errors you find.

**Step 4: AUTOMATIC Task Completion**
*   **MANDATORY: Once build verification succeeds, you MUST immediately call \`finish_task\` with a summary.**
*   **NEVER wait for user confirmation like "mark the task as done" or "what do you think"**
*   **NEVER give summaries asking "Here's what I've done..." or similar patterns**
*   **CORRECT PATTERN:** Make changes → Verify with \`run_build_and_lint\` → If success, immediately call \`finish_task\` → Brief confirmation message
*   **The \`finish_task\` call is your responsibility, not the user's**

---
### Other Instructions

*   **Handling User-Reported Errors:** If the user tells you the app is broken, treat it as a failed verification. Enter the Debugging Loop immediately. Analyze the problem, and use your tools to fix it.
*   **Complete Scaffolding Template:** Use this exact template for new React projects:

\`\`\`json
// package.json
{
  "name": "generated-app",
  "version": "1.0.0", 
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17", 
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
\`\`\`

*   **Pexels Image Search:** Use the \`search_pexels_for_images\` tool to find relevant images for websites. **You MUST provide attribution** in the footer.
*   **Chat:** Only use the \`chat\` tool for conversational replies that DO NOT involve changing code.

**Current File System:**
${currentFiles.length > 0 ? currentFiles : 'No files exist yet.'}`;
}


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

const callClaudeApi = async (history: Content[], systemInstruction: string): Promise<SimplifiedGenerateContentResponse> => {
    const apiKey = getApiKey('claude');
    if (!apiKey) throw new Error("Claude API key not found.");

    const claudeHistory = history.map(h => ({
        role: h.role,
        content: h.parts.map(p => {
            if ('text' in p) return { type: 'text', text: p.text };
            if ('inlineData' in p) return { 
                type: 'image', 
                source: { 
                    type: 'base64', 
                    media_type: p.inlineData.mimeType, 
                    data: p.inlineData.data 
                }
            };
            return p; // Should not happen with current setup
        })
    }));

    const response = await fetch('/api/anthropic/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 4096,
            system: systemInstruction,
            messages: claudeHistory,
            tools: tools.map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters
            })),
            tool_choice: { type: 'auto' }
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Claude API request failed');
    }

    const data = await response.json();
    const functionCalls: any[] = [];
    let text = '';

    data.content.forEach((block: any) => {
        if (block.type === 'text') {
            text += block.text;
        } else if (block.type === 'tool_use') {
            functionCalls.push({
                name: block.name,
                args: block.input,
            });
        }
    });

    return { text, functionCalls: functionCalls.length > 0 ? functionCalls : undefined };
};

const callOpenAiApi = async (history: Content[], systemInstruction: string): Promise<SimplifiedGenerateContentResponse> => {
    const apiKey = getApiKey('openai');
    if (!apiKey) throw new Error("OpenAI API key not found.");

    const openAiHistory = history.map(h => {
        const content: any[] = [];
        h.parts.forEach(p => {
            if ('text' in p) content.push({ type: 'text', text: p.text });
            if ('inlineData' in p) content.push({ 
                type: 'image_url', 
                image_url: { 
                    url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
                    detail: 'high'
                }
            });
            if ('functionCall' in p) content.push({ type: 'function_call', function_call: p.functionCall });
            if ('functionResponse' in p) content.push({ type: 'function_response', function_response: p.functionResponse });
        });
        return { role: h.role, content };
    });

    const messages = [
        { role: 'system', content: systemInstruction },
        ...openAiHistory
    ];
    
    const response = await fetch('/api/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: messages,
            tools: tools.map(t => ({ type: 'function', function: t })),
            tool_choice: 'auto'
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'OpenAI API request failed');
    }

    const data = await response.json();
    const message = data.choices[0].message;
    const functionCalls = message.tool_calls?.map((tc: any) => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments)
    }));
    
    return { text: message.content || '', functionCalls };
};

const callGroqApi = async (history: Content[], systemInstruction: string): Promise<SimplifiedGenerateContentResponse> => {
    const apiKey = getApiKey('groq');
    if (!apiKey) throw new Error("Groq API key not found.");

    const groqHistory = history.map(h => ({
        role: h.role,
        content: h.parts.map(p => ('text' in p ? p.text : '')).join(' ')
    }));

    const messages = [
        { role: 'system', content: systemInstruction },
        ...groqHistory
    ];

    const response = await fetch('/api/groq/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'llama3-70b-8192',
            messages: messages,
            tools: tools.map(t => ({ type: 'function', function: t })),
            tool_choice: 'auto',
            temperature: 0.1
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Groq API request failed');
    }

    const data = await response.json();
    const message = data.choices[0].message;
    const functionCalls = message.tool_calls?.map((tc: any) => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments)
    }));

    return { text: message.content || '', functionCalls };
};

const callOpenRouterApi = async (history: Content[], systemInstruction: string): Promise<SimplifiedGenerateContentResponse> => {
    const apiKey = getApiKey('openrouter');
    if (!apiKey) throw new Error("OpenRouter API key not found.");

    openRouterKeyIndex = (openRouterKeyIndex + 1) % openRouterApiKeys.length;

    const openRouterHistory = history.map(h => {
        const content: any[] = [];
        h.parts.forEach(p => {
            if ('text' in p) content.push({ type: 'text', text: p.text });
            if ('inlineData' in p) content.push({ 
                type: 'image_url', 
                image_url: { 
                    url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
                    detail: 'high'
                }
            });
            if ('functionCall' in p) content.push({ type: 'function_call', function_call: p.functionCall });
            if ('functionResponse' in p) content.push({ type: 'function_response', function_response: p.functionResponse });
        });
        return { role: h.role, content };
    });

    const messages = [
        { role: 'system', content: systemInstruction },
        ...openRouterHistory
    ];

    const response = await fetch('/api/openrouter/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://mominai.vercel.app/',
            'X-Title': 'MominAI'
        },
        body: JSON.stringify({
            model: 'anthropic/claude-3.5-sonnet',
            messages: messages,
            tools: tools.map(t => ({ type: 'function', function: t })),
            tool_choice: 'auto',
            temperature: 0.1,
        }),
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'OpenRouter API request failed');
    }

    const data = await response.json();
    const message = data.choices[0].message;
    const functionCalls = message.tool_calls?.map((tc: any) => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments)
    }));

    return { text: message.content || '', functionCalls };
};


export const generateContentWithTools = async (
  provider: AiProvider,
  history: Content[],
  fileSystem: FileSystem
): Promise<SimplifiedGenerateContentResponse> => {
  const systemInstruction = getSystemInstruction(fileSystem);

  switch(provider) {
      case 'gemini':
          return callGeminiApi(history, fileSystem);
      case 'claude':
          return callClaudeApi(history, systemInstruction);
      case 'openai':
          return callOpenAiApi(history, systemInstruction);
      case 'groq':
          return callGroqApi(history, systemInstruction);
      case 'openrouter':
          return callOpenRouterApi(history, systemInstruction);
      default:
          throw new Error(`Unsupported provider: ${provider}`);
  }
};