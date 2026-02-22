import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;

// --- State ---
const sessions = new Map();       // token -> { createdAt }
const scriptQueues = new Map();   // token -> ScriptPayload[]
const studioClients = new Map();  // token -> { ws?, httpPolling?, connectedAt }

// --- Claude Client ---
const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a Roblox Luau expert. Respond ONLY with a raw JSON object. No markdown. No code blocks. No explanation. The JSON must have exactly these fields:
{
  "scriptName": "string",
  "scriptType": "Script" | "LocalScript" | "ModuleScript",
  "parentPath": "string",
  "source": "string containing the full Luau code",
  "description": "string"
}
The source field must contain the complete Luau script as a single escaped string. Begin your response with { and end with }. Nothing else.`;

async function parseClaudeResponse(text) {
  const cleaned = text
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (e) {
      console.error("JSON parse error:", e.message);
      console.error("Attempted to parse:", cleaned.slice(start, end + 1).substring(0, 200));
    }
  }

  return {
    scriptName: "GeneratedScript",
    scriptType: "Script",
    parentPath: "ServerScriptService",
    source: text,
    description: "Auto-wrapped script",
  };
}

// --- Express App ---
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Create a new session (called by web app)
app.post('/api/session', (req, res) => {
  const token = uuidv4();
  sessions.set(token, { createdAt: Date.now() });
  scriptQueues.set(token, []);
  console.log('Session created:', token);
  res.json({ sessionToken: token });
});

// Register Studio plugin for a session (called by plugin on Connect)
app.post('/api/session/:token/register', (req, res) => {
  const { token } = req.params;
  console.log('Studio plugin registered for token:', token);

  if (!sessions.has(token)) {
    sessions.set(token, { createdAt: Date.now() });
  }
  if (!scriptQueues.has(token)) {
    scriptQueues.set(token, []);
  }

  studioClients.set(token, { httpPolling: true, connectedAt: Date.now() });
  console.log('All registered tokens:', [...studioClients.keys()]);
  res.json({ success: true });
});

// Check if Studio plugin is connected (polled by web app)
app.get('/api/session/:token/status', (req, res) => {
  const { token } = req.params;
  const connected = studioClients.has(token);
  res.json({ connected });
});

// Poll for pending scripts (called by Studio plugin every 2s)
app.get('/api/session/:token/scripts', (req, res) => {
  const { token } = req.params;
  const queue = scriptQueues.get(token) || [];
  scriptQueues.set(token, []); // drain after sending
  console.log('Plugin polled token:', token, '— sending', queue.length, 'scripts');
  res.json(queue);
});

// Generate a script via Claude (called by web app chat)
app.post('/api/generate', async (req, res) => {
  const { prompt, sessionToken, gameContext } = req.body;

  if (!prompt || !sessionToken) {
    return res.status(400).json({ error: 'prompt and sessionToken are required' });
  }

  // Auto-create session if it doesn't exist (in case server restarted)
  if (!sessions.has(sessionToken)) {
    sessions.set(sessionToken, { createdAt: Date.now() });
    scriptQueues.set(sessionToken, []);
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

    const rawText = response.content[0].text;
    console.log("RAW CLAUDE RESPONSE:", rawText.substring(0, 500));

    const payload = await parseClaudeResponse(rawText);

    // Unwrap double-wrapped JSON source
    let finalSource = payload.source;
    try {
      const innerParsed = JSON.parse(payload.source);
      if (innerParsed.source) {
        console.log("UNWRAPPING double-wrapped JSON source");
        finalSource = innerParsed.source;
        payload.scriptName = innerParsed.scriptName || payload.scriptName;
        payload.scriptType = innerParsed.scriptType || payload.scriptType;
        payload.parentPath = innerParsed.parentPath || payload.parentPath;
      }
    } catch (e) {
      // source is already raw Luau
    }
    payload.source = finalSource;

    // Validate required fields
    const required = ['scriptName', 'scriptType', 'parentPath', 'source', 'description'];
    const missing = required.filter((field) => !payload[field]);
    if (missing.length > 0) {
      return res.status(500).json({
        error: `Missing required fields: ${missing.join(', ')}`,
        payload,
      });
    }

    // Build clean script payload
    const scriptData = {
      scriptName: payload.scriptName,
      scriptType: payload.scriptType,
      parentPath: payload.parentPath,
      source: payload.source,
      description: payload.description,
    };

    // Queue for HTTP polling (Studio plugin picks this up)
    const queue = scriptQueues.get(sessionToken) || [];
    queue.push(scriptData);
    scriptQueues.set(sessionToken, queue);
    console.log('Queued script for token:', sessionToken, '— queue size:', queue.length);
    console.log('Script:', scriptData.scriptName, scriptData.scriptType, scriptData.parentPath);

    // Also push via WebSocket if a WS client is connected
    const client = studioClients.get(sessionToken);
    let pushedToStudio = false;
    if (client && client.ws && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(scriptData));
      pushedToStudio = true;
      console.log("Also pushed via WebSocket");
    }

    res.json({ ...scriptData, pushedToStudio: pushedToStudio || studioClients.has(sessionToken) });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- WebSocket Server (optional, for non-polling clients) ---
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  let registeredToken = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'register' && msg.sessionToken) {
        registeredToken = msg.sessionToken;
        if (!sessions.has(registeredToken)) {
          sessions.set(registeredToken, { createdAt: Date.now() });
        }
        if (!scriptQueues.has(registeredToken)) {
          scriptQueues.set(registeredToken, []);
        }
        studioClients.set(registeredToken, { ws, connectedAt: Date.now() });
        console.log('Studio registered via WebSocket:', registeredToken);
        ws.send(JSON.stringify({ type: 'registered', sessionToken: registeredToken }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    if (registeredToken) {
      studioClients.delete(registeredToken);
      console.log('Studio WS disconnected:', registeredToken);
    }
  });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
});
