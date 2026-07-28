// POST /api/ai — Authenticated server-side streaming proxy to DeepSeek API.
// Uses Google Identity Toolkit REST API for token verification (no firebase-admin dependency).

import { getApiModelId } from "@/lib/ai/ai-models";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function jsonLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

async function verifyFirebaseToken(idToken: string): Promise<boolean> {
  const fbApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!fbApiKey) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fbApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.users) && data.users.length > 0;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const validToken = await verifyFirebaseToken(idToken);
    if (!validToken) {
      return Response.json({ error: "Invalid or expired authentication token." }, { status: 401 });
    }

    const apiKey = (process.env.DEEPSEEK_API_KEY || "").trim();
    if (!apiKey) {
      return Response.json(
        { error: "DEEPSEEK_API_KEY is not configured on the server." },
        { status: 500 },
      );
    }

    let body: { model?: string; messages?: ChatMessage[]; temperature?: number };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const model = body.model ?? "";
    const messages = body.messages ?? [];
    const apiModel = getApiModelId(model);
    if (!apiModel) {
      return Response.json({ error: "Unknown model." }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages is required." }, { status: 400 });
    }

    let upstream: Response;
    try {
      upstream = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: apiModel,
          messages,
          temperature: body.temperature ?? 0.7,
          stream: true,
        }),
      });
    } catch {
      return Response.json({ error: "Could not reach the AI provider." }, { status: 502 });
    }

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return Response.json(
        { error: `AI provider error (${upstream.status}). ${detail}`.trim() },
        { status: 502 },
      );
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        let buffer = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";

            for (const evt of events) {
              const line = evt.split("\n").find((l) => l.startsWith("data:"));
              if (!line) continue;
              const data = line.slice(5).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta ?? {};
                if (delta.reasoning_content) {
                  controller.enqueue(
                    jsonLine({ type: "reasoning", text: delta.reasoning_content }),
                  );
                }
                if (delta.content) {
                  controller.enqueue(jsonLine({ type: "text", text: delta.content }));
                }
              } catch {
                // Ignore keep-alive / non-JSON lines.
              }
            }
          }
        } catch (err) {
          controller.enqueue(
            jsonLine({
              type: "error",
              message: err instanceof Error ? err.message : "Stream interrupted.",
            }),
          );
        } finally {
          controller.close();
        }
      },
      cancel() {
        reader.cancel().catch(() => {});
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Unhandled error in /api/ai route:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
