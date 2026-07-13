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
