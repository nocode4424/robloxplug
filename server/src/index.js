import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;

// --- State ---
// sessionToken -> { ws, connectedAt }
const studioClients = new Map();
// sessionToken -> { createdAt }
const sessions = new Map();
// sessionToken -> ScriptPayload[] (queue for HTTP polling fallback)
const scriptQueues = new Map();

// --- Claude Client ---
const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are an expert Roblox Luau developer. When given a request, generate a single Roblox script that implements the feature. Always respond with valid JSON only — no markdown, no explanation outside the JSON. Format: { "scriptName": string, "scriptType": "Script" | "LocalScript" | "ModuleScript", "parentPath": string (e.g. "ServerScriptService", "ReplicatedStorage", "StarterPlayerScripts"), "source": string (the full Luau code), "description": string (one sentence summary) }. Follow Roblox best practices: use RemoteEvents for client-server communication, never use wait() (use task.wait()), use typed Luau where practical. IMPORTANT: Your entire response must be valid JSON only. Do not include any text before or after the JSON object. Do not use markdown code blocks. Start your response with { and end with }.`;

// --- Express App ---
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Create a new session
app.post('/api/session', (req, res) => {
  const token = uuidv4();
  sessions.set(token, { createdAt: Date.now() });
  res.json({ sessionToken: token });
});

// Check if studio is connected for a given session
app.get('/api/session/:token/status', (req, res) => {
  const { token } = req.params;
  if (!sessions.has(token)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const client = studioClients.get(token);
  const connected = !!(client && (client.ws.readyState === 1 || client.httpPolling));
  res.json({ connected });
});

// Generate a script via Claude and push to Studio
app.post('/api/generate', async (req, res) => {
  const { prompt, sessionToken, gameContext } = req.body;

  if (!prompt || !sessionToken) {
    return res.status(400).json({ error: 'prompt and sessionToken are required' });
  }

  if (!sessions.has(sessionToken)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const userMessage = gameContext
      ? `Game context: ${JSON.stringify(gameContext)}\n\nRequest: ${prompt}`
      : prompt;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = response.content[0].text;

    // Strip markdown code blocks if Claude wrapped the response
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let payload;
    try {
      payload = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse failed. Raw response:', raw);
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        parseError: parseErr.message,
        raw,
      });
    }

    // Validate all required fields exist
    const required = ['scriptName', 'scriptType', 'parentPath', 'source', 'description'];
    const missing = required.filter((field) => !payload[field]);
    if (missing.length > 0) {
      return res.status(500).json({
        error: `Claude response missing required fields: ${missing.join(', ')}`,
        payload,
      });
    }

    // Push to Studio via WebSocket if connected
    const client = studioClients.get(sessionToken);
    let pushedToStudio = false;
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify({
        type: 'createScript',
        ...payload,
      }));
      pushedToStudio = true;
    }

    // Also queue for HTTP polling (Studio plugin fallback)
    if (!scriptQueues.has(sessionToken)) {
      scriptQueues.set(sessionToken, []);
    }
    scriptQueues.get(sessionToken).push(payload);

    res.json({ ...payload, pushedToStudio });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Poll for pending scripts (HTTP fallback for Studio plugin)
app.get('/api/session/:token/scripts', (req, res) => {
  const { token } = req.params;
  if (!sessions.has(token)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const queue = scriptQueues.get(token) || [];
  // Drain the queue
  scriptQueues.set(token, []);
  res.json(queue);
});

// Register a Studio plugin connection via HTTP (marks session as connected)
app.post('/api/session/:token/register', (req, res) => {
  const { token } = req.params;
  if (!sessions.has(token)) {
    sessions.set(token, { createdAt: Date.now() });
  }
  // Mark as HTTP-polling client
  studioClients.set(token, { ws: { readyState: 0 }, connectedAt: Date.now(), httpPolling: true });
  res.json({ registered: true });
});

// --- WebSocket Server ---
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  let registeredToken = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'register' && msg.sessionToken) {
        registeredToken = msg.sessionToken;

        // Ensure session exists
        if (!sessions.has(registeredToken)) {
          sessions.set(registeredToken, { createdAt: Date.now() });
        }

        studioClients.set(registeredToken, { ws, connectedAt: Date.now() });
        console.log(`Studio registered for session: ${registeredToken}`);

        ws.send(JSON.stringify({ type: 'registered', sessionToken: registeredToken }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    if (registeredToken) {
      studioClients.delete(registeredToken);
      console.log(`Studio disconnected for session: ${registeredToken}`);
    }
  });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
});
