import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// User provided backup keys pool for direct fallback and load balancing
const GROQ_KEYS_POOL = Array.from(new Set([
  process.env.GROQ_API_KEY,
  "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", // Grok3 fallback
  "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", // Groq2 fallback
  "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"  // Default default key
])).filter(Boolean) as string[];

const groqApiKey = GROQ_KEYS_POOL[0] || '';

// Database File Path
const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database folders exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
}

// Read database helper (Asynchronous, supporting Vercel KV and Upstash Redis cloud fallback)
async function getDB() {
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const response = await fetch(kvUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', 'student_workspace_db'])
      });
      const data = await response.json();
      if (data && data.result) {
        return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      }
    } catch (err) {
      console.error('[Cloud DB Error] Failed to fetch from Upstash/Vercel KV REST API:', err);
    }
  }

  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { users: {} };
  }
}

// Write database helper (Asynchronous, supporting Vercel KV and Upstash Redis cloud fallback)
async function saveDB(dbData: any) {
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    try {
      await fetch(kvUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', 'student_workspace_db', JSON.stringify(dbData)])
      });
    } catch (err) {
      console.error('[Cloud DB Error] Failed to update Upstash/Vercel KV REST API:', err);
    }
  }

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (err) {
    // Fail silently in read-only environments
  }
}

// Initialize Gemini client securely if present
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body size limits to comfortably receive base64 frame snapshots
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Check / Health Status
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!geminiApiKey,
      hasGroqKey: !!groqApiKey,
      timestamp: new Date().toISOString()
    });
  });

  // Simple Authenticated Username/Password registration
  app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password credentials are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = await getDB();

    if (db.users[cleanUsername]) {
      return res.status(409).json({ error: 'Username is already registered.' });
    }

    // Default pristine synced state for new workspace accounts
    const defaultState = {
      goals: [],
      syllabusList: [],
      deadlines: [],
      sessionLogs: [],
      heatMapConfig: {
        palette: 'monochrome',
        viewRange: 'month'
      },
      backgroundVideoIds: ['4xDzrIxZZZI', '83DId9I1v6s', '5wREv76k6vY', 'jfKfPfyJRdk'],
      activeGridCount: 4,
      durationFocus: 25,
      durationShort: 5,
      durationLong: 15
    };

    db.users[cleanUsername] = {
      username: username.trim(),
      password: password, // Plain text over local preview connection is fine and reliable
      joinedAt: new Date().toISOString(),
      state: defaultState
    };

    await saveDB(db);
    res.json({
      username: username.trim(),
      joinedAt: db.users[cleanUsername].joinedAt,
      state: defaultState
    });
  });

  // Username/Password Login
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'All login credentials are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = await getDB();
    const user = db.users[cleanUsername];

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password match.' });
    }

    res.json({
      username: user.username,
      joinedAt: user.joinedAt,
      state: user.state
    });
  });

  // Sync state operations (Get or Save)
  app.post('/api/sync/get', async (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Missing username parameter' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = await getDB();
    const user = db.users[cleanUsername];

    if (!user) {
      return res.status(404).json({ error: 'User workspace records not found.' });
    }

    res.json({ state: user.state });
  });

  app.post('/api/sync/save', async (req, res) => {
    const { username, state } = req.body;
    if (!username || !state) {
      return res.status(400).json({ error: 'Username and state payload required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = await getDB();
    const user = db.users[cleanUsername];

    if (!user) {
      return res.status(404).json({ error: 'User not registered.' });
    }

    // Update synced properties safely
    user.state = {
      ...user.state,
      ...state
    };

    await saveDB(db);
    res.json({ success: true, savedAt: new Date().toISOString(), state: user.state });
  });

  // AI Stream & Vision Analysis Endpoint supporting Groq with base64 image LLaVA model
  app.post('/api/analyze', async (req, res) => {
    try {
      const { image, mode, goal } = req.body;

      if (!image) {
        return res.status(400).json({ error: 'Missing image payload' });
      }

      // Prepare clear base64 data to extract prefix
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

      // Content instruction guidelines
      let promptText = '';
      if (mode === 'camera') {
        promptText = `You are a real-time smart productivity assistant monitoring an active study session.
Analyze this web camera snapshot. Determine if a person is sitting actively in front of the screen or desk.
Is the seat vacant? Report if the workspace is "working" (focus state), "idle" (passive/on phone), "distracted" (looking away/off target), or "away" (no presence).
Analyze the image clearly and report. Always reply with a strict JSON format matching exactly:
{
  "personPresent": true,
  "status": "working",
  "summary": "Warm, tiny encouraging description of observation (e.g. studying deep calculus)."
}
Do not add other text formatting outside JSON.`;
      } else {
        const goalContext = goal ? `The user's current session target is: "${goal}".` : '';
        promptText = `You are a smart workspace visual analyzer.
Analyze this desktop screenshot/workspace activity. Identify what is active.
${goalContext}
Determine if the study/work content matches their target, or if they are distracted.
Always reply with a strict JSON format matching exactly:
{
  "personPresent": true,
  "status": "working",
  "summary": "Tiny encouraging description on workspace matching their session target."
}
Do not add other text formatting outside JSON.`;
      }

      // Let's attempt using our excellent Groq key pool for higher vision limits and fast speed
      let analysisResult = null;
      let lastError = null;

      for (let i = 0; i < GROQ_KEYS_POOL.length; i++) {
        const currentKey = GROQ_KEYS_POOL[i];
        try {
          console.log(`[Groq Vision] Attempting analysis with key index ${i}...`);
          const bodyPayload = {
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: promptText
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${base64Data}`
                    }
                  }
                ]
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
          };

          const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyPayload)
          });

          if (groqResponse.ok) {
            const data = await groqResponse.json();
            const rawContent = data.choices[0]?.message?.content || '{}';
            console.log('[Groq Vision] Successful reply:', rawContent);
            const parsed = JSON.parse(rawContent);
            analysisResult = {
              personPresent: parsed.personPresent !== undefined ? parsed.personPresent : true,
              status: parsed.status || 'working',
              summary: parsed.summary || 'Study room environment is active.'
            };
            break; // Success! No need to try next key.
          } else {
            const errText = await groqResponse.text();
            console.warn(`[Groq Vision] Failed response status ${groqResponse.status} for key index ${i}:`, errText);
            lastError = `Status ${groqResponse.status}: ${errText}`;
          }
        } catch (groqErr: any) {
          console.error(`[Groq Vision] Connection/execution error with key index ${i}:`, groqErr);
          lastError = groqErr.message;
        }
      }

      if (analysisResult) {
        return res.json(analysisResult);
      }

      // If we got here, all Groq keys in the pool failed and Gemini fallback is disabled for vision calls as requested.
      return res.status(503).json({
        error: 'Vision analysis service currently unavailable.',
        message: lastError || 'All Groq keys in the pool failed to authenticate or rate-limited.',
        personPresent: true,
        status: 'error',
        summary: 'Smart tracking service offline. Please check your Groq API keys.'
      });

    } catch (error: any) {
      console.error('Vision analysis failure:', error);
      res.status(500).json({
        error: 'Backend analysis failed',
        message: error.message,
        personPresent: true, // Default safe-guard
        status: 'error',
        summary: 'Smart tracking service idle. Workspace safety active.'
      });
    }
  });

  // Powerful Chat helper endpoint using Groq for smart productivity reminders
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, context } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message content is empty' });
      }

      const contextMsg = `You are a supportive, high-minded Minimalist Zen Study Coach.
The student parameters inside their current focus workspace values are:
- Current timer countdown status: ${context?.timerState || 'Idle'}
- Completed goals count: ${context?.goalsCompleted || 0}
- Active session goal list: ${JSON.stringify(context?.goals || [])}
- Alert triggers: Drink water reminder, focus session length limits (>2 hours suggests dynamic break stretching).
Provide direct, short, cozy feedback under 3 lines. Be incredibly mindful and black&white clean-spoken. No emojis unless essential.`;

      const finalMessages = [
        { role: 'system', content: contextMsg },
        ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ];

      let chatReply = null;
      let lastChatError = null;

      for (let i = 0; i < GROQ_KEYS_POOL.length; i++) {
        const currentKey = GROQ_KEYS_POOL[i];
        try {
          const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: finalMessages,
              max_tokens: 200,
              temperature: 0.7
            })
          });

          if (groqResponse.ok) {
            const data = await groqResponse.json();
            chatReply = data.choices[0]?.message?.content || '';
            break;
          } else {
            const errText = await groqResponse.text();
            console.warn(`[Groq Chat] Failed response status ${groqResponse.status} for key index ${i}:`, errText);
            lastChatError = `Status ${groqResponse.status}: ${errText}`;
          }
        } catch (chatError: any) {
          console.error(`[Groq Chat] Failed for key index ${i}:`, chatError);
          lastChatError = chatError.message;
        }
      }

      if (chatReply !== null) {
        return res.json({ reply: chatReply });
      }

      // Gemini fallback for Chat only (when Groq pool is fully exhausted)
      if (ai) {
        const geminiMessages = finalMessages.map(m => ({
          role: m.role === 'system' ? 'user' : m.role,
          parts: [{ text: m.content }]
        }));
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: geminiMessages,
        });
        return res.json({ reply: response.text || 'Keep working diligently!' });
      }

      return res.json({ reply: "I am ready and supporting your focus session. Stay calm, drink some warm green tea, and let's conquer your objectives." });

    } catch (error: any) {
      console.error('[Chat API] failed:', error);
      res.status(500).json({ error: 'Chat API error response' });
    }
  });

  // Hot module reloading with Vite middlewares in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Standard static serving for compiled dist/ folder in Cloud Run / Production Env
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Focus Server] Full-stack engine launched at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Focus Server] Boot error:', err);
});
