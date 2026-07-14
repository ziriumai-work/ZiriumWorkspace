"use client";

// Zirium AI — a full chat experience (like ChatGPT / Claude). Multi-turn
// conversation, model switching, streaming responses, and (for the Pro model)
// collapsible reasoning. Powered by DeepSeek via /api/ai; the key stays server
// side. Conversations live in component state for now (Phase: persist to
// Firestore later so chats sync across devices).

import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import InputBase from "@mui/material/InputBase";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  AI_MODELS,
  DEFAULT_MODEL_ID,
  MODEL_STORAGE_KEY,
  getModel,
} from "@/lib/ai/ai-models";
import { streamCompletion, type ChatMessage } from "@/lib/ai/ai-client";

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
  const [modelAnchor, setModelAnchor] = useState<HTMLElement | null>(null);
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
    setModelAnchor(null);
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
    <Box sx={{ display: "flex", height: "100%", flexDirection: "column" }}>
      {/* Sub-header: model picker + new chat */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
          px: 3,
          py: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SparkIcon />
          <Typography variant="subtitle2">Zirium AI</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                onClick={() => chooseModel(m.id)}
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
          <Button
            onClick={newChat}
            variant="outlined"
            color="inherit"
            sx={{ borderColor: "divider", fontSize: 12 }}
          >
            New chat
          </Button>
        </Box>
      </Box>

      {/* Messages */}
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto" }}>
        {empty ? (
          <Box
            sx={{
              mx: "auto",
              display: "flex",
              height: "100%",
              maxWidth: 640,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              px: 3,
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                display: "flex",
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 3,
                bgcolor: "accentSoft",
              }}
            >
              <SparkIcon large />
            </Box>
            <Typography variant="h2" sx={{ mt: 2, fontSize: "1.25rem" }}>
              How can I help?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Ask anything, or start with one of these.
            </Typography>
            <Box
              sx={{
                mt: 3,
                display: "grid",
                width: "100%",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1,
              }}
            >
              {SUGGESTIONS.map((s) => (
                <Paper
                  key={s}
                  component="button"
                  variant="outlined"
                  onClick={() => send(s)}
                  sx={{
                    p: 1.5,
                    textAlign: "left",
                    borderRadius: 3,
                    cursor: "pointer",
                    color: "text.secondary",
                    bgcolor: "transparent",
                    transition: "border-color 0.15s, color 0.15s",
                    "&:hover": {
                      borderColor: "primary.main",
                      color: "text.primary",
                    },
                  }}
                >
                  <Typography variant="body2">{s}</Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        ) : (
          <Box sx={{ mx: "auto", maxWidth: 760, px: 3, py: 3 }}>
            {messages.map((m) => (
              <Message key={m.id} msg={m} streaming={streaming} />
            ))}
            {error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {error}
              </Alert>
            )}
          </Box>
        )}
      </Box>

      {/* Composer */}
      <Box sx={{ borderTop: 1, borderColor: "divider", px: 3, py: 2 }}>
        <Box sx={{ mx: "auto", maxWidth: 760 }}>
          <Paper
            variant="outlined"
            sx={{
              display: "flex",
              alignItems: "flex-end",
              gap: 1,
              borderRadius: 4,
              p: 1,
              "&:focus-within": { borderColor: "primary.main" },
            }}
          >
            <InputBase
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              multiline
              maxRows={6}
              placeholder={`Message ${model?.label ?? "Zirium AI"}…`}
              sx={{ flex: 1, px: 1, py: 0.75, fontSize: 14 }}
            />
            {streaming ? (
              <Button
                onClick={() => abortRef.current?.abort()}
                variant="outlined"
                color="inherit"
                sx={{ borderColor: "divider", flexShrink: 0 }}
              >
                Stop
              </Button>
            ) : (
              <Button
                onClick={() => send(input)}
                disabled={!input.trim()}
                variant="contained"
                sx={{ flexShrink: 0, px: 2 }}
              >
                Send
              </Button>
            )}
          </Paper>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.75, display: "block", textAlign: "center", fontSize: 11 }}
          >
            Enter to send · Shift+Enter for a new line · {model?.label}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function Message({ msg, streaming }: { msg: ChatMsg; streaming: boolean }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <Box sx={{ mb: 2.5, display: "flex", justifyContent: "flex-end" }}>
        <Box
          sx={{
            maxWidth: "80%",
            whiteSpace: "pre-wrap",
            borderRadius: 4,
            bgcolor: "accentSoft",
            px: 2,
            py: 1.25,
            fontSize: 14,
            lineHeight: 1.65,
          }}
        >
          {msg.content}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2.5, display: "flex", gap: 1.5 }}>
      <Box
        sx={{
          mt: 0.25,
          display: "flex",
          width: 28,
          height: 28,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 2,
          bgcolor: "primary.main",
          color: "primary.contrastText",
        }}
      >
        <SparkIcon inherit />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {msg.reasoning && (
          <Paper variant="outlined" sx={{ mb: 1, borderRadius: 3, bgcolor: "surface" }}>
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
                {msg.reasoning}
              </Typography>
            </Collapse>
          </Paper>
        )}
        <Box sx={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.65 }}>
          {msg.content || (
            <Typography component="span" variant="body2" color="text.secondary">
              Thinking…
            </Typography>
          )}
          {streaming && msg.content && (
            <Box
              component="span"
              sx={{
                ml: 0.25,
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
    </Box>
  );
}

function SparkIcon({ large, inherit }: { large?: boolean; inherit?: boolean }) {
  const s = large ? 22 : 15;
  return (
    <Box
      component="svg"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="currentColor"
      sx={{ color: inherit ? "inherit" : "primary.main" }}
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </Box>
  );
}
