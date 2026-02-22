"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import lua from "react-syntax-highlighter/dist/esm/languages/hljs/lua";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import toast from "react-hot-toast";
import { createSession, checkStudioStatus, generateScript, type ScriptPayload } from "@/lib/api";

SyntaxHighlighter.registerLanguage("lua", lua);

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  script?: ScriptPayload;
  timestamp: number;
}

const RECOMMENDATIONS = [
  { title: "Coin Collection System", reason: "Players love collectible coins with particle effects" },
  { title: "NPC Dialog System", reason: "Add interactive NPCs with branching conversations" },
  { title: "Leaderboard & Stats", reason: "Track kills, coins, and time played on a leaderboard" },
];

const BADGE_COLORS: Record<string, string> = {
  Script: "var(--badge-script)",
  LocalScript: "var(--badge-local)",
  ModuleScript: "var(--badge-module)",
};

const BADGE_LETTERS: Record<string, string> = {
  Script: "S",
  LocalScript: "L",
  ModuleScript: "M",
};

// Strip JSON wrapper if source accidentally contains it
function cleanSource(source: string): string {
  if (source.trim().startsWith('{')) {
    try {
      const inner = JSON.parse(source);
      if (inner.source) return inner.source;
    } catch {
      // not JSON, use as-is
    }
  }
  return source;
}

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [scripts, setScripts] = useState<ScriptPayload[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedScript, setSelectedScript] = useState<ScriptPayload | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Init: load from storage
  useEffect(() => {
    const stored = localStorage.getItem("sessionToken");
    if (stored) {
      setToken(stored);
    } else {
      createSession().then((t) => {
        setToken(t);
        localStorage.setItem("sessionToken", t);
      });
    }
    setMessages(loadStorage<Message[]>("rp_messages", []));
    setScripts(loadStorage<ScriptPayload[]>("rp_scripts", []));
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("rp_messages", JSON.stringify(messages));
  }, [messages, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("rp_scripts", JSON.stringify(scripts));
  }, [scripts, hydrated]);

  // Poll connection
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      try {
        const res = await checkStudioStatus(token);
        setConnected(res.connected);
      } catch {
        setConnected(false);
      }
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, [token]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || !token || loading) return;
    const prompt = input.trim();
    setInput("");
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    };
    setMessages((p) => [...p, userMsg]);
    setLoading(true);
    setLoadingStatus("Sending to Claude...");

    try {
      const t1 = setTimeout(() => setLoadingStatus("Writing Luau code..."), 2000);
      const t2 = setTimeout(() => setLoadingStatus("Packaging script..."), 6000);
      const t3 = setTimeout(() => setLoadingStatus("Almost done..."), 12000);

      const script = await generateScript(prompt, token);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: script.description,
        script,
        timestamp: Date.now(),
      };
      setMessages((p) => [...p, aiMsg]);
      setScripts((p) => [...p, script]);
      setSelectedScript(script);
      toast.success(`Created ${script.scriptName}`);
    } catch (err) {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        timestamp: Date.now(),
      };
      setMessages((p) => [...p, aiMsg]);
      toast.error("Generation failed");
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  }

  function handleRecommendation(title: string) {
    setInput(title);
  }

  function handleCopyToken() {
    if (token) {
      navigator.clipboard.writeText(token);
      toast.success("Token copied");
    }
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  }

  function handleDownload(script: ScriptPayload) {
    const blob = new Blob([cleanSource(script.source)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.scriptName}.lua`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  }

  async function handleExportAll() {
    if (scripts.length === 0) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    scripts.forEach((s) => zip.file(`${s.scriptName}.lua`, s.source));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "studioai-scripts.zip";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported all scripts");
  }

  const filteredScripts = scripts.filter(
    (s) =>
      s.scriptName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.parentPath.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Detect services used in code for analysis
  function detectServices(code: string) {
    const services = [
      "Players", "RunService", "TweenService", "ReplicatedStorage",
      "UserInputService", "Workspace", "Debris", "PhysicsService",
      "MarketplaceService", "DataStoreService", "MessagingService",
    ];
    return services.filter((s) => code.includes(s));
  }

  function detectWarnings(code: string) {
    const warns: string[] = [];
    if (code.includes("wait(")) warns.push("Using deprecated wait() — use task.wait() instead");
    if (code.includes(":connect(")) warns.push("Use :Connect() with capital C");
    if (code.includes("game.Players.LocalPlayer") && !code.includes("local "))
      warns.push("Cache LocalPlayer in a local variable");
    return warns;
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* ===== LEFT SIDEBAR ===== */}
      <aside
        style={{
          width: 240,
          minWidth: 240,
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div style={{ padding: "16px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
              StudioAI
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 999,
                background: "rgba(0,212,255,0.15)",
                color: "var(--accent-cyan)",
                fontWeight: 600,
              }}
            >
              beta
            </span>
          </div>

          {/* Session token */}
          <div
            style={{
              marginTop: 12,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {token ? token.slice(0, 18) + "..." : "Loading..."}
            </span>
            <button
              onClick={handleCopyToken}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: 14,
                padding: 0,
              }}
              title="Copy token"
            >
              📋
            </button>
            <div
              className="animate-pulse-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "var(--accent-green)" : "var(--text-muted)",
                flexShrink: 0,
              }}
            />
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "0 16px 8px" }}>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              🔍
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scripts..."
              style={{
                width: "100%",
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "7px 10px 7px 30px",
                fontSize: 12,
                color: "var(--text-primary)",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.boxShadow = "0 0 0 1px var(--accent-purple)")}
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
          </div>
        </div>

        {/* Scripts list */}
        <div style={{ padding: "0 16px" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 6,
            }}
          >
            Scripts
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
          <AnimatePresence>
            {filteredScripts.map((s, i) => (
              <motion.div
                key={s.scriptName + i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedScript(s)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  background:
                    selectedScript?.scriptName === s.scriptName
                      ? "var(--bg-card)"
                      : "transparent",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-card)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    selectedScript?.scriptName === s.scriptName
                      ? "var(--bg-card)"
                      : "transparent")
                }
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: BADGE_COLORS[s.scriptType] || "var(--badge-script)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: "#000",
                    flexShrink: 0,
                  }}
                >
                  {BADGE_LETTERS[s.scriptType] || "S"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s.scriptName}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {s.parentPath}
                  </div>
                </div>
                <span style={{ color: "var(--accent-purple)", fontSize: 12, opacity: 0.5 }}>
                  →
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredScripts.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              {scripts.length === 0 ? "No scripts yet" : "No matches"}
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 6,
            }}
          >
            Next Steps
          </div>
          {RECOMMENDATIONS.map((r, i) => (
            <motion.div
              key={i}
              whileHover={{ x: 2, borderColor: "var(--border-bright)" }}
              onClick={() => handleRecommendation(r.title)}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderLeft: "2px solid var(--accent-purple)",
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 6,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11 }}>⚡</span> {r.title}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                {r.reason}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Settings"
          >
            ⚙️
          </button>
          <button
            onClick={handleExportAll}
            style={{
              background: "none",
              border: "1px solid var(--accent-cyan)",
              color: "var(--accent-cyan)",
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Export All
          </button>
        </div>
      </aside>

      {/* ===== CENTER CHAT ===== */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-base)",
          overflow: "hidden",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 20 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                borderBottom: "2px solid var(--accent-purple)",
                paddingBottom: 8,
              }}
            >
              Chat
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-muted)",
                paddingBottom: 8,
                cursor: "pointer",
              }}
            >
              Sessions
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: connected ? "var(--accent-green)" : "var(--text-muted)",
              background: "var(--bg-card)",
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="animate-pulse-dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: connected ? "var(--accent-green)" : "var(--text-muted)",
              }}
            />
            {connected ? "Studio Connected" : "Studio Offline"}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                  Welcome to StudioAI
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 400, margin: "0 auto" }}>
                  Describe what you want to add to your Roblox game and AI will generate the Luau script for you.
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {msg.role === "user" ? (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div
                      style={{
                        maxWidth: "70%",
                        background: "linear-gradient(135deg, #6c63ff, #4c44df)",
                        borderRadius: "18px 18px 4px 18px",
                        padding: "12px 16px",
                        fontSize: 13,
                        color: "#fff",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      {msg.script ? (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                              {msg.script.scriptName}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: BADGE_COLORS[msg.script.scriptType] || "var(--badge-script)",
                                color: "#000",
                                fontWeight: 700,
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {msg.script.scriptType}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {msg.script.parentPath}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", margin: "6px 0 10px" }}>
                            {msg.script.description}
                          </div>

                          {/* Code preview */}
                          <div
                            style={{
                              position: "relative",
                              borderRadius: 8,
                              overflow: "hidden",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <AnimatePresence initial={false}>
                              <motion.div
                                initial={false}
                                animate={{
                                  height: expandedCode === msg.id ? "auto" : 80,
                                }}
                                style={{ overflow: "hidden" }}
                              >
                                <SyntaxHighlighter
                                  language="lua"
                                  style={atomOneDark}
                                  showLineNumbers
                                  customStyle={{
                                    margin: 0,
                                    padding: 12,
                                    fontSize: 11,
                                    background: "var(--bg-base)",
                                    borderRadius: 0,
                                  }}
                                  lineNumberStyle={{ color: "var(--text-muted)", fontSize: 10 }}
                                >
                                  {cleanSource(msg.script.source)}
                                </SyntaxHighlighter>
                              </motion.div>
                            </AnimatePresence>
                            {expandedCode !== msg.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: 40,
                                  background: "linear-gradient(transparent, var(--bg-base))",
                                }}
                              />
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setExpandedCode(expandedCode === msg.id ? null : msg.id)
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--accent-purple)",
                              fontSize: 11,
                              cursor: "pointer",
                              padding: "6px 0 0",
                              fontWeight: 500,
                            }}
                          >
                            {expandedCode === msg.id ? "Hide code ▴" : "Show code ▾"}
                          </button>

                          {/* Action buttons */}
                          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                            <button
                              onClick={() => setSelectedScript(msg.script!)}
                              style={{
                                background: "none",
                                border: "1px solid var(--accent-purple)",
                                color: "var(--accent-purple)",
                                fontSize: 11,
                                padding: "4px 10px",
                                borderRadius: 6,
                                cursor: "pointer",
                              }}
                            >
                              View Full
                            </button>
                            <button
                              onClick={() => handleCopyCode(msg.script!.source)}
                              style={{
                                background: "none",
                                border: "1px solid var(--accent-cyan)",
                                color: "var(--accent-cyan)",
                                fontSize: 11,
                                padding: "4px 10px",
                                borderRadius: 6,
                                cursor: "pointer",
                              }}
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => handleDownload(msg.script!)}
                              style={{
                                background: "none",
                                border: "1px solid var(--border-bright)",
                                color: "var(--text-secondary)",
                                fontSize: 11,
                                padding: "4px 10px",
                                borderRadius: 6,
                                cursor: "pointer",
                              }}
                            >
                              Download
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    className="animate-pulse-dot"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--accent-purple)",
                    }}
                  />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {loadingStatus || "Generating..."}
                  </span>
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div
          style={{
            padding: 16,
            borderTop: "1px solid var(--border)",
            background: "var(--bg-sidebar)",
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              gap: 10,
              maxWidth: 720,
              margin: "0 auto",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to add to your Roblox game..."
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              style={{
                flex: 1,
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 13,
                color: "var(--text-primary)",
                outline: "none",
              }}
              onFocus={(e) =>
                (e.target.style.boxShadow = "0 0 0 1px var(--accent-purple)")
              }
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
            <motion.button
              type="submit"
              disabled={loading || !input.trim()}
              whileTap={{ scale: 0.95 }}
              style={{
                background: "var(--accent-purple)",
                border: "none",
                borderRadius: 10,
                padding: "10px 16px",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                color: "#fff",
                fontSize: 16,
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              ➜
            </motion.button>
          </form>
          <div
            style={{
              maxWidth: 720,
              margin: "6px auto 0",
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            ⌘ Enter to send · Powered by Claude
          </div>
        </div>
      </div>

      {/* ===== RIGHT DETAILS PANEL ===== */}
      <AnimatePresence>
        {selectedScript && (
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            style={{
              width: 320,
              minWidth: 320,
              background: "var(--bg-sidebar)",
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                    {selectedScript.scriptName}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: BADGE_COLORS[selectedScript.scriptType],
                      color: "#000",
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {selectedScript.scriptType}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedScript(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {selectedScript.parentPath}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button
                  onClick={() => handleCopyCode(cleanSource(selectedScript.source))}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    padding: "5px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => handleDownload(selectedScript)}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    padding: "5px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  ⬇ Download
                </button>
                <button
                  style={{
                    background: "var(--accent-purple)",
                    border: "none",
                    color: "#fff",
                    fontSize: 11,
                    padding: "5px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Push ▶
                </button>
              </div>
            </div>

            {/* Code viewer */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <SyntaxHighlighter
                language="lua"
                style={atomOneDark}
                showLineNumbers
                customStyle={{
                  margin: 0,
                  padding: 14,
                  fontSize: 11,
                  background: "var(--bg-base)",
                  minHeight: "100%",
                }}
                lineNumberStyle={{ color: "var(--text-muted)", fontSize: 10 }}
              >
                {cleanSource(selectedScript.source)}
              </SyntaxHighlighter>
            </div>

            {/* Analysis */}
            <div
              style={{
                padding: 14,
                borderTop: "1px solid var(--border)",
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                Analysis
              </div>

              {/* Services */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {detectServices(cleanSource(selectedScript.source)).map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* Warnings */}
              {detectWarnings(cleanSource(selectedScript.source)).map((w, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    color: "#f59e0b",
                    marginBottom: 4,
                    display: "flex",
                    gap: 4,
                  }}
                >
                  <span>⚠️</span> {w}
                </div>
              ))}

              {detectWarnings(cleanSource(selectedScript.source)).length === 0 && (
                <div style={{ fontSize: 11, color: "var(--accent-green)", display: "flex", gap: 4 }}>
                  <span>✓</span> No issues detected
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
