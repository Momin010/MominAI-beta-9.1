// api/generate-gemini.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Content, FunctionDeclaration, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// --- Tool Definitions (must match the frontend) ---
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

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
];

const getSystemInstruction = (fileSystem: { [path: string]: string }) => {
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

\`\`\`json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
\`\`\`

\`\`\`json
// tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "postcss.config.js", "tailwind.config.js"]
}
\`\`\`

*   **Pexels Image Search:** Use the \`search_pexels_for_images\` tool to find relevant images for websites. **You MUST provide attribution** in the footer.
*   **Chat:** Only use the \`chat\` tool for conversational replies that DO NOT involve changing code.

**Current File System:**
${currentFiles.length > 0 ? currentFiles : 'No files exist yet.'}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 1. Authenticate user
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Supabase environment variables not set");
            return res.status(500).json({ error: 'Server configuration error.' });
        }
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided.' });
        }
        const token = authHeader.split(' ')[1];
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
        }

        // 2. Get request body
        const { history, fileSystem } = req.body;
        if (!history || !fileSystem) {
            return res.status(400).json({ error: 'Missing history or fileSystem in request body' });
        }
        
        // 3. Get Gemini API key
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            console.error("GEMINI_API_KEY not set in environment");
            return res.status(500).json({ error: 'Server configuration error: AI provider key missing.' });
        }
        
        // 4. Call Gemini API (non-streaming)
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const systemInstruction = getSystemInstruction(fileSystem);
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: history as Content[],
            config: { 
                systemInstruction, 
                tools: [{ functionDeclarations: tools }],
                safetySettings,
            }
        });

        // 5. Send the complete response back to the client
        return res.status(200).json(response);

    } catch (error) {
        console.error('Error in Vercel function:', error);
        const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
        // If headers haven't been sent, we can still send a proper error response
        if (!res.headersSent) {
            res.status(500).json({ error: errorMessage });
        } else {
            // This part is less likely to be reached now but kept for safety.
            res.end();
        }
    }
}