"use client";

// Zirium AI — a full chat experience (like ChatGPT / Claude). Multi-turn
// conversation, model switching, streaming responses, and (for the Pro model)
// collapsible reasoning. Powered by DeepSeek via /api/ai; the key stays server
// side. Conversations live in component state for now (Phase: persist to
// Firestore later so chats sync across devices).

import { useEffect, useRef, useState } from "react";
import {
  AI_MODELS,
  DEFAULT_MODEL_ID,
  MODEL_STORAGE_KEY,
  getModel,
} from "@/lib/ai-models";
import { streamCompletion, type ChatMessage } from "@/lib/ai-client";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
}

const SYSTEM_PROMPT =
  "You are Zirium AI, the in-house assistant for a company workspace. Be " +
  "helpful, accurate, and professional. Use clear formatting with short " +
  "paragraphs or bullet points where it helps.";

const SUGGESTIONS = [
  "Draft a project kickoff plan for a new feature",
  "Summarize the key risks of a tight deadline",
  "Write a weekly status update from these notes:",
  "Brainstorm names for an internal tool",
];

export default function ZiriumPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  // Restore the last model choice (shared with the quick assistant). Lazy init
  // is safe: this page only mounts client-side, after the auth guard resolves.
  const [modelId, setModelId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_MODEL_ID;
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    return saved && getModel(saved) ? saved : DEFAULT_MODEL_ID;
  });
  const [modelMenu, setModelMenu] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the latest message as tokens stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function chooseModel(id: string) {
    setModelId(id);
    localStorage.setItem(MODEL_STORAGE_KEY, id);
    setModelMenu(false);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };

    // History sent to the model: prior turns + this new user message.
    const history: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: trimmed },
    ];

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const patch = (fn: (m: ChatMsg) => ChatMsg) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? fn(m) : m)),
      );

    try {
      await streamCompletion(modelId, history, {
        onText: (d) => patch((m) => ({ ...m, content: m.content + d })),
        onReasoning: (d) =>
          patch((m) => ({ ...m, reasoning: (m.reasoning ?? "") + d })),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Generation failed.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setInput("");
  }

  const model = getModel(modelId);
  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Sub-header: model picker + new chat */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <SparkIcon />
          <span className="text-sm font-semibold">Zirium AI</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setModelMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-surface"
            >
              {model?.label ?? modelId}
              <span className="text-muted">▾</span>
            </button>
            {modelMenu && (
              <div className="absolute right-0 z-10 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-pop-in">
                {AI_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => chooseModel(m.id)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition hover:bg-surface ${
                      m.id === modelId ? "bg-accent-soft" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {m.label}
                      {m.reasoning && (
                        <span className="rounded bg-accent-soft px-1 py-0.5 text-[10px] text-accent">
                          reasoning
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted">{m.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={newChat}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface"
          >
            New chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
              <SparkIcon large />
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">
              How can I help?
            </h2>
            <p className="mt-1 text-sm text-muted">
              Ask anything, or start with one of these.
            </p>
            <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-border p-3 text-left text-sm text-muted transition hover:border-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-6 py-6">
            {messages.map((m) => (
              <Message key={m.id} msg={m} streaming={streaming} />
            ))}
            {error && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-accent">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={`Message ${model?.label ?? "Zirium AI"}…`}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            {streaming ? (
              <button
                onClick={() => abortRef.current?.abort()}
                className="rounded-xl border border-border px-3 py-2 text-xs font-medium transition hover:bg-surface"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-40"
              >
                Send
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted">
            Enter to send · Shift+Enter for a new line · {model?.label}
          </p>
        </div>
      </div>
    </div>
  );
}

function Message({ msg, streaming }: { msg: ChatMsg; streaming: boolean }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="mb-5 flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-accent-soft px-4 py-2.5 text-sm leading-relaxed text-foreground">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <SparkIcon className="text-accent-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        {msg.reasoning && (
          <div className="mb-2 rounded-xl border border-border bg-surface">
            <button
              onClick={() => setShowReasoning((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted"
            >
              <span>Reasoning</span>
              <span>{showReasoning ? "Hide" : "Show"}</span>
            </button>
            {showReasoning && (
              <pre className="whitespace-pre-wrap px-3 pb-3 font-mono text-[11px] leading-relaxed text-muted">
                {msg.reasoning}
              </pre>
            )}
          </div>
        )}
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {msg.content || (
            <span className="text-muted">Thinking…</span>
          )}
          {streaming && msg.content && (
            <span className="ml-0.5 animate-pulse">▍</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SparkIcon({
  large,
  className = "text-accent",
}: {
  large?: boolean;
  className?: string;
}) {
  const s = large ? 22 : 15;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}
