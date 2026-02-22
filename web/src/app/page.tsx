"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasHistory, setHasHistory] = useState(false);

  // Restore existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem("sessionToken");
    if (stored) setToken(stored);
    const msgs = localStorage.getItem("rp_messages");
    if (msgs && JSON.parse(msgs).length > 0) setHasHistory(true);
  }, []);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const sessionToken = await createSession();
      setToken(sessionToken);
      localStorage.setItem("sessionToken", sessionToken);
    } catch (err) {
      console.error("Failed to create session:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }

  function handleNewSession() {
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("rp_messages");
    localStorage.removeItem("rp_scripts");
    setToken(null);
    setHasHistory(false);
  }

  function handleCopy() {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleStartChat() {
    router.push("/chat");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">
            RobloxPlug
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            AI-powered Roblox game creator. Generate scripts with natural
            language and push them directly to Studio.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          {!token ? (
            <Button
              onClick={handleConnect}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Creating session..." : "Connect Studio"}
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your session token — paste this into the Roblox Studio plugin:
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono break-all">
                    {token}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
              <Button onClick={handleStartChat} className="w-full" size="lg">
                {hasHistory ? "Continue Session" : "Open Chat"}
              </Button>
              {hasHistory && (
                <Button
                  onClick={handleNewSession}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  Start New Session
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
