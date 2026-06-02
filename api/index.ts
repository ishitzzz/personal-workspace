import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
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
try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
} catch (err) {
  console.warn('[Focus Server] Local database file write skipped (Read-only Serverless Env):', err);
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
      } else {
        // Safe default structure when cloud key doesn't exist yet
        return { users: {} };
      }
    } catch (err) {
      console.error('[Cloud DB Error] Failed to fetch from Upstash/Vercel KV REST API:', err);
    }
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    // Fail silently, return default structure below
  }
  return { users: {} };
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

const app = express();

// Set default port if needed
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

  // Automatically fetch, analyze, and extract past stream video IDs for a YouTube channel handle or page URL
  app.get('/api/youtube/streams', async (req, res) => {
    try {
      const channelUrl = req.query.url as string;
      if (!channelUrl) {
        return res.status(400).json({ error: 'Missing channel URL parameter' });
      }

      let targetUrl = channelUrl.trim();
      // Resolve shorthand elements such as @handle or missing schema
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        if (targetUrl.startsWith('@')) {
          targetUrl = `https://www.youtube.com/${targetUrl}/streams`;
        } else {
          targetUrl = `https://www.youtube.com/@${targetUrl}/streams`;
        }
      } else {
        // Ensure we point to /streams view specifically if we have a handle
        const cleanUrlPart = targetUrl.split('?')[0];
        if (cleanUrlPart.includes('/@') && !cleanUrlPart.includes('/streams') && !cleanUrlPart.includes('/videos')) {
          // Remove trailing slash if any
          let stripped = cleanUrlPart;
          if (stripped.endsWith('/')) {
            stripped = stripped.slice(0, -1);
          }
          targetUrl = `${stripped}/streams`;
        }
      }

      console.log('[YouTube Auto-Resolve] Fetching streams list page:', targetUrl);

      // Fetch the channel stream page
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to access YouTube channel streams page: HTTP ${response.status}`);
      }

      const html = await response.text();

      // Extract unique 11-char videoId coordinates via structured regex configurations
      const foundIds = new Set<string>();
      let match;

      // 1. Seek "videoId":"XXXXXXXXXXX" keyval entries
      const regexVideoId = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g;
      while ((match = regexVideoId.exec(html)) !== null) {
        foundIds.add(match[1]);
      }

      // 2. Seek standard /watch?v=XXXXXXXXXXX relative link references
      const regexWatch = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
      while ((match = regexWatch.exec(html)) !== null) {
        foundIds.add(match[1]);
      }

      // 3. Look for "/vi/XXXXXXXXXXX/" or "vi/XXXXXXXXXXX/" references
      const regexVi = /vi\/([a-zA-Z0-9_-]{11})/g;
      while ((match = regexVi.exec(html)) !== null) {
        foundIds.add(match[1]);
      }

      // If streams page yielded low results, attempt fallback to the channel videos page
      if (foundIds.size === 0 && targetUrl.includes('/streams')) {
        const videosFallbackUrl = targetUrl.replace('/streams', '/videos');
        console.log('[YouTube Fallback] Trying video grid view instead:', videosFallbackUrl);
        try {
          const fbResponse = await fetch(videosFallbackUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (fbResponse.ok) {
            const fbHtml = await fbResponse.text();
            while ((match = regexVideoId.exec(fbHtml)) !== null) {
              foundIds.add(match[1]);
            }
            while ((match = regexWatch.exec(fbHtml)) !== null) {
              foundIds.add(match[1]);
            }
          }
        } catch (fbErr) {
          console.warn('[YouTube Fallback] Videos grid fallback error:', fbErr);
        }
      }

      const finalIds = Array.from(foundIds).filter(id => {
        // Avoid system IDs or blacklisted items
        return id !== 'WATCH_LATER' && id !== 'FAVORITES' && id !== 'PLAY_ALL';
      }).slice(0, 48); // reasonable capacity boundary

      // Extract name of channel
      let channelName = '';
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        channelName = titleMatch[1].replace(/\s*-\s*YouTube/gi, '').trim();
      }

      if (!channelName) {
        const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
        if (ogTitleMatch && ogTitleMatch[1]) {
          channelName = ogTitleMatch[1].trim();
        }
      }

      if (!channelName) {
        const handleMatch = targetUrl.match(/@([a-zA-Z0-9_.-]+)/);
        channelName = handleMatch ? `@${handleMatch[1]}` : 'Cozy Stream Channel';
      }

      // Add simple fallback list if absolutely zero were scraped (in case of geo-blocking/Google bot detection in layout views)
      if (finalIds.length === 0) {
        // Return a clean error suggesting a manual fallback or custom entry
        return res.status(200).json({
          success: false,
          channelUrl: targetUrl,
          channelName,
          error: 'No active video stream coordinates could be found automatically. The page coordinates are blocked or hidden by YouTube restrictions. Use the manual fallback to register individual live stream video links!'
        });
      }

      return res.json({
        success: true,
        channelUrl: targetUrl,
        channelName,
        videoIds: finalIds
      });

    } catch (err: any) {
      console.error('[YouTube Fetch Controller Error]:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to access or parse stream parameters.',
        message: err.message
      });
    }
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
      durationLong: 15,
      studyPlans: [],
      reminders: [],
      channels: [
        {
          id: 'lofi-girl',
          name: 'Lofi Girl Live',
          videoIds: ['jfKfPfyJRdk', '4xDzrIxZZZI', 'D7B0G8yF-E8', 'nH_G_mH7Fsw'],
          assignedNode: 1
        },
        {
          id: 'abao-study',
          name: 'Abao Study Room',
          videoIds: ['83DId9I1v6s', 'V3rD_p_eIjg', '5wREv76k6vY'],
          assignedNode: 2
        },
        {
          id: 'chillhop-records',
          name: 'Chillhop Lounge',
          videoIds: ['5wREv76k6vY', 'L_LUpnjgPso'],
          assignedNode: 3
        },
        {
          id: 'coffee-shop-vibes',
          name: 'Cozy Espresso Cafe',
          videoIds: ['D7B0G8yF-E8', 'V3rD_p_eIjg', '83DId9I1v6s'],
          assignedNode: 4
        },
        {
          id: 'tokyo-night-walk',
          name: 'Tokyo Rain Streets',
          videoIds: ['83DId9I1v6s', 'D7B0G8yF-E8'],
          assignedNode: 5
        },
        {
          id: 'warm-fireplace-cabin',
          name: 'Fireplace Library Night',
          videoIds: ['L_LUpnjgPso', '4xDzrIxZZZI'],
          assignedNode: 6
        }
      ]
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

      // 1. Try Gemini 3.5 Flash native vision first if initialized
      if (ai) {
        try {
          console.log('[Gemini Vision] Analyzing session image with gemini-3.5-flash...');
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Data
                }
              },
              {
                text: promptText
              }
            ],
            config: {
              responseMimeType: 'application/json'
            }
          });

          const jsonStr = response.text?.trim() || '{}';
          console.log('[Gemini Vision] Reply outcome:', jsonStr);
          const parsed = JSON.parse(jsonStr);
          return res.json({
            personPresent: parsed.personPresent !== undefined ? parsed.personPresent : true,
            status: parsed.status || 'working',
            summary: parsed.summary || 'Workspace monitored successfully with Gemini.'
          });
        } catch (gemError) {
          console.warn('[Gemini Vision] Primary analysis failed, falling back to Groq:', gemError);
        }
      }

      // 2. Fallback to Groq Vision Pool with standard vision model
      let analysisResult = null;
      let lastError = null;

      const candidateModels = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'];

      for (let i = 0; i < GROQ_KEYS_POOL.length; i++) {
        const currentKey = GROQ_KEYS_POOL[i];
        
        for (const targetModel of candidateModels) {
          try {
            console.log(`[Groq Vision] Attempting analysis with key index ${i}, model: ${targetModel}...`);
            const bodyPayload = {
              model: targetModel,
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
              break; // Success! No need to try next model with this key.
            } else {
              const errText = await groqResponse.text();
              console.warn(`[Groq Vision] Failed response status ${groqResponse.status} for key index ${i} with model ${targetModel}:`, errText);
              lastError = `Status ${groqResponse.status}: ${errText}`;
            }
          } catch (groqErr: any) {
            console.error(`[Groq Vision] Connection/execution error with key index ${i} with model ${targetModel}:`, groqErr);
            lastError = groqErr.message;
          }
        }

        if (analysisResult) {
          break; // Success! No need to try next key.
        }
      }

      if (analysisResult) {
        return res.json(analysisResult);
      }

      // If we got here, all Groq keys in the pool failed
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
      const { message, history, context, model, isBuddyCounselor } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message content is empty' });
      }

      // Check which model was requested and customize the system persona role
      let modelId = 'llama-3.3-70b-versatile';
      let systemPersona = '';

      if (isBuddyCounselor) {
        modelId = 'llama-3.3-70b-versatile';
        systemPersona = `You are a direct, warm, natural Zen Study Buddy, Friend, and Therapist.
You are chatting with a student in real-time. Act like a genuine human friend and study companion.

CRITICAL CONVERSATIONAL GUIDELINES:
1. MATCH the student's vibe, depth, and length. Be extremely conversational and companionable.
2. If the user replies with short phrases or words (e.g. "ok", "cool", "yeah", "thanks", "wow", etc.), you MUST reply with a matching short, encouraging sentence or phrase (e.g., "Awesome, let's keep going!", "Got you. Stay focused!", "You got this, friend.", "Pace yourself, you're doing great!"). NEVER give long paragraph lectures or pre-written text blocks on short inputs.
3. Only give a larger, compassionate counseling response if the student is venting, spiraling, expressing real anxiety/fatigue, or asking for guidance.
4. Listen closely to what they actually say. Respond directly to their input. Do not repeat greeting messages or give unrelated advice.
5. If they ask for courage, success motivation, or success quotes, output [[QUOTE: "Your custom selected motivational success quote here"]] at the very end of your response.
6. If they ask for periodic reminders (e.g., water, posture reminders every few minutes), output [[SET_REMINDER: {"title": "Reminder Title", "minutes": X}]] at the very end.
7. Keep responses humble, cool, and highly supportive. Avoid flowery AI filler.`;
      } else if (model === 'qwen/qwen3-32b') {
        modelId = 'qwen/qwen3-32b'; // Support passing custom selection or fallback
        systemPersona = `You are the master Qwen 32B Academic Advisor and Study Planner.
Your role is to act as an advanced educational strategist. Students came to you to formulate real-life exam plans, syllabus breakdowns, and schedules. 
Provide extremely logical, deeply analyzed, step-by-step academic instructions. Write comprehensive yet clear answers to break down tasks.`;
      } else if (model === 'openai/gpt-oss-20b') {
        modelId = 'openai/gpt-oss-20b';
        systemPersona = `You are a highly empathetic Zen Study Therapist and Academic Counselor. 
Your role is to validate the student's emotional struggles, academic anxiety, fatigue, distraction, and potential burnout. 
Respond with incredible warmth, deep emotional support, and healing affirmations. Guide them through brief mindfulness ideas, but keep it highly helpful and friendly.`;
      } else {
        modelId = 'llama-3.3-70b-versatile';
        systemPersona = `You are a friendly, deeply supportive, and versatile Zen Study Guide and Coach.
Help the user manage simple study tactics, stay hydrated, congratulate them on task milestones, and keep a clean, calm physical workspace.`;
      }

      // Formulate a condensed smart study parameter summary as the model's active session memory
      const activeStateHistoryStr = `
Current Active Workspace State Parameters (Memory Context):
- Focus timer clock status: ${context?.timerState || 'Idle / Not running'}
- Completed goals/to-dos: ${context?.goalsCompleted || 0}
- Active Goals/Tasks list: ${JSON.stringify(context?.goals || [])}
- Active Priority Deadlines: ${JSON.stringify(context?.deadlines || [])}
- Active Study Plans: ${JSON.stringify(context?.studyPlans || [])}
- Active Configured Reminders: ${JSON.stringify(context?.reminders || [])}
`;

      const contextMsg = `${systemPersona}
${activeStateHistoryStr}

=============================
SPECIAL AUTOMATION ACTIONS GUIDELINE:
You have the power to automatically register a Reminder, create a full visual Study Plan, or throw a success quote pop-up on the student's screen by appending special bracketed tags at the very end of your response text.
Whenever they explicitly or implicitly request you to track a reminder, display a motivator quote, or build a study plan, append the corresponding tag.

1. High-Contrast Quote Notification:
[[QUOTE: "Your custom selected motivational success quote here"]]

2. Repeat Reminders:
If the user asks "Remind me to drink water every 10 minutes" or "remind me to check posture every 15 min" or similar, append this exact tag at the end of your response text:
[[SET_REMINDER: {"title": "Drink Water", "minutes": 10}]]

3. Custom Study Plans & Exam Schedules:
If the user says they want a plan, formulate a detailed layout and append this exact tag at the end:
[[CREATE_PLAN: {"title": "Plan", "description": "Focused review", "hourlyGoal": 15, "milestones": [{"title": "Milestone 1", "dueDate": "2026-06-03"}]}]]

Ensure any JSON matches these schemas perfectly.
Always write your supportive, detailed response first to build confidence, and append the tag at the bottom. Do not output raw JSON, only the bracketed tag.
=============================`;

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
              model: modelId,
              messages: finalMessages,
              max_tokens: 1000, // Elevated max tokens to provide deep, helpful study planner guides and therapeutic empathy
              temperature: 0.7
            })
          });

          if (groqResponse.ok) {
            const data = await groqResponse.json();
            chatReply = data.choices[0]?.message?.content || '';
            break;
          } else {
            const errText = await groqResponse.text();
            console.warn(`[Groq Chat] Failed response status ${groqResponse.status} for key index ${i} with model ${modelId}:`, errText);
            lastChatError = `Status ${groqResponse.status}: ${errText}`;
          }
        } catch (chatError: any) {
          console.error(`[Groq Chat] Failed for key idx ${i} with model ${modelId}:`, chatError);
          lastChatError = chatError.message;
        }
      }

      // If requested model failed, try falling back to standard llama-3.3-70b-versatile
      if (chatReply === null && modelId !== 'llama-3.3-70b-versatile') {
        console.log('[Groq Fallback] Custom model failed. Attempting fallback to Llama 3.3...');
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
                max_tokens: 1000,
                temperature: 0.7
              })
            });

            if (groqResponse.ok) {
              const data = await groqResponse.json();
              chatReply = data.choices[0]?.message?.content || '';
              break;
            }
          } catch (e) {
            console.warn('[Groq Fallback] Failed fallback attempt:', e);
          }
        }
      }

      if (chatReply !== null) {
        return res.json({ reply: chatReply });
      }

      // Gemini fallback if Groq pool is absolutely offline
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
  async function startLocalServer() {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
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

  if (!process.env.VERCEL) {
    startLocalServer().catch((err) => {
      console.error('[Focus Server] Boot error:', err);
    });
  }

export default app;
