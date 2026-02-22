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

  // Find the outermost JSON object
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

  // True fallback only if no JSON found
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

    const rawText = response.content[0].text;
    console.log("RAW CLAUDE RESPONSE:", rawText.substring(0, 500));

    const payload = await parseClaudeResponse(rawText);

    // If source itself is a JSON string (double-wrapped), parse it again
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
      // source is already raw Luau, keep as-is
    }
    payload.source = finalSource;

    // Validate all required fields exist
    const required = ['scriptName', 'scriptType', 'parentPath', 'source', 'description'];
    const missing = required.filter((field) => !payload[field]);
    if (missing.length > 0) {
      return res.status(500).json({
        error: `Claude response missing required fields: ${missing.join(', ')}`,
        payload,
      });
    }

    // Build a clean script object with only the fields we need
    const scriptData = {
      scriptName: payload.scriptName,
      scriptType: payload.scriptType,
      parentPath: payload.parentPath,
      source: payload.source,
      description: payload.description,
    };

    console.log("SENDING TO STUDIO:", JSON.stringify({
      scriptName: scriptData.scriptName,
      scriptType: scriptData.scriptType,
      parentPath: scriptData.parentPath,
      sourceLength: scriptData.source.length,
    }));

    // Push to Studio via WebSocket if connected
    console.log("studioClients size:", studioClients.size);
    console.log("Looking for token:", sessionToken);
    console.log("Found client:", !!studioClients.get(sessionToken));
    const client = studioClients.get(sessionToken);
    let pushedToStudio = false;
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(scriptData));
      pushedToStudio = true;
      console.log("Pushed via WebSocket");
    } else if (client && client.httpPolling) {
      console.log("Client is HTTP-polling, script queued");
    } else {
      console.log("No connected client found for this token");
    }

    // Also queue for HTTP polling (Studio plugin fallback)
    if (!scriptQueues.has(sessionToken)) {
      scriptQueues.set(sessionToken, []);
    }
    scriptQueues.get(sessionToken).push(scriptData);

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
  console.log("Plugin registered via HTTP with token:", token);
  if (!sessions.has(token)) {
    sessions.set(token, { createdAt: Date.now() });
  }
  // Mark as HTTP-polling client
  studioClients.set(token, { ws: { readyState: 0 }, connectedAt: Date.now(), httpPolling: true });
  console.log("All registered tokens:", [...studioClients.keys()]);
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
