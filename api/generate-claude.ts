// api/generate-claude.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// --- Tool Definitions (must match the frontend) ---
const tools = [
    {
      name: "plan_steps",
      description: "Outline a detailed plan and product requirements for the user's request. This should include core features, component breakdowns, and the file structure. This must be the first tool called for any new app generation or significant feature request.",
      input_schema: { 
        type: "object", 
        properties: { 
          steps: { 
            type: "array", 
            description: "An array of strings, where each string is a clear, high-level step to be executed.", 
            items: { type: "string" } 
          } 
        }, 
        required: ["steps"] 
      },
    },
    { 
      name: "list_files", 
      description: "List all files and directories in the current project structure.", 
      input_schema: { type: "object", properties: {}, required: [] } 
    },
    { 
      name: "read_file", 
      description: "Read the content of a specific file.", 
      input_schema: { 
        type: "object", 
        properties: { 
          path: { 
            type: "string", 
            description: "The full path of the file to read." 
          } 
        }, 
        required: ["path"] 
      } 
    },
    {
      name: "create_or_update_files",
      description: "Create, update, or overwrite multiple files in the project. Use this for batch file operations.",
      input_schema: {
        type: "object",
        properties: {
          files: {
            type: "object",
            description: "An object where each key is the full file path (e.g., 'src/App.tsx') and the value is the content of the file."
          }
        },
        required: ["files"]
      }
    },
    { 
      name: "delete_file", 
      description: "Delete a file from the project.", 
      input_schema: { 
        type: "object", 
        properties: { 
          path: { 
            type: "string", 
            description: "The full path of the file to delete." 
          } 
        }, 
        required: ["path"] 
      } 
    },
    {
      name: "run_build_and_lint",
      description: "Runs the build process (e.g., 'npm run build') and a linter in a simulated environment to check for errors. You MUST call this after making code changes to verify they are correct before finishing the task.",
      input_schema: { type: "object", properties: {}, required: [] }
    },
    { 
      name: "finish_task", 
      description: "Call this function when the entire task is complete, verified, and all files have been generated. This signals that the app is ready to be built and previewed.", 
      input_schema: { 
        type: "object", 
        properties: { 
          summary: { 
            type: "string", 
            description: "A brief summary of what was accomplished." 
          } 
        }, 
        required: ["summary"] 
      } 
    },
    { 
      name: "chat", 
      description: "Use this for conversational responses, acting as an AI friend. Use it to plan things together, talk about ideas, or have a fun, fast, and responsive chat that doesn't involve writing or changing code.", 
      input_schema: { 
        type: "object", 
        properties: { 
          response: { 
            type: "string", 
            description: "The conversational response to the user, like a friend." 
          } 
        }, 
        required: ["response"] 
      } 
    },
    {
      name: "search_pexels_for_images",
      description: "Search for a high-quality, royalty-free image from Pexels to use in the web application, for example as a hero background. Returns the image URL and attribution details.",
      input_schema: {
        type: "object",
        properties: {
          query: { 
            type: "string", 
            description: "The search query, e.g., 'sushi', 'minimalist office', 'nature'." 
          },
          orientation: { 
            type: "string", 
            description: "Optional. Desired photo orientation. Can be 'landscape', 'portrait', or 'square'. Defaults to 'landscape'." 
          }
        },
        required: ["query"]
      }
    }
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

### Core Workflow: Plan -> Code -> Self-Correction -> Verify -> Finish

You must follow this workflow for every request. This is not optional. The \`run_build_and_lint\` verification step is slow and expensive, so it is critical that you write correct code and perform a self-correction review *before* running verification to avoid multiple failed builds.

**Step 1: Plan**
*   Analyze the user's request.
*   **You MUST start by calling the \`plan_steps\` tool.** Your plan should outline the features, component hierarchy, and file structure. Be detailed.

**Step 2: Code**
*   Execute your plan using the file system tools (\`create_or_update_files\`, \`read_file\`, etc.).
*   Write clean, functional, and modern code.
*   **Dependency Management:** If you use a new library (e.g., \`react-router-dom\`, \`lucide-react\`, \`recharts\`, \`date-fns\`), you MUST add it to the \`package.json\` file. Failure to do so will cause the build to fail.

**Step 3: Self-Correction (NEW & CRITICAL)**
*   Before you call \`run_build_and_lint\`, you must perform a "pre-flight check" of the code you've written. Think through the changes and ask yourself:
    1.  **Dependency Check:** Have I added *all* new libraries (e.g., \`lucide-react\`, \`recharts\`, \`date-fns\`) to \`package.json\`?
    2.  **Import/Export Check:** Are all my component and library imports correct? Do the file paths match the file list? Have I exported everything that needs to be imported elsewhere?
    3.  **Syntax Check:** Have I looked for common syntax errors like missing brackets (\`}\`), parentheses (\`)\`), commas, or invalid JSX?
    4.  **Props Check:** If I created or modified a component, am I passing all the required props to it everywhere it's used? Do the prop types match?
    5.  **Hooks Check:** Am I following the Rules of Hooks (e.g., not calling them inside loops or conditions)?
*   If you find any issues during this self-correction, **FIX THEM NOW** using the file system tools before proceeding to the next step.

**Step 4: Verify (CRITICAL)**
*   Only after you have completed your self-correction, **you MUST call the \`run_build_and_lint\` tool.**
*   This tool simulates the build process and catches errors (syntax errors, missing dependencies, incorrect imports, etc.).
*   **If the tool returns \`success: true\`:** Your code is valid. You can proceed to Step 5.
*   **If the tool returns \`success: false\`:** Your code is broken. You are now in a **Debugging Loop**.

**The Debugging Loop:**
1.  **Analyze the Error:** Carefully read the \`error\` and \`output\` from the \`run_build_and_lint\` result.
2.  **Fix the Code:** Use the file system tools to correct the error. This may involve reading files to get more context, then writing a fix.
3.  **Re-Verify:** Call \`run_build_and_lint\` again.
4.  **Repeat:** Continue this loop until the build succeeds.
*   **DO NOT exit the debugging loop until the build is successful.** Do not ask the user for help. Do not use the \`chat\` tool. Your job is to fix the errors you find.

**Step 5: Finish**
*   Once your code is verified and the build is successful, call the \`finish_task\` tool with a summary of what you accomplished. This hands the code over to the user.
*   You may call \`chat\` in the same turn as \`finish_task\` to provide a friendly confirmation message.

---
### Other Instructions

*   **Handling User-Reported Errors:** If the user tells you the app is broken, treat it as a failed verification. Enter the Debugging Loop immediately. Analyze the problem, and use your tools to fix it.
*   **React Scaffolding:** For new projects, create a complete Vite + TypeScript + Tailwind CSS setup. This includes \`package.json\`, \`vite.config.ts\`, \`tailwind.config.js\`, \`postcss.config.js\`, \`index.html\`, and the basic \`src\` directory structure.
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

        // 3. Get Claude API key
        const claudeApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
        if (!claudeApiKey) {
            console.error("Claude API key not set in environment");
            return res.status(500).json({ error: 'Server configuration error: Claude API key missing.' });
        }

        // 4. Initialize Claude SDK
        const anthropic = new Anthropic({
            apiKey: claudeApiKey,
        });

        // 5. Convert history to Claude format
        const systemInstruction = getSystemInstruction(fileSystem);
        const claudeHistory = history.map((h: any) => ({
            role: h.role,
            content: h.parts.map((p: any) => {
                if (p.text) return { type: 'text', text: p.text };
                if (p.inlineData) return { 
                    type: 'image', 
                    source: { 
                        type: 'base64', 
                        media_type: p.inlineData.mimeType, 
                        data: p.inlineData.data 
                    }
                };
                return p;
            })
        }));

        // 6. Call Claude API
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 4096,
            system: systemInstruction,
            messages: claudeHistory,
            tools: tools,
            tool_choice: { type: 'auto' }
        });

        // 7. Format response to match Gemini format
        const functionCalls: any[] = [];
        let text = '';

        response.content.forEach((block: any) => {
            if (block.type === 'text') {
                text += block.text;
            } else if (block.type === 'tool_use') {
                functionCalls.push({
                    name: block.name,
                    args: block.input,
                });
            }
        });

        const formattedResponse = {
            candidates: [{
                content: {
                    parts: []
                }
            }]
        };

        if (text) {
            formattedResponse.candidates[0].content.parts.push({ text });
        }

        if (functionCalls.length > 0) {
            functionCalls.forEach(call => {
                formattedResponse.candidates[0].content.parts.push({
                    functionCall: {
                        name: call.name,
                        args: call.args
                    }
                });
            });
        }

        return res.status(200).json(formattedResponse);

    } catch (error) {
        console.error('Error in Claude function:', error);
        const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
        if (!res.headersSent) {
            res.status(500).json({ error: errorMessage });
        } else {
            res.end();
        }
    }
}