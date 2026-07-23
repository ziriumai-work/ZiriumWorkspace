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
import SendIcon from "@mui/icons-material/Send";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
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
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          bgcolor: "background.paper",
          zIndex: 10,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ 
            width: 32, height: 32, borderRadius: "50%", overflow: "hidden", 
            boxShadow: "var(--mui-shadows-2)", display: "flex", alignItems: "center", justifyContent: "center" 
          }}>
            <img src="/logo.png" alt="Zirium AI" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: "-0.01em", display: { xs: "none", sm: "block" } }}>
            Zirium AI
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button
            onClick={(e) => setModelAnchor(e.currentTarget)}
            variant="text"
            color="inherit"
            endIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{ 
              fontWeight: 600, 
              fontSize: 13, 
              borderRadius: 3, 
              px: 1.5, 
              color: "text.secondary",
              "&:hover": { bgcolor: "action.hover", color: "text.primary" } 
            }}
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
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            sx={{ 
              borderRadius: 3, 
              fontSize: 13, 
              fontWeight: 600, 
              textTransform: "none",
              borderColor: "divider",
              color: "text.primary",
              "&:hover": { bgcolor: "surface" }
            }}
          >
            New chat
          </Button>
        </Box>
      </Box>

      {/* Messages */}
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", scrollBehavior: "smooth" }}>
        {empty ? (
          <Box
            sx={{
              mx: "auto",
              display: "flex",
              minHeight: "100%",
              maxWidth: 1400,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              px: 3,
              py: 6,
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                mb: 3,
                borderRadius: "50%",
                boxShadow: "0 8px 32px -8px rgba(0,0,0,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main))",
                p: "2px", // subtle gradient border effect
              }}
            >
              <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <img src="/logo.png" alt="Zirium AI" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </Box>
            </Box>
            <Typography 
              variant="h3" 
              sx={{ 
                fontSize: { xs: "1.75rem", sm: "2.25rem" }, 
                fontWeight: 800, 
                letterSpacing: "-0.02em",
                background: "linear-gradient(90deg, var(--mui-palette-text-primary) 0%, var(--mui-palette-text-secondary) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}
            >
              How can I help today?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, mb: 5, maxWidth: 400, mx: "auto" }}>
              Ask anything, or start with one of the suggestions below to kick off your project.
            </Typography>
            <Box
              sx={{
                display: "grid",
                width: "100%",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              {SUGGESTIONS.map((s) => (
                <Paper
                  key={s}
                  component="button"
                  variant="outlined"
                  onClick={() => send(s)}
                  sx={{
                    p: 2,
                    textAlign: "left",
                    borderRadius: 4,
                    cursor: "pointer",
                    color: "text.secondary",
                    bgcolor: "surface",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 2px 8px -4px rgba(0,0,0,0.05)",
                    "&:hover": {
                      borderColor: "primary.main",
                      bgcolor: "background.paper",
                      color: "text.primary",
                      transform: "translateY(-2px)",
                      boxShadow: "0 8px 16px -8px rgba(0,0,0,0.1)",
                    },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.4 }}>{s}</Typography>
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
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 3, position: "relative" }}>
        {/* Subtle fade overlay behind composer to blend with messages */}
        <Box sx={{ position: "absolute", top: -40, left: 0, right: 0, height: 40, background: "linear-gradient(to top, var(--mui-palette-background-default) 0%, transparent 100%)", pointerEvents: "none" }} />
        
        <Box sx={{ mx: "auto", maxWidth: 760, position: "relative", zIndex: 1 }}>
          <Paper
            elevation={0}
            sx={{
              display: "flex",
              alignItems: "flex-end",
              gap: 1.5,
              borderRadius: 6,
              p: 1.5,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              boxShadow: "0 8px 32px -8px rgba(0,0,0,0.08)",
              transition: "border-color 0.2s, box-shadow 0.2s",
              "&:focus-within": { 
                borderColor: "primary.main",
                boxShadow: "0 8px 32px -8px var(--mui-palette-primary-main)40"
              },
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
              sx={{ flex: 1, px: 1.5, py: 1, fontSize: "1rem", lineHeight: 1.5 }}
            />
            {streaming ? (
              <Button
                onClick={() => abortRef.current?.abort()}
                variant="contained"
                color="inherit"
                sx={{ borderRadius: "50%", minWidth: 0, width: 40, height: 40, p: 0, bgcolor: "action.hover", color: "text.primary" }}
                title="Stop generation"
              >
                <Box sx={{ width: 12, height: 12, bgcolor: "currentColor", borderRadius: "2px" }} />
              </Button>
            ) : (
              <Button
                onClick={() => send(input)}
                disabled={!input.trim()}
                variant="contained"
                sx={{ 
                  borderRadius: "50%", 
                  minWidth: 0, 
                  width: 40, 
                  height: 40, 
                  p: 0,
                  boxShadow: "none",
                  "&:hover": { boxShadow: "var(--mui-shadows-2)" }
                }}
                title="Send message"
              >
                <SendIcon sx={{ fontSize: 18, ml: "2px" }} />
              </Button>
            )}
          </Paper>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ mt: 1.5, display: "block", textAlign: "center", fontSize: 11, fontWeight: 500 }}
          >
            Zirium AI can make mistakes. Verify important information.
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
            maxWidth: { xs: "90%", sm: "80%" },
            whiteSpace: "pre-wrap",
            borderRadius: "20px",
            borderBottomRightRadius: "4px",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            px: 2.5,
            py: 1.5,
            fontSize: 15,
            lineHeight: 1.6,
            boxShadow: "0 2px 8px -4px var(--mui-palette-primary-main)60",
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
          borderRadius: "50%",
          boxShadow: "0 4px 12px -2px var(--mui-palette-primary-main)40",
          background: "linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main))",
          p: "1.5px", // subtle gradient border
        }}
      >
        <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <img src="/logo.png" alt="Zirium AI" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Box>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {msg.reasoning && (
          <Paper variant="outlined" sx={{ mb: 1.5, borderRadius: 3, bgcolor: "surface", borderStyle: "dashed" }}>
            <Button
              onClick={() => setShowReasoning((v) => !v)}
              fullWidth
              color="inherit"
              sx={{
                justifyContent: "space-between",
                px: 2,
                py: 1,
                fontSize: 12,
                color: "text.secondary",
                fontWeight: 600,
                textTransform: "none",
                borderRadius: 3,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <AutoAwesomeIcon sx={{ fontSize: 14, color: "primary.main" }} />
                <span>Reasoning process</span>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <span>{showReasoning ? "Hide" : "Show"}</span>
                <ExpandMoreIcon sx={{ fontSize: 16, transform: showReasoning ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </Box>
            </Button>
            <Collapse in={showReasoning}>
              <Typography
                component="pre"
                sx={{
                  whiteSpace: "pre-wrap",
                  px: 2,
                  pb: 1.5,
                  m: 0,
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "text.secondary",
                }}
              >
                {msg.reasoning}
              </Typography>
            </Collapse>
          </Paper>
        )}
        <Box sx={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.65, color: "text.primary", mt: 0.5 }}>
          {msg.content || (
            <Typography component="span" variant="body1" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", animation: "pulse 1s infinite" }} />
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", animation: "pulse 1s infinite 0.2s" }} />
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", animation: "pulse 1s infinite 0.4s" }} />
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
