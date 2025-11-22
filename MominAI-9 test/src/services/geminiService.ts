import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { FileNode, ImageData, FlowData, ChatMessage, AnalysisResults, GeminiPhase, AITask } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY is not defined in environment variables");
}

function serializeFileTree(node: FileNode, depth = 0): string {
  let result = '';
  if (node.name !== 'root' && node.children) {
    result += `${'  '.repeat(depth)}- ${node.name}/\n`;
  }
  node.children?.forEach(child => {
    if (child.type === 'folder') {
      result += serializeFileTree(child, depth + 1);
    } else {
      result += `${'  '.repeat(depth + 1)}- ${child.name}\n`;
    }
  });
  return result;
}

const findFileRecursive = (pathParts: string[], children: FileNode[]): FileNode | null => {
    const part = pathParts.shift();
    if (!part) return null;

    const node = children.find(c => c.name === part);
    if (!node) return null;

    if (pathParts.length === 0) { // Can be file or folder
        return node;
    }
    if (node.type === 'folder' && node.children && pathParts.length > 0) {
        return findFileRecursive(pathParts, node.children);
    }
    return null;
};

const getFileContent = (path: string, root: FileNode): string | null => {
    const node = findFileRecursive(path.split('/'), root.children || []);
    if (node && node.type === 'file') {
        return node.content || '';
    }
    return null;
}


const getAllFilePathsRecursive = (children: FileNode[], currentPath: string): string[] => {
    let paths: string[] = [];
    for (const child of children) {
        const newPath = currentPath ? `${currentPath}/${child.name}` : child.name;
        if (child.type === 'file') {
            paths.push(newPath);
        } else if (child.type === 'folder' && child.children) {
            paths = paths.concat(getAllFilePathsRecursive(child.children, newPath));
        }
    }
    return paths;
};

export const serializeRelevantFiles = (root: FileNode, paths: string[]): string => {
    const filePathsToSerialize = paths.includes('*')
        ? getAllFilePathsRecursive(root.children || [], '')
        : paths;

    if (filePathsToSerialize.length === 0) {
        return "";
    }

    let result = '';
    for (const path of filePathsToSerialize) {
        const fileNode = findFileRecursive(path.split('/'), root.children || []);
        if (fileNode && fileNode.type === 'file') {
            result += `// FILE: ${path}\n`;
            result += `${fileNode.content}\n\n`;
        }
    }
    return result.trim();
};


function serializeSmartChatHistory(history: ChatMessage[], condenseAggressively: boolean = false): string {
    if (history.length === 0) return 'No previous conversation.';

    let smartHistory: ChatMessage[] = [];
    let condensationNote = '';

    if (condenseAggressively) {
        condensationNote = '[Context Note: Previous conversation history has been heavily summarized due to length.]\n\n';
        // More aggressive: only keep the very first user message and the last 2 messages.
        if (history.length > 3) {
            const firstUserMessage = history.find(msg => msg.role === 'user');
            const lastTwoMessages = history.slice(-2);
            
            const messageSet = new Set(lastTwoMessages);
            if (firstUserMessage) {
                messageSet.add(firstUserMessage);
            }
            smartHistory = history.filter(msg => messageSet.has(msg));
        } else {
            smartHistory = history;
        }
    } else if (history.length <= 7) {
        smartHistory = history;
    } else {
        // Standard condensation
        const firstUserMessage = history.find(msg => msg.role === 'user');
        const lastSixMessages = history.slice(-6);
        
        const messageSet = new Set(lastSixMessages);
        if (firstUserMessage) {
            messageSet.add(firstUserMessage);
        }
        
        smartHistory = history.filter(msg => messageSet.has(msg));
    }

    const historyString = smartHistory.map(msg => {
        let content = msg.content;
        let prefix = '';
        // Don't include huge action logs in the history, just a summary
        if (msg.actions && msg.actions.length > 5) {
            prefix = `[Assistant took ${msg.actions.length} actions] `;
        }
        if (msg.image) {
            content += " [Image was attached]";
        }
        return `${msg.role}: ${prefix}${content}`;
    }).join('\n');
    
    return condensationNote + historyString;
}

const getFileSelectionPrompt = (prompt: string, fileTree: string) => `
You are a file system analysis AI. Your task is to determine which files from the provided file tree are relevant to the user's request.
Your response MUST be a single JSON object on a single line. Example: {"type": "file_selection", "data": ["frontend/src/App.tsx"]}.

- For specific change requests (e.g., "change the button color"), list ONLY the relevant file paths in the "data" array.
- If the request is a general question, a greeting, or seems unrelated to the existing code, respond with an empty array: {"type": "file_selection", "data": []}.
- If the request is a large, project-wide change, a refactor, or a request to build something new, respond with a wildcard: {"type": "file_selection", "data": ["*"]}.

**File Tree:**
${fileTree}

**User Request:**
"${prompt}"

Respond now with only the single JSON object.
`;

const getPreProcessPrompt = (prompt: string) => `
You are an intelligent request router. Your goal is to analyze the user's request and determine the correct execution path.

Analyze the following user prompt and respond with a single JSON object on a single line.
The JSON object must have this structure: {"type": "routing_decision", "data": {"phase": "chat" | "plan" | "study_only", "topic"?: string}}.

- If the request is primarily to learn, study, or research a topic (e.g., "tell me about Rust", "study Python"), set "phase" to "study_only" and include the "topic".
- If the request is to build a full application, create a multi-file project, or involves significant architecture (e.g., "build a react app with a kanban board"), set "phase" to "plan".
- For all other requests, like simple, single-file scripts, small code snippets, or general questions, set "phase" to "chat".

User Prompt: "${prompt}"

Respond now with only the single JSON object.
`;

const getChatPrompt = (prompt: string, hasImage: boolean, context: { fileTree: string; relevantFiles?: string; chatHistory?: ChatMessage[] }, condenseHistory: boolean) => `
You are an expert-level senior full-stack engineer and AI assistant with web search capabilities, integrated into a web IDE. Your primary expertise is in React/Node.js, but you can learn and work with any technology.

**Your Role:**
- Be a helpful co-pilot. You can chat, answer questions, or perform coding tasks.
- When asked to integrate a new service, library, or API, YOU MUST use your search tool to find its official documentation to ensure your implementation is accurate, secure, and up-to-date.
- For general knowledge questions, use your search tool to provide verified, accurate answers and cite your sources.
- When appropriate, suggest using popular libraries to solve problems instead of writing everything from scratch.

**Current File Structure (for reference):**
${context.fileTree}

**Content of RELEVANT files (including any research you have performed):**
${context.relevantFiles ? context.relevantFiles : "No specific files were identified as relevant for this request."}

**Relevant Conversation History:**
${serializeSmartChatHistory(context.chatHistory || [], condenseHistory)}

**User's Latest Message:**
"${prompt}"
${hasImage ? "\nAn image was provided as a visual reference." : ""}

**Your Response Protocol:**
You MUST respond using only a sequence of JSON objects, one per line. Do NOT add any conversational text or markdown outside of the JSON objects.

1.  **For pure conversation or questions:**
    a. Stream your response using 'message' objects. For a smooth typing effect, send small parts of your response in each object.
       {"type":"message","data":{"role":"assistant","content":"Of course! A 'React "}}
       {"type":"message","data":{"role":"assistant","content":"component' is a..."}}
    b. After all message parts, end with a 'COMPLETE' action.
       {"type":"action","data":{"type":"COMPLETE"}}

2.  **For coding tasks (creating, editing, refactoring):**
    a. Start with a 'THINKING' action.
       {"type":"action","data":{"type":"THINKING"}}
    b. Before writing or editing, you MUST first 'READ' the file to get context.
       {"type":"action","data":{"type":"READ","target":"frontend/src/App.tsx"}}
    c. For EACH file to be modified, emit an action ('WRITE' for new files, 'EDIT' for existing ones). Remember to use full paths like 'frontend/src/App.tsx' or 'backend/server.js'.
       {"type":"action","data":{"type":"WRITE","target":"frontend/src/components/MyNewComponent.tsx"}}
    d. Stream the file's content using one or more 'file-content' objects.
       {"type":"file-content","data":{"path":"frontend/src/components/MyNewComponent.tsx","content":"import React from 'react';"}}
       {"type":"file-content","data":{"path":"frontend/src/components/MyNewComponent.tsx","content":"// ...more content"}}
    e. (Optional) After all file operations, you can provide a summary message by streaming it with 'message' objects.
       {"type":"message","data":{"role":"assistant","content":"I've created the new "}}
       {"type":"message","data":{"role":"assistant","content":"component for you."}}
    f. End with a 'COMPLETE' action. This is your final output for the task.
       {"type":"action","data":{"type":"COMPLETE"}}

Begin your response now.
`;


const getPlanningPrompt = (prompt: string, hasImage: boolean, knowledgeContext: string) => `
You are an expert-level, language-agnostic senior software architect and product manager with web search capabilities.
Your task is to analyze the user's request and create a comprehensive, professional-grade plan for a new application using the specified technology.

**Primary User Request:**
"${prompt}"

**Core Technology Knowledge Base:**
You have been provided with a knowledge base on the primary technology for this project. Use this as your main source of truth for architectural decisions, library recommendations, and file structure.
---
${knowledgeContext || "No specific knowledge base was generated. Rely on your general expertise and web search for the requested technology."}
---

**Architecture Philosophy: Go Beyond the Minimum Viable Product (MVP)**
Your primary goal is to design a high-quality, feature-rich application.
- **Leverage Libraries:** Do NOT reinvent the wheel. Use your search tool to find popular, well-maintained libraries for the specified technology to handle common tasks (e.g., web frameworks, UI components, data handling).
- **Proactively Add Standard Features:** To provide a complete starting point, your plan should include pages for a basic analytics dashboard, user settings, and a mocked login flow, where applicable.

**Your Response Protocol:**
You MUST respond using only a sequence of JSON objects, one per line. Do NOT add any conversational text or markdown outside of the JSON objects. The sequence must be in this exact order:

1.  **Start Planning:** Begin with a 'PLAN_GENERATE' action.
    {"type":"action","data":{"type":"PLAN_GENERATE"}}

2.  **Generate Full PRD:** Create a detailed Product Requirements Document in Markdown format.
    a. Emit a 'WRITE' action for "project-prd.md".
    b. Stream the content of the PRD. The PRD must include sections for Overview, Key Features, User Personas, **Recommended Libraries**, a detailed **Architecture** (including a directory breakdown), **Data Models/Schema**, and a detailed **User Flow**.

3.  **Generate Minified PRD:** Create a summarized version of the PRD for the coding agent.
    a. Emit a 'WRITE' action for "min-prd.md".
    b. Stream the content of the minified PRD. It should be very concise, containing a high-level overview, bulleted list of key features, main user flow, and critical API endpoints if applicable.

4.  **Generate Task List:** Create a JSON array of actionable, high-level tasks for the coding agent.
    a. Use the 'task_list' type.
    b. The data must be an array of objects, each with a string "id" and a string "description". The first task should ALWAYS be to set up dependencies and project structure.

5.  **Generate Flow Diagram Data:** Based on the User Flow, generate a Mermaid.js graph definition string.
    a. Use the 'flow-data' type.
    b. The data MUST be a single string starting with 'graph TD;'.
    c. **ABSOLUTELY CRITICAL MERMAID SYNTAX RULES - FOLLOW EXACTLY:**
       - **No Spaces Around Quotes:** There MUST NOT be any space between a node's shape brackets (e.g., \`[]\`, \`{}\`, \`()\`) and the double quotes for the text.
         - **CORRECT:** \`A["My Text"]\`, \`B{"Decision?"}\`, \`C(("Database"))\`
         - **INCORRECT:** \`A[ "My Text" ]\`, \`B{ "Decision?" }\`
       - **Quoted Text:** ALL text inside nodes must be enclosed in double quotes (\`""\`). This is mandatory.
       - **Semicolons:** EVERY statement (node definition or link) MUST end with a semicolon (\`;\`).
       - **No Invalid Keywords:** The graph definition MUST NOT contain any non-standard keywords like 'end'.

6.  **Completion:** End with a 'COMPLETE' action.

Begin planning now.
`;


const getCodeGenerationPrompt = (prompt: string, fileTree: string, hasImage: boolean, plan: {prd: string, flow: FlowData}) => `
You are an expert-level senior full-stack engineer and autonomous agent.
Your goal is to build a full-stack application based on the provided plan. You will create files in both the \`frontend/\` and \`backend/\` directories (or other directories as specified by the plan).

**Original User Request:**
"${prompt}"
${hasImage ? "\nAn image was provided as a visual reference." : ""}

**Summarized Plan (Mini-PRD):**
---
${plan.prd}
---

**Approved User Flow Diagram (Mermaid Syntax):**
\`\`\`mermaid
${plan.flow}
\`\`\`

**Current File Structure:**
${fileTree}

**Your Response Protocol:**
You MUST respond using only a sequence of JSON objects, one per line. Do NOT add any conversational text or markdown outside of the JSON objects.

1.  **Start Coding:** Begin with a 'PLANNING' action to show you are analyzing the plan.
    {"type":"action","data":{"type":"PLANNING"}}

2.  **EXECUTE TASKS:** For EACH task in the plan, you must follow this sequence:
    a. **Announce Task Start:** Emit a 'TASK_START' action with the task's ID.
       {"type":"action","data":{"type":"TASK_START","target":"1"}}
    b. **Install Dependencies & Generate Code:** If the plan requires new libraries, your FIRST step for the relevant task MUST be to 'EDIT' the dependency file (e.g., \`package.json\`, \`Cargo.toml\`) to add them. After that, perform all necessary 'READ', 'WRITE', and 'EDIT' actions for the current task. Stream their content using 'file-content' objects. Also, update the root \`README.md\` file with instructions on how to install dependencies and run the application.
       {"type":"action","data":{"type":"EDIT","target":"frontend/package.json"}}
       {"type":"file-content","data":{"path":"frontend/package.json","content":"..."}}
       {"type":"action","data":{"type":"WRITE","target":"backend/server.js"}}
       {"type":"file-content","data":{"path":"backend/server.js","content":"const express = require('express');"}}
    c. **Announce Task Completion:** After all code for the task is written, emit a 'TASK_COMPLETE' action with the task's ID.
       {"type":"action","data":{"type":"TASK_COMPLETE","target":"1"}}
    
    *Repeat this start-code-complete sequence for all tasks.*

3.  **FINAL COMPLETION:** Once ALL tasks are complete, send a final 'COMPLETE' action.
    {"type":"action","data":{"type":"COMPLETE"}}

Begin execution now.
`;

const getContinuationPrompt = (
  originalPrompt: string, 
  fileTree: string, 
  plan: { prd: string; flow: FlowData; incompleteTasks: AITask[] }
) => `
You are an expert-level senior full-stack engineer and autonomous agent.
You were in the middle of executing a plan but were interrupted. Your goal is to resume work exactly where you left off.

**Original User Request:**
"${originalPrompt}"

**Summarized Plan (Mini-PRD):**
---
${plan.prd}
---

**Current File Structure:**
${fileTree}

**INCOMPLETE TASKS:**
You MUST complete the following tasks. Do NOT repeat tasks that are not on this list.
---
${plan.incompleteTasks.map(t => `- [ ] Task ID ${t.id}: ${t.description}`).join('\n')}
---

**Your Response Protocol:**
You MUST respond using only a sequence of JSON objects, one per line. Do NOT add any conversational text.
Your response MUST continue from the first incomplete task.

1.  **EXECUTE TASKS:** For EACH incomplete task listed above, you must follow this sequence:
    a. **Announce Task Start:** Emit a 'TASK_START' action with the task's ID.
    b. **Generate Code:** Perform all necessary 'READ', 'WRITE', and 'EDIT' actions for the current task.
    c. **Announce Task Completion:** Emit a 'TASK_COMPLETE' action with the task's ID.
    
    *Repeat this start-code-complete sequence for all incomplete tasks.*

2.  **FINAL COMPLETION:** Once ALL tasks from the provided list are complete, send a final 'COMPLETE' action.

Resume execution now.
`;

const getAnalysisPrompt = (fileTree: string, allFilesContent: string) => `
You are a world-class senior software architect with deep expertise in full-stack development, DevOps, and application security. Your task is to perform a comprehensive production-readiness audit of the provided codebase.

**Current File Structure:**
${fileTree}

**Full Codebase:**
---
${allFilesContent}
---

**Your Analysis Mandate:**
Analyze the codebase against the highest industry standards for production-grade applications. Identify potential bugs, security vulnerabilities, areas for performance or code quality improvement, and suggest new features that would enhance the application.

**Your Response Protocol:**
You MUST respond with a single JSON object on a single line. Do NOT add any conversational text or markdown.
The JSON object must follow this exact structure:
{"type": "analysis_result", "data": {"bugs": [], "improvements": [], "security": [], "features": []}}

- For each finding, create an object: {"category": "Bug" | "Improvement" | "Security" | "Feature", "finding": "Brief description of the issue.", "suggestion": "A concise, actionable instruction for an AI agent to fix or implement this."}
- Be critical and thorough. Look for common pitfalls: missing error handling, hardcoded secrets, inefficient rendering, lack of tests, security headers, etc.
- If the project is very simple, it's okay to have empty arrays. But try to find at least a few meaningful suggestions for improvement.

Example Finding Object:
{"category": "Security", "finding": "The backend does not set any security-related HTTP headers.", "suggestion": "In the backend server file, add the 'helmet' middleware to set important security headers like X-XSS-Protection and Content-Security-Policy."}

Respond now with only the single JSON object.
`;

const getAnalysisSummaryPrompt = (analysisResultsJson: string) => `
You are an AI assistant integrated into an IDE. You have just completed a coding task and then performed an automated code review. The results of the review are provided below in JSON format.
Your task is to present these findings to the user in a clear, concise, and helpful chat message, using Markdown for formatting.

**Code Review Findings (JSON):**
\`\`\`json
${analysisResultsJson}
\`\`\`

**Response Guidelines:**
- Start with a confirmation, like "I've finished the coding and ran an automated code review."
- If there are no findings, state that clearly and positively (e.g., "The code looks solid!").
- If there are findings, summarize them by category (e.g., "I found 2 potential bugs and 3 areas for improvement.").
- List the most critical findings (max 3-4) as a bulleted list. For each finding, briefly state the issue and the suggested fix.
- Keep the tone helpful and collaborative, not critical.
- Do NOT include a "Add to Chat" button or any interactive elements in your response. Just provide the single, coherent message.
`;

const getResearchSummaryPrompt = (knowledgeContext: string, topic: string) => `
You are an AI assistant. You have just completed an in-depth research and synthesis task on the topic of "${topic}".
The full result of your research is provided below.

**Your Task:**
Based *only* on the provided research content, write a concise summary for the user.
- Start by saying you've completed the research.
- Provide a 2-3 paragraph summary of the key aspects of "${topic}".
- If the research content includes source URLs, list them at the end under a "Sources" heading.

**Full Research Content:**
---
${knowledgeContext}
---

Respond now with the summary in Markdown format.
`;

export async function* geminiService(
    phase: GeminiPhase,
    prompt: string, 
    image: ImageData | null, 
    files: FileNode, 
    modelName: 'gemini-2.5-pro' | 'gemini-2.5-flash',
    plan?: {prd: string, flow: FlowData, incompleteTasks?: AITask[]},
    chatHistory: ChatMessage[] = [],
    relevantFilesContext?: string,
    forceResearch: boolean = false,
    topicForSummary?: string
): AsyncGenerator<{type: string, data: any}, void, unknown> {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    if (phase === 'pre_process') {
        const executionPrompt = getPreProcessPrompt(prompt);
        try {
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: executionPrompt }] },
            });
            const jsonResponse = JSON.parse(result.text.trim());
            yield jsonResponse;
        } catch (e) {
            console.error("Failed to parse pre_process response:", e);
            // Default to 'chat' for safety
            yield { type: 'routing_decision', data: { phase: 'chat' } };
        }
        return;
    }

    if (phase === 'analyze_project') {
      const fileTreeString = serializeFileTree(files);
      const allFilesContent = serializeRelevantFiles(files, ['*']);
      const executionPrompt = getAnalysisPrompt(fileTreeString, allFilesContent);

      try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [{ text: executionPrompt }] },
        });

        const jsonResponse = JSON.parse(result.text.trim());
        yield jsonResponse;
      } catch (e) {
        console.error("Failed to parse analysis response:", e);
        yield { type: 'analysis_result', data: { bugs: [], improvements: [{category: 'Improvement', finding: 'Analysis Error', suggestion: 'The analysis scan failed to produce a valid result.'}], security: [], features: [] } };
      }
      return;
    }

    if (phase === 'summarize_analysis') {
        const executionPrompt = getAnalysisSummaryPrompt(prompt); // Here, prompt is the JSON result
        const streamResult = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: executionPrompt }] },
        });

        for await (const chunk of streamResult) {
            if (chunk.text) {
              yield { type: 'message', data: { role: 'assistant', content: chunk.text } };
            }
            if (chunk.usageMetadata) {
                yield { type: 'usage_metadata', data: chunk.usageMetadata };
            }
        }
        yield { type: 'action', data: { type: 'COMPLETE' } };
        return;
    }

    if (phase === 'summarize_research') {
        const executionPrompt = getResearchSummaryPrompt(relevantFilesContext || '', topicForSummary || 'the requested topic');
        const streamResult = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: executionPrompt }] },
        });
        for await (const chunk of streamResult) {
            if (chunk.text) {
              yield { type: 'message', data: { role: 'assistant', content: chunk.text } };
            }
            if (chunk.usageMetadata) {
                yield { type: 'usage_metadata', data: chunk.usageMetadata };
            }
        }
        yield { type: 'action', data: { type: 'COMPLETE' } };
        return;
    }

    if (phase === 'select_files') {
      const fileTreeString = serializeFileTree(files);
      const executionPrompt = getFileSelectionPrompt(prompt, fileTreeString);
      const contents: any = { parts: [{ text: executionPrompt }] };
      if(image) {
          contents.parts.unshift({
              inlineData: {
                  mimeType: image.mimeType,
                  data: image.base64,
              }
          });
      }
      
      try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
        });

        const jsonResponse = JSON.parse(result.text.trim());
        yield jsonResponse;
      } catch (e) {
        console.error("Failed to parse file selection response:", e);
        yield { type: 'file_selection', data: ['*'] };
      }
      return;
    }
    
    if (phase === 'research_and_synthesize') {
        // 1. Extract Topic
        const topicExtractionPrompt = `Extract the primary programming language, framework, or technology from the following user request. Respond with a single, concise name (e.g., "React", "Rust", "C++"). If none is found, respond with "N/A". Request: "${prompt}"`;
        const topicResult = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: topicExtractionPrompt });
        const topic = topicResult.text.trim();

        if (topic !== 'N/A' && topic.length > 1) {
            // 2. Check for existing knowledge file
            const knowledgeFileName = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const knowledgeFilePath = `knowledge-base/${knowledgeFileName}.md`;
            const existingKnowledge = getFileContent(knowledgeFilePath, files);

            if (existingKnowledge && !forceResearch) {
                yield { type: 'knowledge_context', data: `// FILE: ${knowledgeFilePath}\n${existingKnowledge}\n` };
                return;
            }

            // 3. Confidence Check
            const confidencePrompt = `On a scale of 1-10, how confident are you in providing expert-level, production-grade code and assistance for the topic "${topic}"? Respond with a single JSON object: {"confidence": N}`;
            const confidenceResult = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: confidencePrompt });
            let confidence = 10;
            try {
                confidence = JSON.parse(confidenceResult.text).confidence;
            } catch { /* ignore parsing errors, default to confident */ }
            
            if (confidence <= 6 || forceResearch) {
                const reason = forceResearch ? `User explicitly requested to study ${topic}.` : `My knowledge on ${topic} is limited.`
                yield { type: 'action', data: { type: 'RESEARCH', target: `${reason} Initiating deep research protocol...` } };

                const searchQueriesPrompt = `Generate 5 diverse and comprehensive Google search queries to learn everything about the "${topic}" programming language, from setup and syntax to advanced concepts and common libraries. Respond with a JSON array of strings.`;
                const searchQueriesResult = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: searchQueriesPrompt });
                let searchQueries: string[] = [];
                try {
                    searchQueries = JSON.parse(searchQueriesResult.text);
                } catch { 
                    searchQueries = [`${topic} programming language tutorial`, `${topic} official documentation`, `getting started with ${topic}`];
                }

                let researchData = '';
                for (const query of searchQueries) {
                     yield { type: 'action', data: { type: 'SEARCH', target: query } };
                     const searchResult = await ai.models.generateContent({
                         model: 'gemini-2.5-flash',
                         contents: query,
                         config: { tools: [{ googleSearch: {} }] }
                     });
                     researchData += `\n\n--- Search Results for "${query}" ---\n`;
                     researchData += searchResult.text;
                     const groundingChunks = searchResult.candidates?.[0]?.groundingMetadata?.groundingChunks;
                     if (groundingChunks) {
                        for (const chunk of groundingChunks) {
                            if (chunk.web) researchData += `\nSource: ${chunk.web.title} (${chunk.web.uri})`;
                        }
                     }
                }

                yield { type: 'action', data: { type: 'THINKING', target: `Synthesizing research on ${topic}...` } };
                const synthesisPrompt = `You are a world-class technical author. Your task is to synthesize the following raw research data into a single, comprehensive, well-structured Markdown document about "${topic}". The document must be at least 1500 lines long, covering introduction, philosophy, environment setup, core syntax, advanced concepts (like memory management, concurrency), standard libraries, common tools, and practical code examples. Structure it with clear headings and subheadings. \n\n**RAW DATA:**\n${researchData}`;
                const synthesisStream = await ai.models.generateContentStream({
                    model: 'gemini-2.5-pro',
                    contents: synthesisPrompt,
                });

                yield { type: 'action', data: { type: 'WRITE', target: knowledgeFilePath } };
                let newKnowledgeContent = '';
                for await (const chunk of synthesisStream) {
                    if (chunk.text) {
                        yield { type: 'file-content', data: { path: knowledgeFilePath, content: chunk.text } };
                        newKnowledgeContent += chunk.text;
                    }
                }
                yield { type: 'knowledge_context', data: `// FILE: ${knowledgeFilePath}\n${newKnowledgeContent}\n` };
            } else {
                 yield { type: 'knowledge_context', data: '' };
            }
        } else {
             yield { type: 'knowledge_context', data: '' };
        }
        return;
    }

    const fileTreeString = serializeFileTree(files);
    const baseConfig: any = {};

    if (phase === 'plan' || phase === 'chat') {
        baseConfig.tools = [{googleSearch: {}}];
    }
    
    if (modelName === 'gemini-2.5-pro') {
      if (!baseConfig.tools) {
        baseConfig.thinkingConfig = { thinkingBudget: 32768 };
      }
    }
    
    let executionPrompt: string;
    if (phase === 'plan') {
        executionPrompt = getPlanningPrompt(prompt, image !== null, relevantFilesContext || '');
    } else if (phase === 'code') {
        if (!plan) throw new Error("Coding phase requires a plan.");
        executionPrompt = getCodeGenerationPrompt(prompt, fileTreeString, image !== null, plan);
    } else if (phase === 'continue_code') {
        if (!plan || !plan.incompleteTasks) throw new Error("Continuation phase requires a plan with incomplete tasks.");
        executionPrompt = getContinuationPrompt(prompt, fileTreeString, plan as { prd: string; flow: FlowData; incompleteTasks: AITask[] });
    } else { // phase === 'chat'
        let shouldCondenseAggressively = false;
        if (chatHistory.length > 1) {
            const lastAssistantMessage = chatHistory[chatHistory.length - 2];
            if (lastAssistantMessage?.role === 'assistant') {
                const lastTokenCount = lastAssistantMessage.usageMetadata?.totalTokenCount ?? 0;
                if (lastTokenCount > 25000) {
                    shouldCondenseAggressively = true;
                }
            }
        }
        
        const context = {
            fileTree: fileTreeString,
            relevantFiles: relevantFilesContext,
            chatHistory: chatHistory,
        };
        executionPrompt = getChatPrompt(prompt, image !== null, context, shouldCondenseAggressively);
    }
    
    const contents: any = { parts: [] as any[] };
    if(image) {
        contents.parts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: image.base64,
            }
        });
    }
    contents.parts.push({ text: executionPrompt });


    const streamResult = await ai.models.generateContentStream({
        model: modelName,
        contents: contents,
        config: baseConfig,
    });
    
    let buffer = '';
    const allSources = new Map<string, { uri: string; title: string }>();
    let sourcesYielded = false;
    let searchActionYielded = false;
    let lastUsageMetadata: any = null;

    for await (const chunk of streamResult) {
        if (chunk.usageMetadata) {
            lastUsageMetadata = chunk.usageMetadata;
        }

        buffer += chunk.text;
        
        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            if (!searchActionYielded) {
                yield { type: 'action', data: { type: 'SEARCH', target: 'Finding up-to-date information...' } };
                searchActionYielded = true;
            }

            for (const groundingChunk of groundingChunks) {
                if (groundingChunk.web) {
                    allSources.set(groundingChunk.web.uri, {
                        uri: groundingChunk.web.uri,
                        title: groundingChunk.web.title || groundingChunk.web.uri,
                    });
                }
            }
        }
        
        if (allSources.size > 0 && !sourcesYielded) {
             yield { type: 'search_sources', data: Array.from(allSources.values()) };
             sourcesYielded = true;
        }

        let eolIndex;
        while ((eolIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, eolIndex).trim();
            buffer = buffer.slice(eolIndex + 1);
            if (line) {
                try {
                    yield JSON.parse(line);
                } catch (e) {
                    console.warn('Failed to parse JSON line:', line, e);
                }
            }
        }
    }
    if (buffer.trim()) {
        try {
            yield JSON.parse(buffer.trim());
        } catch (e) {
            console.warn('Failed to parse final JSON:', buffer.trim(), e);
        }
    }

    if (lastUsageMetadata) {
        yield { type: 'usage_metadata', data: lastUsageMetadata };
    }
}