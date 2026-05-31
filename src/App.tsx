/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  CloudRain, 
  Trees, 
  Flame, 
  Coffee, 
  Volume1, 
  Volume2, 
  VolumeX, 
  Youtube, 
  X, 
  AlertCircle, 
  Clock, 
  Sliders,
  Tv,
  Check,
  Sparkles,
  ExternalLink,
  Target,
  Plus,
  Trash2,
  Monitor,
  Camera,
  Brain,
  Video,
  BellRing,
  Eye,
  LayoutGrid,
  Calendar,
  Grid,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  User,
  Sparkle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Modular Workspace Component Imports
import { Goal, SyllabusItem, Deadline, FocusSessionLog, HeatMapConfig } from './types';
import HeatMap from './components/HeatMap';
import CalendarDeadlines from './components/CalendarDeadlines';
import SyllabusManager from './components/SyllabusManager';
import AICoachChat from './components/AICoachChat';
import FloatingCamera from './components/FloatingCamera';
import BackgroundGrid from './components/BackgroundGrid';
import { zenAudioSynthInstance } from './lib/audioSynth';

// CURATED PRESETS
const STUDY_STREAMS = [
  { id: '4xDzrIxZZZI', name: 'Cozy Library' },
  { id: '83DId9I1v6s', name: 'Rainy Tokyo' },
  { id: '5wREv76k6vY', name: 'Night Train' },
  { id: 'jfKfPfyJRdk', name: 'Lofi Girl' },
  { id: 'V3rD_p_eIjg', name: 'Paris Cafe' },
  { id: 'L_LUpnjgPso', name: 'Fireplace Cabin' },
];

const SOUNDS = [
  { id: 'rain', name: 'Rain on Roof', icon: CloudRain, url: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Summer_rain.mp3' },
  { id: 'forest', name: 'Forest Birds', icon: Trees, url: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/A_forest_bird_singing.ogg' },
  { id: 'fireplace', name: 'Crackling Fire', icon: Flame, url: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Fireplace_crackling.ogg' },
  { id: 'cafe', name: 'Espresso Cafe', icon: Coffee, url: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Coffee_shop_ambiance.ogg' },
];

const CHIME_URL = 'https://raw.githubusercontent.com/rafaelcondal/pomodoro/master/public/sounds/bell.mp3';

// Extract 11-character YouTube video ID safely from anywhere
function extractYouTubeId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  // Check for common watch?v= URL pattern
  if (trimmed.includes('v=')) {
    const parts = trimmed.split('v=');
    if (parts[1]) {
      const id = parts[1].split('&')[0];
      if (id.length === 11) return id;
    }
  }
  // Check for youtu.be/ shortened pattern
  if (trimmed.includes('youtu.be/')) {
    const parts = trimmed.split('youtu.be/');
    if (parts[1]) {
      const id = parts[1].split('?')[0];
      if (id.length === 11) return id;
    }
  }
  // Check for embedUrl pattern
  if (trimmed.includes('embed/')) {
    const parts = trimmed.split('embed/');
    if (parts[1]) {
      const id = parts[1].split('?')[0];
      if (id.length === 11) return id;
    }
  }
  return trimmed;
}

type TimerMode = 'focus' | 'short' | 'long';
type AppView = 'atmosphere' | 'dashboard';

export default function App() {
  // Authentication & Synced User profile states
  const [user, setUser] = useState<{ username: string; joinedAt: string } | null>(() => {
    try {
      const stored = localStorage.getItem('aesthetic-room:user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState<'none' | 'login' | 'register'>('none');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Primary Workspace Perspective Toggles
  const [activeView, setActiveView] = useState<AppView>('atmosphere');

  // Sidebar drawers and Mixer collapses
  const [isGoalsOpen, setIsGoalsOpen] = useState<boolean>(() => {
    return localStorage.getItem('aesthetic-room:is-goals-open') !== 'false';
  });
  const [isMonitorPanelOpen, setIsMonitorPanelOpen] = useState<boolean>(() => {
    return localStorage.getItem('aesthetic-room:is-monitor-panel-open') !== 'false';
  });
  const [isBottomBarOpen, setIsBottomBarOpen] = useState<boolean>(() => {
    return localStorage.getItem('aesthetic-room:is-bottom-bar-open') !== 'false';
  });

  // Focus Timer Parameters
  const [activeTimerMode, setActiveTimerMode] = useState<TimerMode>('focus');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [durationFocus, setDurationFocus] = useState<number>(() => {
    const saved = localStorage.getItem('aesthetic-room:duration-focus');
    return saved ? Number(saved) : 25;
  });
  const [durationShort, setDurationShort] = useState<number>(() => {
    const saved = localStorage.getItem('aesthetic-room:duration-short');
    return saved ? Number(saved) : 5;
  });
  const [durationLong, setDurationLong] = useState<number>(() => {
    const saved = localStorage.getItem('aesthetic-room:duration-long');
    return saved ? Number(saved) : 15;
  });
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);

  // Multi-video Background state links (Holds up to 6 custom YouTube links or IDs)
  const [gridVideos, setGridVideos] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('aesthetic-room:grid-videos');
      return saved ? JSON.parse(saved) : [
        '4xDzrIxZZZI',
        '83DId9I1v6s',
        '5wREv76k6vY',
        'jfKfPfyJRdk',
        'V3rD_p_eIjg',
        'L_LUpnjgPso'
      ];
    } catch {
      return ['4xDzrIxZZZI', '83DId9I1v6s', '5wREv76k6vY', 'jfKfPfyJRdk', 'V3rD_p_eIjg', 'L_LUpnjgPso'];
    }
  });
  const [activeGridCount, setActiveGridCount] = useState<number>(() => {
    const saved = localStorage.getItem('aesthetic-room:active-grid-count');
    return saved ? Number(saved) : 4;
  });
  const [bgOpacity, setBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('aesthetic-room:bg-opacity');
    return saved ? Number(saved) : 30;
  });

  // Core synchronized/localStorage stored datasets
  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('aesthetic-room:goals');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newGoalText, setNewGoalText] = useState('');

  const [deadlines, setDeadlines] = useState<Deadline[]>(() => {
    try {
      const saved = localStorage.getItem('aesthetic-room:deadlines');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [syllabusList, setSyllabusList] = useState<SyllabusItem[]>(() => {
    try {
      const saved = localStorage.getItem('aesthetic-room:syllabus-list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sessionLogs, setSessionLogs] = useState<FocusSessionLog[]>(() => {
    try {
      const saved = localStorage.getItem('aesthetic-room:session-logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [heatMapConfig, setHeatMapConfig] = useState<HeatMapConfig>(() => {
    try {
      const saved = localStorage.getItem('aesthetic-room:heatmap-config');
      return saved ? JSON.parse(saved) : {
        palette: 'monochrome',
        viewRange: 'month'
      };
    } catch {
      return { palette: 'monochrome', viewRange: 'month' };
    }
  });

  // Camera capture flag (actual streams handles elegantly in the Floating overlay)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(() => {
    return localStorage.getItem('aesthetic-room:is-camera-active') === 'true';
  });

  // Interactive Sandboxed Screen-Notebook Canvas
  const [notepadText, setNotepadText] = useState<string>(() => {
    return localStorage.getItem('aesthetic-room:notepad-text') || 
      `/* FOCUS ACTIVE - MY WORKSPACE NOTES */\n\n- Working on Double Integrals formulas.\n- Review properties: order of integration changes.\n- Submit response worksheet before Monday.`;
  });
  const [notebookTitle, setNotebookTitle] = useState<string>(() => {
    return localStorage.getItem('aesthetic-room:notebook-title') || 'Study Notepad Canvas';
  });
  const [isNotepadMinimized, setIsNotepadMinimized] = useState<boolean>(() => {
    const saved = localStorage.getItem('aesthetic-room:is-notepad-minimized');
    return saved ? saved === 'true' : true;
  });
  const notepadContainerRef = useRef<HTMLDivElement>(null);

  // Zen chatbot saved messages history
  const [chatMessages, setChatMessages] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('aesthetic-room:chat-history');
      return stored ? JSON.parse(stored) : [
        { role: 'assistant', content: 'Greeting student. I am your Zen Study Assistant on Groq. Ask any question, track hydration limits, or ask me when to stretch!' }
      ];
    } catch {
      return [
        { role: 'assistant', content: 'Greeting student. I am your Zen Study Assistant on Groq. Ask any question, track hydration limits, or ask me when to stretch!' }
      ];
    }
  });

  // Vision observer controls
  const [isAiMonitorActive, setIsAiMonitorActive] = useState<boolean>(true);
  const [aiAnalysisStatus, setAiAnalysisStatus] = useState<string>('idle');
  const [aiAnalysisSummary, setAiAnalysisSummary] = useState<string>('Dormant focus. Write notes on notepad or start camera.');
  const [isPersonPresent, setIsPersonPresent] = useState<boolean>(true);
  const [awayTimeLeft, setAwayTimeLeft] = useState<number>(300);
  const [isAlarmActive, setIsAlarmActive] = useState<boolean>(false);
  const [lastAiCheck, setLastAiCheck] = useState<string>('');
  const [aiCheckInterval, setAiCheckInterval] = useState<number>(() => {
    const saved = localStorage.getItem('aesthetic-room:ai-check-interval');
    return saved ? Number(saved) : 60;
  }); // in seconds, default to 1 minute (60s)

  // Config settings panel drawer
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Ambient Mixer state
  const [ambientVolumes, setAmbientVolumes] = useState<{ [key: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('aesthetic-room:ambient-volumes');
      return saved ? JSON.parse(saved) : {
        rain: 0,
        forest: 0,
        fireplace: 0,
        cafe: 0
      };
    } catch {
      return { rain: 0, forest: 0, fireplace: 0, cafe: 0 };
    }
  });

  const [isSynthMode, setIsSynthMode] = useState<boolean>(() => {
    return localStorage.getItem('aesthetic-room:is-synth-mode') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('aesthetic-room:is-synth-mode', String(isSynthMode));
  }, [isSynthMode]);

  // Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState('');

  // Audio refs
  const audioElementsRef = useRef<{ [key: string]: HTMLAudioElement }>({});
  const chimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const playPromisesRef = useRef<{ [key: string]: Promise<void> | null }>({});

  // Automatic localStorage state persistence effects
  useEffect(() => {
    localStorage.setItem('aesthetic-room:is-goals-open', String(isGoalsOpen));
  }, [isGoalsOpen]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:is-monitor-panel-open', String(isMonitorPanelOpen));
  }, [isMonitorPanelOpen]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:is-bottom-bar-open', String(isBottomBarOpen));
  }, [isBottomBarOpen]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:duration-focus', String(durationFocus));
  }, [durationFocus]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:duration-short', String(durationShort));
  }, [durationShort]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:duration-long', String(durationLong));
  }, [durationLong]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:grid-videos', JSON.stringify(gridVideos));
    if (user) {
      syncWorkspaceDataSave({ backgroundVideoIds: gridVideos });
    }
  }, [gridVideos, user]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:active-grid-count', String(activeGridCount));
  }, [activeGridCount]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:bg-opacity', String(bgOpacity));
  }, [bgOpacity]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:deadlines', JSON.stringify(deadlines));
  }, [deadlines]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:syllabus-list', JSON.stringify(syllabusList));
  }, [syllabusList]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:session-logs', JSON.stringify(sessionLogs));
    if (user) {
      syncWorkspaceDataSave({ sessionLogs });
    }
  }, [sessionLogs, user]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:heatmap-config', JSON.stringify(heatMapConfig));
  }, [heatMapConfig]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:is-camera-active', String(isCameraActive));
  }, [isCameraActive]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:notepad-text', notepadText);
  }, [notepadText]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:notebook-title', notebookTitle);
  }, [notebookTitle]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:is-notepad-minimized', String(isNotepadMinimized));
  }, [isNotepadMinimized]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:ai-check-interval', String(aiCheckInterval));
  }, [aiCheckInterval]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:ambient-volumes', JSON.stringify(ambientVolumes));
  }, [ambientVolumes]);

  // Trigger Toast Helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Sound chime helpers
  const playCompletionChime = () => {
    try {
      if (!chimeAudioRef.current) {
        chimeAudioRef.current = new Audio(CHIME_URL);
      }
      chimeAudioRef.current.volume = 0.55;
      chimeAudioRef.current.play().catch(() => {});
    } catch {}
  };

  // Clock ticks
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setLocalTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const sub = setInterval(updateTime, 1000);
    return () => clearInterval(sub);
  }, []);

  // Sync state variables across timer segments
  useEffect(() => {
    const mins = activeTimerMode === 'focus' ? durationFocus : activeTimerMode === 'short' ? durationShort : durationLong;
    setTimeLeft(mins * 60);
  }, [activeTimerMode]);

  useEffect(() => {
    if (!isRunning) {
      const mins = activeTimerMode === 'focus' ? durationFocus : activeTimerMode === 'short' ? durationShort : durationLong;
      setTimeLeft(mins * 60);
    }
  }, [durationFocus, durationShort, durationLong]);

  // Main timer tick implementation
  useEffect(() => {
    let sub: any = null;
    if (isRunning) {
      sub = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            playCompletionChime();
            triggerToast(`Session complete! Logged focus minutes to your heat map.`);
            
            // Record focus log to heat map
            const todayStr = new Date().toISOString().split('T')[0];
            setSessionLogs((prevLogs) => {
              const matchedLogIdx = prevLogs.findIndex((l) => l.date === todayStr);
              if (matchedLogIdx !== -1) {
                const updated = [...prevLogs];
                updated[matchedLogIdx] = {
                  ...updated[matchedLogIdx],
                  durationMinutes: updated[matchedLogIdx].durationMinutes + durationFocus
                };
                return updated;
              } else {
                return [
                  ...prevLogs,
                  { date: todayStr, durationMinutes: durationFocus, goalsCompleted: 0, checklistItemsCompleted: 0 }
                ];
              }
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(sub);
  }, [isRunning, activeTimerMode, durationFocus]);

  // Ambient track volume controls
  useEffect(() => {
    if (isSynthMode) {
      // 1. Pause any playing standard audio elements to prevent overlap
      SOUNDS.forEach((snd) => {
        const item = audioElementsRef.current[snd.id];
        if (item && !item.paused) {
          item.pause();
        }
      });
      // 2. Play using Web Audio Synthesizer
      SOUNDS.forEach((snd) => {
        const vol = ambientVolumes[snd.id] || 0;
        zenAudioSynthInstance.setVolume(snd.id, vol);
      });
    } else {
      // 1. Mute all synthesizer sounds to prevent overlap
      SOUNDS.forEach((snd) => {
        zenAudioSynthInstance.setVolume(snd.id, 0);
      });
      // 2. Play using standard Audio elements
      SOUNDS.forEach((snd) => {
        const vol = ambientVolumes[snd.id] || 0;
        let item = audioElementsRef.current[snd.id];
        if (!item) {
          item = new Audio(snd.url);
          item.loop = true;
          audioElementsRef.current[snd.id] = item;
        }
        
        if (vol > 0) {
          item.muted = false;
          item.volume = vol / 100;
          if (item.paused && !playPromisesRef.current[snd.id]) {
            const playPromise = item.play();
            playPromisesRef.current[snd.id] = playPromise;
            playPromise
              .then(() => {
                playPromisesRef.current[snd.id] = null;
              })
              .catch((err) => {
                playPromisesRef.current[snd.id] = null;
                if (err.name !== 'AbortError') {
                  console.warn(`Autoplay restriction or audio failure for track ${snd.name}:`, err);
                }
              });
          }
        } else {
          item.muted = true;
          item.volume = 0;
          const activePromise = playPromisesRef.current[snd.id];
          if (activePromise) {
            activePromise
              .then(() => {
                item.pause();
              })
              .catch(() => {
                item.pause();
              });
          } else {
            item.pause();
          }
        }
      });
    }
  }, [ambientVolumes, isSynthMode]);

  // Handle ultimate audio teardown cleanups ONLY on absolute app unmount
  useEffect(() => {
    return () => {
      SOUNDS.forEach((snd) => {
        const item = audioElementsRef.current[snd.id];
        if (item && !item.paused) {
          item.pause();
        }
      });
      zenAudioSynthInstance.destroy();
    };
  }, []);

  // Scheduled Image Analysis with fallbacks
  useEffect(() => {
    let sub: any = null;
    if (isAiMonitorActive) {
      // Run once immediately on activation or mount
      runWorkspaceVisionCheck();
      
      sub = setInterval(() => {
        runWorkspaceVisionCheck();
      }, aiCheckInterval * 1000);
    }
    return () => {
      if (sub) clearInterval(sub);
    };
  }, [isAiMonitorActive, aiCheckInterval]);

  // Capture frame of the Notepad canvas layout or webcams as visual proxy screenshot
  const runWorkspaceVisionCheck = async () => {
    setAiAnalysisStatus('loading');
    
    // Fallback Mock representation: Render canvas visually
    let visualBase64 = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monaco, monospace';
        ctx.fillText(`Workspace Notebook Snapshot`, 20, 40);
        ctx.fillText(`User: ${user?.username || 'Guest student'}`, 20, 70);
        ctx.fillText(`Timer status: ${isRunning ? 'Running' : 'Paused'}`, 20, 100);
        
        ctx.fillStyle = '#8a8a8a';
        ctx.fillText(`Active notes: ${notepadText.substring(0, 40)}...`, 20, 140);
        visualBase64 = canvas.toDataURL('image/jpeg', 0.82);
      }
    } catch {}

    const pendingGoal = goals.find(g => !g.completed)?.text || 'General Work Focus';

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: visualBase64,
          mode: 'screen',
          goal: pendingGoal
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiAnalysisStatus(data.status || 'working');
        setAiAnalysisSummary(data.summary || 'Diligent workspace progress monitored successfully.');
        setLastAiCheck(new Date().toLocaleTimeString());
        
        if (data.personPresent === false) {
          setIsPersonPresent(false);
          if (isRunning) {
            setIsRunning(false); // pause clock loops
            triggerToast('Workspace absent detected! Focus timer paused automatically.');
          }
        } else {
          setIsPersonPresent(true);
        }
      }
    } catch {
      setAiAnalysisStatus('error');
      setAiAnalysisSummary('AI key configuration offline. Tracking sandbox checks safe.');
    }
  };

  // Setup camera streams
  const handleToggleCamera = () => {
    const nextState = !isCameraActive;
    setIsCameraActive(nextState);
    if (nextState) {
      triggerToast('Cameras launched on floating preview panel!');
    } else {
      triggerToast('Cameras offline.');
    }
  };

  // Sync state data load and save from express backend
  const syncWorkspaceDataSave = async (stateToSave: any) => {
    if (!user) return;
    try {
      await fetch('/api/sync/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          state: stateToSave
        })
      });
    } catch {}
  };

  // Synchronize and load profile on page mount or username change
  useEffect(() => {
    async function loadSyncedWorkspace() {
      if (!user) return;
      try {
        const response = await fetch('/api/sync/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user.username })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.state) {
            if (data.state.goals !== undefined) setGoals(data.state.goals);
            if (data.state.syllabusList !== undefined) setSyllabusList(data.state.syllabusList);
            if (data.state.deadlines !== undefined) setDeadlines(data.state.deadlines);
            if (data.state.sessionLogs !== undefined) setSessionLogs(data.state.sessionLogs);
            if (data.state.heatMapConfig !== undefined) setHeatMapConfig(data.state.heatMapConfig);
            if (data.state.durationFocus !== undefined) setDurationFocus(data.state.durationFocus);
            if (data.state.durationShort !== undefined) setDurationShort(data.state.durationShort);
            if (data.state.durationLong !== undefined) setDurationLong(data.state.durationLong);
            if (data.state.backgroundVideoIds !== undefined) setGridVideos(data.state.backgroundVideoIds);
            if (data.state.chatMessages !== undefined) setChatMessages(data.state.chatMessages);
          }
        }
      } catch (err) {
        console.warn('Could not sync workspace with cloud server:', err);
      }
    }
    loadSyncedWorkspace();
  }, [user?.username]);

  // Database Auths (Register & Login)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authUsername.trim() || !authPassword) {
      setAuthError('Please fill in both credential coordinates.');
      return;
    }

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error || 'Connection failed.');
        return;
      }

      // Success
      const profile = { username: data.username, joinedAt: data.joinedAt };
      setUser(profile);
      localStorage.setItem('aesthetic-room:user', JSON.stringify(profile));
      
      // Load user states returned on login
      if (data.state) {
        setGoals(data.state.goals || []);
        setSyllabusList(data.state.syllabusList || []);
        setDeadlines(data.state.deadlines || []);
        setSessionLogs(data.state.sessionLogs || []);
        if (data.state.heatMapConfig) setHeatMapConfig(data.state.heatMapConfig);
        setDurationFocus(data.state.durationFocus || 25);
        setDurationShort(data.state.durationShort || 5);
        setDurationLong(data.state.durationLong || 15);
        if (data.state.backgroundVideoIds !== undefined) setGridVideos(data.state.backgroundVideoIds);
      }

      setAuthMode('none');
      setAuthUsername('');
      setAuthPassword('');
      triggerToast(`Welcome back, ${data.username}! Workspace synchronized.`);
    } catch {
      setAuthError('Connection failed.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('aesthetic-room:user');
    triggerToast('Logged out of synchronized profile.');
  };

  const handleClearMockData = () => {
    if (confirm("Are you sure you want to clear all mock items from your account and start tracking your real life progress with an elegant, clean sheet?")) {
      const cleanGoals: Goal[] = [];
      const cleanDeadlines: Deadline[] = [];
      const cleanSyllabus: SyllabusItem[] = [];
      const cleanLogs: FocusSessionLog[] = [];
      
      setGoals(cleanGoals);
      setDeadlines(cleanDeadlines);
      setSyllabusList(cleanSyllabus);
      setSessionLogs(cleanLogs);
      
      // Also clean up localStorage chat history
      setChatMessages([
        { role: 'assistant', content: 'Greeting student. I am your Zen Study Assistant on Groq. Ask any question!' }
      ]);
      localStorage.removeItem('aesthetic-room:chat-history');

      syncWorkspaceDataSave({
        goals: cleanGoals,
        deadlines: cleanDeadlines,
        syllabusList: cleanSyllabus,
        sessionLogs: cleanLogs,
        chatMessages: [
          { role: 'assistant', content: 'Greeting student. I am your Zen Study Assistant on Groq. Ask any question!' }
        ]
      });
      triggerToast("Mock statistics and progress items wiped successfully!");
    }
  };

  const handleSaveChatMessages = (msgs: any[]) => {
    setChatMessages(msgs);
    localStorage.setItem('aesthetic-room:chat-history', JSON.stringify(msgs));
    syncWorkspaceDataSave({ chatMessages: msgs });
  };

  // Trigger state updates with auto save on change
  const handleAddSyllabus = (name: string, type: 'pdf' | 'image' | 'link', sourceUrl: string) => {
    const next = [...syllabusList, { id: Date.now().toString(), name, type, sourceUrl, addedAt: new Date().toISOString() }];
    setSyllabusList(next);
    syncWorkspaceDataSave({ syllabusList: next });
    triggerToast('Syllabus material pinned.');
  };

  const handleDeleteSyllabus = (id: string) => {
    const next = syllabusList.filter((s) => s.id !== id);
    setSyllabusList(next);
    syncWorkspaceDataSave({ syllabusList: next });
  };

  const handleAddDeadline = (title: string, date: string, priority: 'low' | 'medium' | 'high') => {
    const next = [...deadlines, { id: Date.now().toString(), title, date, priority, completed: false }];
    setDeadlines(next);
    syncWorkspaceDataSave({ deadlines: next });
    triggerToast('New priority deadline scheduled.');
  };

  const handleToggleDeadline = (id: string) => {
    let completedCountDelta = 0;
    const next = deadlines.map(d => {
      if (d.id === id) {
        completedCountDelta = !d.completed ? 1 : -1;
        return { ...d, completed: !d.completed };
      }
      return d;
    });
    setDeadlines(next);
    syncWorkspaceDataSave({ deadlines: next });

    // Instantly sync with heat map session logs!
    const todayStr = new Date().toISOString().split('T')[0];
    setSessionLogs((prevLogs) => {
      const matchIdx = prevLogs.findIndex((l) => l.date === todayStr);
      if (matchIdx !== -1) {
        const updated = [...prevLogs];
        const prevGoalsCount = updated[matchIdx].goalsCompleted || 0;
        updated[matchIdx] = {
          ...updated[matchIdx],
          goalsCompleted: Math.max(0, prevGoalsCount + completedCountDelta)
        };
        return updated;
      } else {
        return [
          ...prevLogs,
          { date: todayStr, durationMinutes: 0, goalsCompleted: Math.max(0, completedCountDelta), checklistItemsCompleted: 0 }
        ];
      }
    });

    if (completedCountDelta > 0) {
      triggerToast('Reflected completed deadline on your Heat Map!');
    }
  };

  const handleDeleteDeadline = (id: string) => {
    const next = deadlines.filter(d => d.id !== id);
    setDeadlines(next);
    syncWorkspaceDataSave({ deadlines: next });
  };

  const handleAddGoal = (e: FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    const next = [...goals, { id: Date.now().toString(), text: newGoalText.trim(), completed: false }];
    setGoals(next);
    setNewGoalText('');
    syncWorkspaceDataSave({ goals: next });
    triggerToast('New focus target added!');
  };

  const handleToggleGoal = (id: string) => {
    let completedCountDelta = 0;
    const next = goals.map(g => {
      if (g.id === id) {
        completedCountDelta = !g.completed ? 1 : -1;
        return { ...g, completed: !g.completed };
      }
      return g;
    });
    setGoals(next);
    syncWorkspaceDataSave({ goals: next });

    // Instantly sync with heat map session logs!
    const todayStr = new Date().toISOString().split('T')[0];
    setSessionLogs((prevLogs) => {
      const matchIdx = prevLogs.findIndex((l) => l.date === todayStr);
      if (matchIdx !== -1) {
        const updated = [...prevLogs];
        const prevGoalsCount = updated[matchIdx].goalsCompleted || 0;
        updated[matchIdx] = {
          ...updated[matchIdx],
          goalsCompleted: Math.max(0, prevGoalsCount + completedCountDelta)
        };
        return updated;
      } else {
        return [
          ...prevLogs,
          { date: todayStr, durationMinutes: 0, goalsCompleted: Math.max(0, completedCountDelta), checklistItemsCompleted: 0 }
        ];
      }
    });

    if (completedCountDelta > 0) {
      triggerToast('Reflected target check-off on your Heat Map!');
    }
  };

  const handleDeleteGoal = (id: string) => {
    const next = goals.filter(g => g.id !== id);
    setGoals(next);
    syncWorkspaceDataSave({ goals: next });
  };

  const formatTimeSeconds = (totalS: number): string => {
    const h = Math.floor(totalS / 3600);
    const m = Math.floor((totalS % 3600) / 60);
    const s = totalS % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 font-sans text-white overflow-x-hidden selection:bg-white/20">
      
      {/* 1. Curated Multigrid Atmosphere Background Stream Layout */}
      <BackgroundGrid gridVideos={gridVideos} activeGridCount={activeGridCount} />

      {/* 2. Sleek Glass Foreground Layer - Removed backdrop-blur overlay to give user flawless crystal clear footage */}
      <div className={`relative z-10 min-h-screen flex flex-col px-4 py-3 sm:px-6 bg-transparent transition-all duration-500 ${
        isRunning ? 'justify-center items-center' : 'justify-between'
      }`}>
        
        {/* TOP COMPACT TITLE ROW & AUTHS NAVIGATION - Elegant auto-fade during active focus countdown */}
        <header className={`w-full max-w-7xl mx-auto flex items-center justify-between gap-4 border-b border-white/10 pb-3 mb-4 transition-all duration-500 ${
          isRunning ? 'opacity-0 pointer-events-none h-0 p-0 m-0 overflow-hidden border-none' : 'opacity-100'
        }`}>
          <div className="flex items-center gap-3">
            <Sparkle className="w-5 h-5 text-neutral-300 animate-spin" style={{ animationDuration: '6s' }} />
            <div>
              <h1 className="text-sm font-space font-semibold tracking-widest text-[#eeeeee]">STUDY WITH ME</h1>
              <p className="text-[10px] text-gray-500 font-mono">Workspace Sync Center</p>
            </div>
          </div>

          {/* Perspective Selector Toggles */}
          <div className="flex items-center space-x-2 bg-black/40 border border-white/10 p-1.5 rounded-xl text-xs">
            <button
              onClick={() => setActiveView('atmosphere')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'atmosphere' 
                  ? 'bg-neutral-100 text-black font-semibold' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cozy Workspace</span>
            </button>
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'dashboard' 
                  ? 'bg-neutral-100 text-black font-semibold' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Planner & Stats</span>
            </button>
          </div>

          {/* Local User Credentials Widget */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2.5 bg-black/55 border border-white/10 px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-mono font-medium truncate max-w-[96px]" title={user.username}>{user.username}</span>
                <span className="text-[#333] font-mono text-[10px]">|</span>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex bg-black/40 border border-white/10 rounded-xl p-0.5">
                <button
                  onClick={() => setAuthMode('login')}
                  className="px-2.5 py-1 text-xs text-gray-400 hover:text-white rounded-lg pl-3 pr-3 transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <span className="border-r border-white/10 my-1"></span>
                <button
                  onClick={() => setAuthMode('register')}
                  className="px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/5 rounded-lg pl-3 pr-3 transition-colors cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </header>

        {/* 3. Primary Dashboard View Splitter */}
        <div className={`flex-grow w-full max-w-7xl mx-auto flex flex-col transition-all duration-500 ${
          isRunning ? 'justify-center items-center' : 'justify-start'
        }`}>
          
          {/* TOAST SYSTEM GLASS ALERT */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="mx-auto w-full max-w-md bg-black/85 border border-white/10 rounded-xl p-3 flex items-center gap-2.5 text-xs text-gray-300 font-mono shadow-2xl mb-4"
              >
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* VIEW A: INTERACTIVE FOCUS SPACE ATMOSPHERE */}
          {activeView === 'atmosphere' && (
            <div className={`flex flex-col lg:flex-row gap-5 items-stretch relative mt-2 transition-all duration-500 ${
              isRunning ? 'justify-center items-center w-full' : 'justify-between font-sans'
            }`}>
              
              {/* Left sidebar space (Session Targets Checklist) */}
              <AnimatePresence>
                {isGoalsOpen && !isRunning && (
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    className="w-full lg:w-76 shrink-0 bg-black/55 rounded-2xl border border-white/10 p-5 flex flex-col justify-between shadow-2xl"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-gray-300" />
                          <h2 className="text-xs uppercase tracking-widest font-mono font-bold text-gray-200">Current Goals</h2>
                        </div>
                        <button
                          onClick={() => setIsGoalsOpen(false)}
                          className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Add target item */}
                      <form onSubmit={handleAddGoal} className="flex gap-1.5">
                        <input
                          type="text"
                          required
                          placeholder="Add milestone name..."
                          value={newGoalText}
                          onChange={(e) => setNewGoalText(e.target.value)}
                          className="flex-grow bg-black/30 border border-white/15 focus:border-white text-xs outline-none py-1.5 px-2.5 rounded-lg text-white font-mono"
                        />
                        <button
                          type="submit"
                          className="bg-white hover:bg-neutral-100 text-black px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </form>

                      {/* List box */}
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {goals.map(g => (
                          <div 
                            key={g.id}
                            className="flex items-center justify-between gap-1.5 p-2 bg-white/5 border border-white/5 rounded-xl text-xs font-mono"
                          >
                            <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={g.completed}
                                onChange={() => handleToggleGoal(g.id)}
                                className="accent-white w-3.5 h-3.5 border-none outline-none rounded bg-black cursor-pointer"
                              />
                              <span className={`truncate ${g.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                {g.text}
                              </span>
                            </label>
                            <button
                              onClick={() => handleDeleteGoal(g.id)}
                              className="text-gray-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono text-center pt-3 border-t border-white/5">
                      Double Click checkpoint checkbox to fulfill goals
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* COLLAPSED SLEEVE HANDLE FOR GOALS SIDEBAR */}
              {!isGoalsOpen && !isRunning && (
                <button
                  onClick={() => setIsGoalsOpen(true)}
                  title="Reveal Targets Bar"
                  className="fixed left-2 top-1/2 -translate-y-1/2 w-10 h-24 bg-black/85 border border-white/10 hover:bg-neutral-900 rounded-xl z-30 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-gray-400 hover:text-white transition-all shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
                >
                  <Target className="w-4 h-4 animate-pulse" />
                  <span className="text-[8px] uppercase tracking-widest font-mono font-bold [writing-mode:vertical-lr]">GOALS</span>
                </button>
              )}

              {/* Middle Section (Cinematic timer clock & Screen-Editor canvas) */}
              <div className={`flex-grow flex flex-col items-center py-5 transition-all duration-500 ${
                isRunning ? 'justify-center space-y-1' : 'justify-start space-y-6'
              }`}>
                
                {/* Local clock with elegant visual display pairings - Fades during active focus run */}
                <div className={`text-center space-y-1 select-none transition-all duration-500 ${
                  isRunning ? 'opacity-0 scale-95 pointer-events-none h-0 overflow-hidden' : 'opacity-100'
                }`}>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-space font-bold">
                    ESTABLISHED SPACE TIME (LOCAL COZY)
                  </div>
                  <div className="font-mono text-xl tracking-tight font-bold text-gray-200">
                    {localTime || '04:00:00 AM'}
                  </div>
                </div>

                {/* Primary Large Focus Timer Clock */}
                <div className="flex flex-col items-center justify-center py-6 select-none relative">
                  
                  {/* Circle background halo representing atmospheric pulse */}
                  <div className={`absolute inset-0 w-72 h-72 rounded-full border border-white/5 bg-white/[0.012] blur-xl transition-all duration-1000 ${
                    isRunning ? 'scale-115 animate-pulse' : 'scale-100'
                  }`} />

                  {/* Mode Toggler Selector inside timer - Fades during active focus run */}
                  <div className={`flex bg-black/40 border border-white/10 p-1 rounded-full text-xs z-10 mb-8 transition-all duration-500 ${
                    isRunning ? 'opacity-0 scale-95 pointer-events-none h-0 overflow-hidden mb-0' : 'opacity-100'
                  }`}>
                    {(['focus', 'short', 'long'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setActiveTimerMode(m)}
                        className={`px-3 py-1.5 rounded-full uppercase tracking-wider font-mono text-[9px] font-bold cursor-pointer transition-colors ${
                          activeTimerMode === m 
                            ? 'bg-neutral-200 text-black' 
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {m === 'focus' ? 'Focus Block' : m === 'short' ? 'Short break' : 'Long loop'}
                      </button>
                    ))}
                  </div>

                  {/* Substantial elegant Clock display text */}
                  <h2 className="text-7xl sm:text-8xl md:text-9xl font-mono font-bold tracking-tighter text-white select-none z-10 leading-none drop-shadow-[0_12px_44px_rgba(0,0,0,0.85)]">
                    {formatTimeSeconds(timeLeft)}
                  </h2>

                  {/* Bottom Controls panel */}
                  <div className="flex items-center gap-3.5 mt-8 z-10">
                    <button
                      onClick={() => setTimeLeft(timeLeft + 60)}
                      className={`w-12 h-12 rounded-full border border-white/10 bg-black/55 hover:bg-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-xs font-mono font-bold text-gray-300 cursor-pointer ${
                        isRunning ? 'opacity-0 scale-75 pointer-events-none w-0 h-0 border-none m-0 p-0 overflow-hidden' : 'opacity-100 font-semibold'
                      }`}
                    >
                      +1m
                    </button>

                    <button
                      onClick={() => setIsRunning(!isRunning)}
                      className={`h-14 px-8 rounded-full font-mono text-xs uppercase tracking-widest transition-all cursor-pointer ${
                        isRunning 
                          ? 'bg-neutral-900 border border-white/15 text-white hover:bg-neutral-800' 
                          : 'bg-white hover:bg-neutral-200 text-black font-bold shadow-[0_12px_44px_rgba(255,255,255,0.15)]'
                      }`}
                    >
                      {isRunning ? 'Pause Flow' : 'Start Focus'}
                    </button>

                    <button
                      onClick={() => {
                        setIsRunning(false);
                        const m = activeTimerMode === 'focus' ? durationFocus : activeTimerMode === 'short' ? durationShort : durationLong;
                        setTimeLeft(m * 60);
                        triggerToast('Timer cycle reset.');
                      }}
                      className={`w-12 h-12 rounded-full border border-white/10 bg-black/55 hover:bg-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-gray-300 cursor-pointer ${
                        isRunning ? 'opacity-0 scale-75 pointer-events-none w-0 h-0 border-none m-0 p-0 overflow-hidden' : 'opacity-100'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Simulated Screen Notebook Canvas Frame (Sandbox captures workaround) */}
                {!isNotepadMinimized && !isRunning && (
                  <div 
                    ref={notepadContainerRef}
                    className="w-full max-w-xl bg-black/65 border border-white/10 rounded-2xl p-4 space-y-3 shadow-xl backdrop-blur-md relative"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={notebookTitle}
                          onChange={(e) => setNotebookTitle(e.target.value)}
                          className="bg-transparent border-none text-xs font-semibold text-gray-200 outline-none w-48 font-mono"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          Active Sandbox Capture Canvas
                        </span>
                        <button
                          onClick={() => setIsNotepadMinimized(true)}
                          className="p-1 hover:bg-white/5 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                          title="Close Study Notes"
                        >
                          <X className="w-4 h-4 hover:scale-105 active:scale-95 transition-all text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Notepad Text Slot representing "screen capture references" */}
                    <textarea
                      value={notepadText}
                      onChange={(e) => setNotepadText(e.target.value)}
                      className="w-full h-32 bg-black/30 border border-white/5 rounded-xl p-3 text-xs font-mono text-gray-300 focus:border-white/20 focus:text-white outline-none resize-none leading-relaxed"
                      placeholder="Type study objectives, code snippets, or notes. Click Force Analysis on top to evaluate active workspace details!"
                    />

                    <div className="text-[9px] text-gray-500 font-mono text-center">
                      Note: Your Notepad/Screenshot workspace canvas feeds continuously into Vision Analysis.
                    </div>
                  </div>
                )}

              </div>

              {/* Right sidebar space (AI workspace configuration overview) */}
              <AnimatePresence>
                {isMonitorPanelOpen && !isRunning && (
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    className="w-full lg:w-76 shrink-0 bg-black/55 rounded-2xl border border-white/10 p-5 flex flex-col justify-between shadow-2xl"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-gray-300" />
                          <h2 className="text-xs uppercase tracking-widest font-mono font-bold text-gray-200">AI Monitor</h2>
                        </div>
                        <button
                          onClick={() => setIsMonitorPanelOpen(false)}
                          className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Vision Check controls parameters */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                          <span>Auto Tracker Logs:</span>
                          <span className={`text-[10px] font-bold uppercase ${
                            isAiMonitorActive ? 'text-emerald-400 animate-pulse' : 'text-gray-500'
                          }`}>
                            {isAiMonitorActive ? 'Active' : 'Offline'}
                          </span>
                        </div>

                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={handleToggleCamera}
                            className={`flex-grow py-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isCameraActive 
                                ? 'bg-white text-black border-white font-semibold' 
                                : 'bg-black/30 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{isCameraActive ? 'Disable Cams' : 'Start Cameras'}</span>
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-400 font-mono uppercase">Capture rate (quota safety)</label>
                          <select
                            value={aiCheckInterval}
                            onChange={(e) => {
                              setAiCheckInterval(Number(e.target.value));
                              triggerToast(`Quota interval configured: check every ${Number(e.target.value) / 60}m`);
                            }}
                            className="w-full bg-neutral-900 border border-white/15 text-xs text-gray-300 py-1.5 px-2 rounded-xl outline-none"
                          >
                            <option value="60">Check every 1 minute</option>
                            <option value="300">Check every 5 minutes</option>
                            <option value="600">Check every 10 minutes</option>
                            <option value="900">Check every 15 minutes</option>
                            <option value="1800">Check every 30 minutes</option>
                          </select>
                        </div>

                        {/* Notepad canvas toggler display */}
                        <div className="pt-1.5 border-t border-white/5">
                          <button
                            onClick={() => setIsNotepadMinimized(!isNotepadMinimized)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] font-mono text-gray-300 hover:text-white uppercase font-bold transition-all cursor-pointer"
                          >
                            <Monitor className="w-3 h-3 text-emerald-400" />
                            <span>{isNotepadMinimized ? 'Open Study Notes' : 'Close Study Notes'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl bg-black/40 border border-white/5 p-3 space-y-2 text-xs">
                        <div className="text-[10px] uppercase font-mono text-gray-400 font-bold flex justify-between">
                          <span>Status Reading:</span>
                          <span className="text-gray-500">{lastAiCheck || '--:--'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span>Status:</span>
                          <span className={`font-mono text-[10px] font-bold uppercase ${
                            aiAnalysisStatus === 'working' ? 'text-emerald-400' :
                            aiAnalysisStatus === 'loading' ? 'text-blue-400 animate-pulse' :
                            aiAnalysisStatus === 'distracted' ? 'text-amber-400' : 'text-neutral-400'
                          }`}>
                            {aiAnalysisStatus}
                          </span>
                        </div>
                        <p className="text-[11px] italic text-gray-300 leading-snug bg-black/20 p-2 rounded-lg border border-white/5">
                          "{aiAnalysisSummary}"
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3">
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs transition-colors cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Display Settings Drawer</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* COLLAPSED SLEEVE HANDLE FOR RIGHT MONITOR SIDEBAR */}
              {!isMonitorPanelOpen && !isRunning && (
                <button
                  onClick={() => setIsMonitorPanelOpen(true)}
                  title="Reveal Observation Bar"
                  className="fixed right-2 top-1/2 -translate-y-1/2 w-10 h-24 bg-black/85 border border-white/10 hover:bg-neutral-900 rounded-xl z-30 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-gray-400 hover:text-white transition-all shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
                >
                  <Brain className="w-4 h-4 animate-pulse" />
                  <span className="text-[8px] uppercase tracking-widest font-mono font-bold [writing-mode:vertical-rl]">OBSERVE</span>
                </button>
              )}

            </div>
          )}

          {/* Draggable Face & USB Desk camera preview overlays - Rendered globally so it never unmounts during page switching */}
          <AnimatePresence>
            {isCameraActive && (
              <FloatingCamera
                isCameraActive={isCameraActive}
                onToggleCamera={handleToggleCamera}
                aiAnalysisStatus={aiAnalysisStatus}
                aiAnalysisSummary={aiAnalysisSummary}
                lastAiCheck={lastAiCheck}
              />
            )}
          </AnimatePresence>

          {/* VIEW B: PERSONAL PLANNING & DETAILED STATISTICS DASHBOARD */}
          {activeView === 'dashboard' && (
            <div className="space-y-6 mt-3">
              {/* Heat Map Track logs in chosen layout */}
              <HeatMap
                logs={sessionLogs}
                config={heatMapConfig}
                onConfigChange={(partial) => {
                  const updated = { ...heatMapConfig, ...partial };
                  setHeatMapConfig(updated);
                  syncWorkspaceDataSave({ heatMapConfig: updated });
                }}
                onClearLogs={() => {
                  localStorage.removeItem('aesthetic-room:session-logs');
                  setSessionLogs([]);
                  syncWorkspaceDataSave({ sessionLogs: [] });
                }}
              />

              {/* Calendar deadlines columns and material files */}
              <CalendarDeadlines
                deadlines={deadlines}
                logs={sessionLogs}
                onAddDeadline={handleAddDeadline}
                onToggleDeadline={handleToggleDeadline}
                onDeleteDeadline={handleDeleteDeadline}
              />

              {/* Syllabus and references attachments + AI chat tutor coach column */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SyllabusManager
                  syllabusList={syllabusList}
                  onAddSyllabus={handleAddSyllabus}
                  onDeleteSyllabus={handleDeleteSyllabus}
                />
                
                {/* Advanced Coach advisor conversational box */}
                <AICoachChat
                  currentTimerMode={activeTimerMode}
                  timeLeft={timeLeft}
                  goalsCompleted={sessionLogs.reduce((acc, curr) => acc + (curr.goalsCompleted || 0), 0)}
                  messages={chatMessages}
                  onSetMessages={handleSaveChatMessages}
                />
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM MIXER ROW (COLLAPSIBLE FOOTER BAR FOR CINEMATIC IMMERSION) */}
        {isBottomBarOpen && !isRunning ? (
          <footer className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10 pt-4 mt-6 text-xs text-gray-400">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 font-mono uppercase bg-white/5 border border-white/5 py-1 px-2.5 rounded-lg">
                Studio wallpaper grid status:
              </span>
              <div className="flex bg-black/40 border border-white/10 p-0.5 rounded-lg z-10">
                {([1, 2, 3, 4, 6] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => {
                      setActiveGridCount(n);
                      triggerToast(`Wallpaper grid layout modified: split screen of ${n} loops.`);
                    }}
                    className={`px-2 py-1 text-[9px] uppercase font-mono rounded transition-colors cursor-pointer ${
                      activeGridCount === n 
                        ? 'bg-neutral-200 text-black font-semibold' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {n} Cam{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
              
              <span className="text-[#333] font-mono">|</span>
              <button
                onClick={() => setIsBottomBarOpen(false)}
                className="text-gray-500 hover:text-white font-mono hover:no-underline transition-colors outline-none cursor-pointer"
              >
                Hide bottom bar
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-gray-400">Atmosphere Opacity:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={bgOpacity}
                onChange={(e) => setBgOpacity(Number(e.target.value))}
                className="w-24 accent-white cursor-pointer h-1 rounded bg-black"
              />
              <span className="text-gray-500 text-[10px] font-mono w-8">{bgOpacity}%</span>

              <span className="text-[#333] font-mono">|</span>

              {/* Advanced Synthesis vs Stream control */}
              <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-0.5 rounded-lg text-[9px] font-mono select-none">
                <button
                  onClick={() => {
                    setIsSynthMode(true);
                    triggerToast("Switched to offline Zen Synthesizer mode.");
                  }}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer font-bold ${
                    isSynthMode 
                      ? 'bg-emerald-500 text-black shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Web Audio API synthesizer (No offline buffering or CORS issues)"
                >
                  ZEN SYNTH
                </button>
                <button
                  onClick={() => {
                    setIsSynthMode(false);
                    triggerToast("Switched to cloud live audio stream mode.");
                  }}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer font-bold ${
                    !isSynthMode 
                      ? 'bg-neutral-200 text-black shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Wikipedia Commons direct stream files (Requires network connection)"
                >
                  STREAM
                </button>
              </div>

              <span className="text-[#333] font-mono">|</span>

              <div className="flex flex-wrap items-center gap-3.5">
                {SOUNDS.map(s => {
                  const vol = ambientVolumes[s.id] || 0;
                  const Icon = s.icon;
                  return (
                    <div 
                      key={s.id} 
                      className="flex items-center gap-1.5 bg-black/45 hover:bg-black/60 border border-white/5 hover:border-white/10 px-2 py-1 rounded-xl transition-colors font-mono text-[9px] uppercase font-semibold"
                    >
                      <button
                        onClick={() => {
                          const nextVol = vol > 0 ? 0 : 50;
                          setAmbientVolumes({ ...ambientVolumes, [s.id]: nextVol });
                          triggerToast(`${s.name} ${nextVol > 0 ? 'enabled' : 'muted'}`);
                        }}
                        className={`w-6 h-6 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
                          vol > 0 ? 'bg-white text-black font-bold' : 'text-gray-400 hover:text-white'
                        }`}
                        title={`Toggle ${s.name}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={vol}
                        onChange={(e) => {
                          const nextVol = Number(e.target.value);
                          setAmbientVolumes({ ...ambientVolumes, [s.id]: nextVol });
                        }}
                        className="w-14 h-1 accent-white bg-white/10 rounded cursor-pointer"
                        title={`${s.name} volume: ${vol}%`}
                      />
                      <span className="w-6 text-right text-gray-500 text-[8px]">{vol}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </footer>
        ) : !isRunning ? (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setIsBottomBarOpen(true)}
              className="text-[10px] font-mono text-gray-500 hover:text-white hover:underline transition-colors bg-black/60 border border-white/5 rounded-full py-1 px-3"
            >
              Show bottom mixer panel
            </button>
          </div>
        ) : null}

      </div>

      {/* 5. SETTINGS DRAWER OVERLAY */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28 }}
              className="fixed top-0 right-0 h-full w-[100vw] sm:w-[460px] z-50 bg-neutral-950 border-l border-white/10 p-6 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-200" />
                    <h2 className="text-sm font-space font-semibold uppercase tracking-widest">Cozy space controls</h2>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Grid link manager coordinates */}
                <div className="bg-white/5 rounded-xl border border-white/5 p-4 space-y-4">
                  <h3 className="text-xs uppercase font-space font-bold text-gray-200 flex items-center gap-2">
                    <Grid className="w-4 h-4 text-neutral-300" />
                    Multi-Camera Background Loops
                  </h3>

                  <div className="space-y-2">
                    {gridVideos.map((vidId, index) => (
                      <div key={index} className="space-y-1">
                        <label className="text-[10px] text-gray-400 font-mono block">Loop Slot {index + 1}:</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={vidId}
                            onChange={(e) => {
                              const next = [...gridVideos];
                              next[index] = e.target.value.trim();
                              setGridVideos(next);
                            }}
                            className="flex-grow bg-black/45 border border-white/10 text-xs text-white py-1.5 px-2.5 rounded-lg font-mono"
                            placeholder="Vidio ID or URL..."
                          />
                          <button
                            onClick={() => {
                              const next = [...gridVideos];
                              next[index] = STUDY_STREAMS[index % STUDY_STREAMS.length].id;
                              setGridVideos(next);
                            }}
                            className="bg-white/5 border border-white/10 text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded-lg"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clock Interval Customizers */}
                <div className="bg-white/5 rounded-xl border border-white/5 p-4 space-y-4">
                  <h3 className="text-xs uppercase font-space font-bold text-gray-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-neutral-300" />
                    Focus Block Durations (minutes)
                  </h3>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[9px] font-mono text-gray-400 block mb-1">Focus Mode</span>
                      <input
                        type="number"
                        min="1"
                        max="240"
                        value={durationFocus}
                        onChange={(e) => setDurationFocus(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-black/40 border border-white/10 p-2 text-xs font-mono rounded-lg outline-none text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-gray-400 block mb-1">Short Break</span>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={durationShort}
                        onChange={(e) => setDurationShort(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-black/40 border border-white/10 p-2 text-xs font-mono rounded-lg outline-none text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-gray-400 block mb-1">Long Break</span>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={durationLong}
                        onChange={(e) => setDurationLong(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-black/40 border border-white/10 p-2 text-xs font-mono rounded-lg outline-none text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 mt-6">
                <div className="rounded-xl bg-black/30 border border-white/5 p-3.5 text-[11px] text-gray-400 leading-relaxed font-mono">
                  Syllabus resources and Pomodoro accomplishments synchronize dynamically whenever linked profiles are connected.
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 6. AUTH DIALOG MODAL BOX */}
      <AnimatePresence>
        {authMode !== 'none' && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthMode('none')}
              className="absolute inset-0 bg-black/72 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-sm font-space font-semibold uppercase tracking-widest">
                    {authMode === 'login' ? 'Sign In Workspace' : 'Sign Up Workspace'}
                  </h3>
                  <button
                    onClick={() => setAuthMode('none')}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-3 pt-2">
                  {authError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-2.5 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-mono uppercase">Username profile</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. josh_focus"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      className="w-full bg-black/45 border border-white/10 focus:border-white text-xs outline-none py-2 px-3 rounded-xl text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-mono uppercase">Password coordinate</label>
                    <input
                      type="password"
                      required
                      placeholder="Secret alphanumeric code..."
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-black/45 border border-white/10 focus:border-white text-xs outline-none py-2 px-3 rounded-xl text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-white hover:bg-neutral-100 text-black font-semibold text-xs py-2.5 rounded-xl mt-4 active:scale-98 transition-all cursor-pointer"
                  >
                    {authMode === 'login' ? 'Access Workspace' : 'Establish New Profile'}
                  </button>
                </form>
              </div>

              <div className="text-center pt-4 border-t border-white/5 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setAuthError('');
                  }}
                  className="text-[10px] font-mono text-gray-400 hover:text-white underline cursor-pointer"
                >
                  {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
