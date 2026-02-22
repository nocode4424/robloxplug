const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function createSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/session`, { method: "POST" });
  const data = await res.json();
  return data.sessionToken;
}

export async function checkStudioStatus(
  token: string
): Promise<{ connected: boolean }> {
  const res = await fetch(`${API_BASE}/api/session/${token}/status`);
  return res.json();
}

export interface ScriptPayload {
  scriptName: string;
  scriptType: "Script" | "LocalScript" | "ModuleScript";
  parentPath: string;
  source: string;
  description: string;
  pushedToStudio: boolean;
}

export async function generateScript(
  prompt: string,
  sessionToken: string,
  gameContext?: Record<string, unknown>
): Promise<ScriptPayload> {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, sessionToken, gameContext }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Generation failed");
  }
  return res.json();
}
