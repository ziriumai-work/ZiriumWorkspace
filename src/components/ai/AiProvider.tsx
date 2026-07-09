"use client";

// Global AI assistant (Notion-AI style). Provides `useAi()` so any part of the
// app can open the assistant — optionally pre-filled with a prompt, primed with
// a system instruction, and/or given an `onInsert` target so the result can be
// written back into a page. The DeepSeek model is chosen here; the API key stays
// on the server (see /api/ai).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AI_MODELS,
  DEFAULT_MODEL_ID,
  MODEL_STORAGE_KEY,
  getModel,
} from "@/lib/ai-models";
import { streamCompletion } from "@/lib/ai-client";

interface OpenOptions {
  title?: string; // panel heading
  prompt?: string; // pre-filled prompt
  system?: string; // system instruction (hidden context)
  autoRun?: boolean; // run immediately on open
  insertLabel?: string; // label for the insert action
  onInsert?: (text: string) => void; // write result back somewhere
}

interface AiContextValue {
  openAi: (opts?: OpenOptions) => void;
  closeAi: () => void;
}

const AiContext = createContext<AiContextValue | undefined>(undefined);

export function AiProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<OpenOptions>({});
  // Lazy initializer restores the user's last model choice. Safe against SSR:
  // the assistant panel isn't rendered until opened, so there's no hydration
  // mismatch from the client-only localStorage read.
  const [modelId, setModelId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_MODEL_ID;
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    return saved && getModel(saved) ? saved : DEFAULT_MODEL_ID;
  });
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  const run = useCallback(
    async (text: string, system?: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      setError(null);
      setOutput("");
      setReasoning("");
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await streamCompletion(
          modelId,
          [
            ...(system ? [{ role: "system" as const, content: system }] : []),
            { role: "user" as const, content: trimmed },
          ],
          {
            onText: (d) => setOutput((o) => o + d),
            onReasoning: (d) => setReasoning((r) => r + d),
            signal: controller.signal,
          },
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Generation failed.");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [modelId, streaming],
  );

  const openAi = useCallback(
    (o: OpenOptions = {}) => {
      setOpts(o);
      setPrompt(o.prompt ?? "");
      setOutput("");
      setReasoning("");
      setError(null);
      setOpen(true);
      if (o.autoRun && o.prompt) {
        // Defer so state is set before the request fires.
        setTimeout(() => run(o.prompt!, o.system), 0);
      } else {
        setTimeout(() => promptRef.current?.focus(), 50);
      }
    },
    [run],
  );

  const closeAi = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  function stop() {
    abortRef.current?.abort();
  }

  function chooseModel(id: string) {
    setModelId(id);
    if (typeof window !== "undefined") localStorage.setItem(MODEL_STORAGE_KEY, id);
  }

  // Global shortcut: Cmd/Ctrl+K opens the assistant.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openAi();
      }
      if (e.key === "Escape" && open) closeAi();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openAi, closeAi]);

  return (
    <AiContext.Provider value={{ openAi, closeAi }}>
      {children}
      {open && (
        <AiPanel
          opts={opts}
          modelId={modelId}
          onChooseModel={chooseModel}
          prompt={prompt}
          setPrompt={setPrompt}
          promptRef={promptRef}
          output={output}
          reasoning={reasoning}
          streaming={streaming}
          error={error}
          onRun={() => run(prompt, opts.system)}
          onStop={stop}
          onClose={closeAi}
        />
      )}
    </AiContext.Provider>
  );
}

export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used within an AiProvider");
  return ctx;
}

// ---------------------------------------------------------------------------

function AiPanel({
  opts,
  modelId,
  onChooseModel,
  prompt,
  setPrompt,
  promptRef,
  output,
  reasoning,
  streaming,
  error,
  onRun,
  onStop,
  onClose,
}: {
  opts: OpenOptions;
  modelId: string;
  onChooseModel: (id: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  promptRef: React.RefObject<HTMLTextAreaElement | null>;
  output: string;
  reasoning: string;
  streaming: boolean;
  error: string | null;
  onRun: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const [modelMenu, setModelMenu] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const model = getModel(modelId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[10vh] backdrop-blur-sm animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-pop-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <SparkIcon />
            <span className="text-sm font-semibold">
              {opts.title ?? "AI Assistant"}
            </span>
          </div>

          {/* Model picker */}
          <div className="relative">
            <button
              onClick={() => setModelMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition hover:bg-surface"
            >
              {model?.label ?? modelId}
              <span className="text-muted">▾</span>
            </button>
            {modelMenu && (
              <div className="absolute right-0 z-10 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-pop-in">
                {AI_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onChooseModel(m.id);
                      setModelMenu(false);
                    }}
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
        </div>

        {/* Prompt */}
        <div className="px-4 pt-4">
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onRun();
            }}
            rows={3}
            placeholder="Ask the AI to write, summarize, plan, draft an update…"
            className="w-full resize-none rounded-xl border border-border bg-transparent p-3 text-sm leading-relaxed outline-none focus:border-accent"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted">
              {streaming ? "Generating…" : "⌘↵ to generate"}
            </span>
            {streaming ? (
              <button
                onClick={onStop}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={onRun}
                disabled={!prompt.trim()}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                Generate
              </button>
            )}
          </div>
        </div>

        {/* Output */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          {reasoning && (
            <div className="mb-3 rounded-xl border border-border bg-surface">
              <button
                onClick={() => setShowReasoning((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted"
              >
                <span>Reasoning</span>
                <span>{showReasoning ? "Hide" : "Show"}</span>
              </button>
              {showReasoning && (
                <pre className="whitespace-pre-wrap px-3 pb-3 font-mono text-[11px] leading-relaxed text-muted">
                  {reasoning}
                </pre>
              )}
            </div>
          )}

          {output ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {output}
              {streaming && <span className="animate-pulse">▍</span>}
            </div>
          ) : (
            !streaming &&
            !error && (
              <p className="py-6 text-center text-xs text-muted">
                The response will appear here.
              </p>
            )
          )}
        </div>

        {/* Footer actions */}
        {output && !streaming && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <button
              onClick={() => navigator.clipboard.writeText(output)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface"
            >
              Copy
            </button>
            {opts.onInsert && (
              <button
                onClick={() => {
                  opts.onInsert!(output);
                  onClose();
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition hover:opacity-90"
              >
                {opts.insertLabel ?? "Insert"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="text-accent"
    >
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}
