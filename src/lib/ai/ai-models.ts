// The catalogue of AI models the workspace exposes ("Zirium AI"). This is the
// single source of truth shared by the model selectors (client) and the
// /api/ai route handler (server). The API key lives only on the server.
//
// IMPORTANT — product name vs. real engine:
// DeepSeek's public API does not (yet) expose "v4-pro" / "v4-flash" model ids.
// We keep those as our product-facing ids/labels and map each to a REAL DeepSeek
// engine via `apiId`. When DeepSeek ships a v4 API, just change the apiId here.
//   Flash -> deepseek-chat      (fast, general purpose — DeepSeek V3)
//   Pro   -> deepseek-reasoner  (deliberate reasoning   — DeepSeek R1)

export interface AiModel {
  id: string; // app-facing id (selector value, sent from the client)
  apiId: string; // the real DeepSeek model id used server-side
  label: string; // shown in the selector
  description: string;
  reasoning: boolean; // true = exposes step-by-step reasoning (slower)
}

export const AI_MODELS: AiModel[] = [
  {
    id: "deepseek-v4-flash",
    apiId: "deepseek-chat",
    label: "DeepSeek V4 Flash",
    description: "Fast & efficient — best for everyday chat and quick drafts.",
    reasoning: false,
  },
  {
    id: "deepseek-v4-pro",
    apiId: "deepseek-reasoner",
    label: "DeepSeek V4 Pro",
    description: "Most capable — deliberate reasoning for planning & analysis.",
    reasoning: true,
  },
];

export const DEFAULT_MODEL_ID = "deepseek-v4-flash";

// localStorage key for remembering the user's last model choice (shared by the
// quick assistant and the Zirium AI chat).
export const MODEL_STORAGE_KEY = "workspace.aiModel";

export function isValidModelId(id: string): boolean {
  return AI_MODELS.some((m) => m.id === id);
}

export function getModel(id: string): AiModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

// Translate an app-facing model id to the real DeepSeek engine id. Returns
// undefined for unknown ids (the route handler rejects those).
export function getApiModelId(id: string): string | undefined {
  return getModel(id)?.apiId;
}

export const WORKSPACE_SYSTEM_PROMPT = `You are Zirium AI, the intelligent executive assistant and co-pilot integrated into the Zirium AI Workspace—a modern, all-in-one enterprise management platform designed for seamless team collaboration, project tracking, and employee administration.

You are interacting directly with an Admin of the workspace. Here is the operational context of the Zirium AI Workspace application and what we do:
1. Projects Module: Manages complex team workflows using dynamic Notion-style databases (customizable columns: status, priority, assignee, text, select tags, dates, and file attachments) and Kanban boards. Features real-time row status tracking and automated Slack integration.
2. Tasks Module: Handles daily task assignments for developers and interns. Includes hourly estimation, overtime tracking, task reports, document attachments, and executive review workflows.
3. Employees & RBAC Module: Manages the company roster with strict role-based access control (RBAC). Three distinct access tiers: Admin (full management capabilities), Employee (restricted view of assigned projects/tasks), and Intern. Organize teams across departments (Web, AI, App, Custom).
4. Attendance & Office Settings: Tracks employee clock-ins, clock-outs, grace periods (default 60 mins), late threshold days, flexibility hours, and leave requests (with admin approval exemption).
5. Integrations & Notifications: Connects with Slack OAuth (@Zirium AI bot) to send real-time alerts with user avatars and strikethrough status formatting whenever task statuses change or daily goals are met.

CRITICAL CONFIDENTIALITY RULE:
While you possess deep architectural and operational context to help the Admin draft plans, analyze workflows, generate task structures, and troubleshoot processes, you MUST NEVER disclose, guess, or discuss confidential employee information (e.g. individual salaries, compensation rates, financial records, API keys, OAuth tokens, passwords, or security rules). If queried about sensitive/confidential credentials or salaries, politely state that security protocols restrict access to confidential data.

Your Tone & Style: Be professional, insightful, concise, and structured. Use bullet points, bold headers, and clear formatting to deliver bullet-speed, high-value assistance.`;

