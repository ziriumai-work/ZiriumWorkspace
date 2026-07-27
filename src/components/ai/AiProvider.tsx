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
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  AI_MODELS,
  DEFAULT_MODEL_ID,
  MODEL_STORAGE_KEY,
  getModel,
  WORKSPACE_SYSTEM_PROMPT,
} from "@/lib/ai/ai-models";
import { streamCompletion } from "@/lib/ai/ai-client";
import { useAuth } from "@/lib/firebase/auth-context";

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
  // AI is admin-only (role matrix): the assistant simply won't open for
  // anyone else, no matter which trigger fires.
  const { isAdmin } = useAuth();
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
      const sys = system || WORKSPACE_SYSTEM_PROMPT;
      try {
        await streamCompletion(
          modelId,
          [
            ...(sys ? [{ role: "system" as const, content: sys }] : []),
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
      if (!isAdmin) return;
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
    [run, isAdmin],
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
  const [modelAnchor, setModelAnchor] = useState<HTMLElement | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const model = getModel(modelId);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: { sx: { backdropFilter: "blur(4px)" } },
        paper: {
          sx: {
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            mt: "10vh",
            alignSelf: "flex-start",
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
          px: 2,
          py: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <img src="/logo.png" alt="Zirium AI" style={{ width: 20, height: 20, borderRadius: 4 }} />
          <Typography variant="subtitle2">
            {opts.title ?? "AI Assistant"}
          </Typography>
        </Box>

        {/* Model picker */}
        <Button
          onClick={(e) => setModelAnchor(e.currentTarget)}
          variant="outlined"
          color="inherit"
          endIcon={<ExpandMoreIcon sx={{ fontSize: 14 }} />}
          sx={{ borderColor: "divider", fontSize: 12 }}
        >
          {model?.label ?? modelId}
        </Button>
        <Menu
          anchorEl={modelAnchor}
          open={Boolean(modelAnchor)}
          onClose={() => setModelAnchor(null)}
        >
          {AI_MODELS.map((m) => (
            <MenuItem
              key={m.id}
              selected={m.id === modelId}
              onClick={() => {
                onChooseModel(m.id);
                setModelAnchor(null);
              }}
              sx={{ display: "block", maxWidth: 300 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {m.label}
                </Typography>
                {m.reasoning && (
                  <Chip
                    label="reasoning"
                    sx={{
                      height: 18,
                      fontSize: 10,
                      bgcolor: "accentSoft",
                      color: "primary.main",
                    }}
                  />
                )}
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", whiteSpace: "normal" }}
              >
                {m.description}
              </Typography>
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {/* Prompt */}
      <Box sx={{ px: 2, pt: 2 }}>
        <TextField
          inputRef={promptRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onRun();
          }}
          multiline
          minRows={3}
          placeholder="Ask the AI to write, summarize, plan, draft an update…"
          fullWidth
        />
        <Box
          sx={{
            mt: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
            {streaming ? "Generating…" : "⌘↵ to generate"}
          </Typography>
          {streaming ? (
            <Button
              onClick={onStop}
              variant="outlined"
              color="inherit"
              sx={{ borderColor: "divider", fontSize: 12 }}
            >
              Stop
            </Button>
          ) : (
            <Button
              onClick={onRun}
              disabled={!prompt.trim()}
              variant="contained"
              sx={{ px: 2.5, fontSize: 12 }}
            >
              Generate
            </Button>
          )}
        </Box>
      </Box>

      {/* Output */}
      <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", px: 2, pb: 1, pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {reasoning && (
          <Paper variant="outlined" sx={{ mb: 1.5, borderRadius: 3, bgcolor: "surface" }}>
            <Button
              onClick={() => setShowReasoning((v) => !v)}
              fullWidth
              color="inherit"
              sx={{
                justifyContent: "space-between",
                px: 1.5,
                py: 1,
                fontSize: 12,
                color: "text.secondary",
                fontWeight: 500,
              }}
            >
              <span>Reasoning</span>
              <span>{showReasoning ? "Hide" : "Show"}</span>
            </Button>
            <Collapse in={showReasoning}>
              <Typography
                component="pre"
                sx={{
                  whiteSpace: "pre-wrap",
                  px: 1.5,
                  pb: 1.5,
                  m: 0,
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: 11,
                  lineHeight: 1.65,
                  color: "text.secondary",
                }}
              >
                {reasoning}
              </Typography>
            </Collapse>
          </Paper>
        )}

        {output ? (
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
            <img src="/logo.png" alt="Zirium AI" style={{ width: 24, height: 24, borderRadius: 6, marginTop: 2, flexShrink: 0 }} />
            <Box sx={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.65, flex: 1 }}>
              {output}
              {streaming && (
                <Box
                  component="span"
                  sx={{
                    animation: "pulse 1s ease-in-out infinite",
                    "@keyframes pulse": {
                      "0%, 100%": { opacity: 1 },
                      "50%": { opacity: 0.3 },
                    },
                  }}
                >
                  ▍
                </Box>
              )}
            </Box>
          </Box>
        ) : (
          !streaming &&
          !error && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", py: 3, textAlign: "center" }}
            >
              The response will appear here.
            </Typography>
          )
        )}
      </Box>

      {/* Footer actions */}
      {output && !streaming && (
        <>
          <Divider />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 1,
              px: 2,
              py: 1.5,
            }}
          >
            <Button
              onClick={() => navigator.clipboard.writeText(output)}
              variant="outlined"
              color="inherit"
              sx={{ borderColor: "divider", fontSize: 12 }}
            >
              Copy
            </Button>
            {opts.onInsert && (
              <Button
                onClick={() => {
                  opts.onInsert!(output);
                  onClose();
                }}
                variant="contained"
                sx={{ fontSize: 12 }}
              >
                {opts.insertLabel ?? "Insert"}
              </Button>
            )}
          </Box>
        </>
      )}
    </Dialog>
  );
}

function SparkIcon() {
  return (
    <Box
      component="svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      sx={{ color: "primary.main" }}
    >
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        fill="currentColor"
      />
    </Box>
  );
}
