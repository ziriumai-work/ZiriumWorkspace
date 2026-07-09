// Client helper for talking to /api/ai. Consumes the line-delimited JSON stream
// and invokes callbacks as reasoning / answer tokens arrive.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamCallbacks {
  onText?: (delta: string) => void; // answer tokens
  onReasoning?: (delta: string) => void; // R1 thinking tokens
  signal?: AbortSignal; // to cancel mid-stream
}

// Streams a completion. Resolves with the full answer text once complete.
// Throws on transport / provider errors.
export async function streamCompletion(
  model: string,
  messages: ChatMessage[],
  { onText, onReasoning, signal }: StreamCallbacks = {},
): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status}).`;
    try {
      const err = await res.json();
      if (err?.error) message = err.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let evt: { type: string; text?: string; message?: string };
      try {
        evt = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (evt.type === "text" && evt.text) {
        answer += evt.text;
        onText?.(evt.text);
      } else if (evt.type === "reasoning" && evt.text) {
        onReasoning?.(evt.text);
      } else if (evt.type === "error") {
        throw new Error(evt.message ?? "AI stream error.");
      }
    }
  }

  return answer;
}
