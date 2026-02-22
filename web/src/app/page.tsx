"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sessionToken");
    if (stored) setToken(stored);
  }, []);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const t = await createSession();
      setToken(t);
      localStorage.setItem("sessionToken", t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleNewSession() {
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("rp_messages");
    localStorage.removeItem("rp_scripts");
    setToken(null);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 32,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "0 0 6px",
            }}
          >
            StudioAI
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            Generate Roblox scripts with AI and push them directly to Studio.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(255,50,50,0.1)",
              border: "1px solid rgba(255,50,50,0.3)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              color: "#ff6b6b",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {!token ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleConnect}
            disabled={loading}
            style={{
              width: "100%",
              background: "var(--accent-purple)",
              border: "none",
              borderRadius: 10,
              padding: "14px 0",
              fontSize: 15,
              fontWeight: 600,
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating session..." : "Connect Studio"}
          </motion.button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                Session token — paste into Roblox Studio plugin:
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  alignItems: "center",
                }}
              >
                <code
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
                  {token}
                </code>
                <button
                  onClick={handleCopy}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    color: copied ? "var(--accent-green)" : "var(--text-secondary)",
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/chat")}
              style={{
                width: "100%",
                background: "var(--accent-purple)",
                border: "none",
                borderRadius: 10,
                padding: "14px 0",
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {localStorage.getItem("rp_messages") &&
              JSON.parse(localStorage.getItem("rp_messages")!).length > 0
                ? "Continue Session"
                : "Open Chat"}
            </motion.button>

            <button
              onClick={handleNewSession}
              style={{
                width: "100%",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 0",
                fontSize: 12,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Start New Session
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
