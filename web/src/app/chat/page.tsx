"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeBlock } from "@/components/code-block";
import { ConnectionStatus } from "@/components/connection-status";
import { generateScript, type ScriptPayload } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  script?: ScriptPayload;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [scripts, setScripts] = useState<ScriptPayload[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sessionToken");
    setToken(stored);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !token || loading) return;

    const prompt = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setLoading(true);
    setLoadingStatus("Sending to Claude AI...");

    try {
      // Animate the status through stages
      const statusTimer = setTimeout(() => setLoadingStatus("Claude is writing Luau code..."), 2000);
      const statusTimer2 = setTimeout(() => setLoadingStatus("Parsing and packaging script..."), 6000);
      const statusTimer3 = setTimeout(() => setLoadingStatus("Almost done..."), 12000);

      const script = await generateScript(prompt, token);

      clearTimeout(statusTimer);
      clearTimeout(statusTimer2);
      clearTimeout(statusTimer3);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: script.description,
          script,
        },
      ]);
      setScripts((prev) => [...prev, script]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        },
      ]);
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-6 text-center space-y-3">
          <p className="text-muted-foreground">No session found.</p>
          <Button onClick={() => (window.location.href = "/")}>
            Go to Home
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">RobloxPlug</h2>
          <ConnectionStatus token={token} />
        </div>
        <div className="p-3 border-b">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Generated Scripts
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {scripts.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                No scripts yet. Start chatting!
              </p>
            )}
            {scripts.map((s, i) => (
              <div
                key={i}
                className="p-2 rounded-md hover:bg-muted cursor-default"
              >
                <p className="text-sm font-medium truncate">{s.scriptName}</p>
                <div className="flex gap-1 mt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {s.scriptType}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {s.parentPath}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  {msg.script && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge>{msg.script.scriptName}</Badge>
                        <Badge variant="secondary">
                          {msg.script.scriptType}
                        </Badge>
                        <Badge variant="outline">
                          {msg.script.parentPath}
                        </Badge>
                        {msg.script.pushedToStudio && (
                          <Badge
                            variant="secondary"
                            className="bg-green-900 text-green-100"
                          >
                            Pushed to Studio
                          </Badge>
                        )}
                      </div>
                      <CodeBlock code={msg.script.source} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                    <p className="text-sm font-medium text-foreground">
                      {loadingStatus || "Generating script..."}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <form
          onSubmit={handleSubmit}
          className="border-t p-4 flex gap-2 max-w-3xl mx-auto w-full"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a Roblox script to generate..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            {loading ? "..." : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
}
