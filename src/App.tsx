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
import { Goal, SyllabusItem, Deadline, FocusSessionLog, HeatMapConfig, StudyPlan, StudyReminder, StudyChannel } from './types';
import HeatMap from './components/HeatMap';
import CalendarDeadlines from './components/CalendarDeadlines';
import SyllabusManager from './components/SyllabusManager';
import AICoachChat from './components/AICoachChat';
import FloatingCamera from './components/FloatingCamera';
import CompanionBuddyChat from './components/CompanionBuddyChat';
import BackgroundGrid from './components/BackgroundGrid';
import StudyPlansManager from './components/StudyPlansManager';
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

  // Floating success quotes and therapist configuration
  const [activeQuotePopup, setActiveQuotePopup] = useState<string | null>(null);
  const [areRemindersSilenced, setAreRemindersSilenced] = useState<boolean>(() => {
    return localStorage.getItem('aesthetic-room:reminders-silenced') === 'true';
  });
  const silenceRef = useRef(areRemindersSilenced);
  useEffect(() => {
    silenceRef.current = areRemindersSilenced;
  }, [areRemindersSilenced]);

  // Synchronized background video playback indices map representation
  const [nodePlaybackIndices, setNodePlaybackIndices] = useState<{ [nodeIdx: number]: number }>(() => {
    const initial: { [nodeIdx: number]: number } = {};
    for (let i = 0; i < 6; i++) {
      try {
        const saved = localStorage.getItem(`aesthetic-room:node-state-${i}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.index === 'number') {
            initial[i] = parsed.index;
          }
        }
      } catch (e) {}
    }
    return initial;
  });

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (
        customEvent.detail &&
        typeof customEvent.detail.nodeIdx === 'number' &&
        typeof customEvent.detail.index === 'number'
      ) {
        setNodePlaybackIndices(prev => ({
          ...prev,
          [customEvent.detail.nodeIdx]: customEvent.detail.index
        }));
      }
    };
    window.addEventListener('aesthetic-room:node-index-updated', handleUpdate);
    return () => {
      window.removeEventListener('aesthetic-room:node-index-updated', handleUpdate);
    };
  }, []);

  // Focus Timer Parameters
  const [activeTimerMode, setActiveTimerMode] = useState<TimerMode>(() => {
    const saved = localStorage.getItem('aesthetic-room:active-timer-mode');
    return (saved === 'focus' || saved === 'short' || saved === 'long') ? (saved as TimerMode) : 'focus';
  });
  const [isRunning, setIsRunning] = useState<boolean>(() => {
    const wasRunning = localStorage.getItem('aesthetic-room:is-running') === 'true';
    const endTimestampStr = localStorage.getItem('aesthetic-room:timer-end-timestamp');
    if (wasRunning && endTimestampStr) {
      const endTimestamp = Number(endTimestampStr);
      return !isNaN(endTimestamp) && endTimestamp > Date.now();
    }
    return false;
  });
  const [durationFocus, setDurationFocus] = useState<number>(() => {
    const saved = localStorage.getItem('aesthetic-room:duration-focus');
    return (saved !== null && !isNaN(Number(saved)) && Number(saved) > 0) ? Number(saved) : 25;
  });
  const [durationShort, setDurationShort] = useState<number>(() => {
    const saved = localStorage.getItem('aesthetic-room:duration-short');
    return (saved !== null && !isNaN(Number(saved)) && Number(saved) > 0) ? Number(saved) : 5;
  });
  const [durationLong, setDurationLong] = useState<number>(() => {
    const saved = localStorage.getItem('aesthetic-room:duration-long');
    return (saved !== null && !isNaN(Number(saved)) && Number(saved) > 0) ? Number(saved) : 15;
  });
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const wasRunning = localStorage.getItem('aesthetic-room:is-running') === 'true';
    const endTimestampStr = localStorage.getItem('aesthetic-room:timer-end-timestamp');
    if (wasRunning && endTimestampStr) {
      const endTimestamp = Number(endTimestampStr);
      if (!isNaN(endTimestamp)) {
        const remaining = Math.round((endTimestamp - Date.now()) / 1000);
        if (remaining > 0) return remaining;
      }
    }
    const savedTime = localStorage.getItem('aesthetic-room:time-left');
    if (savedTime !== null && !isNaN(Number(savedTime)) && Number(savedTime) > 0) {
      return Number(savedTime);
    }
    const savedMode = localStorage.getItem('aesthetic-room:active-timer-mode') || 'focus';
    const focusVal = localStorage.getItem('aesthetic-room:duration-focus');
    const shortVal = localStorage.getItem('aesthetic-room:duration-short');
    const longVal = localStorage.getItem('aesthetic-room:duration-long');
    const targetMin = savedMode === 'focus' 
      ? (focusVal ? Number(focusVal) : 25) 
      : savedMode === 'short' 
        ? (shortVal ? Number(shortVal) : 5) 
        : (longVal ? Number(longVal) : 15);
    return Math.max(1, targetMin) * 60;
  });
  const [isEditingTime, setIsEditingTime] = useState<boolean>(false);
  const [customHoursInput, setCustomHoursInput] = useState<string>('');
  const [customMinsInput, setCustomMinsInput] = useState<string>('');

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

  const [channels, setChannels] = useState<StudyChannel[]>(() => {
    const defaultChannelsList: StudyChannel[] = [
      {
        id: "custom-1780367919151",
        name: "kkoh",
        videoIds: [
          "YA4WApWMg5g", "LVWhS8_MW8M", "Q-le7kz7Uzc", "BenWCKFdONk", "EXB5BMzOmPI",
          "QFE_Up4J2u8", "lm1ERWXtTHg", "nglhwwwPv6U", "vuRiWFb8ZAg", "eV2KQPG8XeA",
          "wRWfhuo-c9A", "0ynCD9J-ZAs", "ky0v2xf_R4I", "MdewiPIldJA", "fDG5s-ETdjk",
          "PrHIPfvtMYY", "C2Z8M-1OzeE", "RJ5XPMV-xZc", "8tC78EVHlG0", "UvVeVSo4epg",
          "urZdBE-15o8", "N-nT00eFyoI", "nUpAzrSYTU0", "5bj0xSWlbew", "nE3K5pGXrNc",
          "YdiSDbxbun0", "NzasiL0QE28", "kTav5DadwyM", "FXByyFLKgR8", "pQssJjPYYm8"
        ],
        assignedNode: null
      },
      {
        id: "custom-1780368076658",
        name: "STUDY SOCIETY",
        videoIds: [
          "qnqjIdMmUN4", "VWTQM6fQ_p0", "v9fxE5XsDJs", "FcNXIYDyO2Q", "6bYRGBU8TJ4",
          "T0HP_gBrjCU", "2k4wtb6_TAY", "FaY9Avl_nuc", "MJvdm4ebS5g"
        ],
        assignedNode: 6
      },
      {
        id: "custom-1780368114452",
        name: "Emily Ann Edit",
        videoIds: [
          "yTI5B-gFJc0", "ly66BBahttc", "38NTU1SotAc", "M_X5IZ6GcTc", "2wdfXH9qdi8",
          "X39Z1U93Cns", "r3tSqz0a-zI", "3HgXDcXZ3JQ", "AVaJUh9CDws", "xoq5CKt_3O0",
          "rsi-Hv-vsI4", "Ou2pRs6ruYY", "-R84AzZJZ4k", "3LdsCoNq5gg", "hyFWx3MMkJs",
          "mL472gTHQwI", "9GaaznbPGGU", "PKXKh8PbJ7Q", "TGeSaTG4xbQ", "EfqD4ievp6c",
          "-6Rg-z4fphU", "OiuRMvhkKKw", "AlADoe_-2Ys", "crzUV5rkWTI", "bMp3L2186mk",
          "haRKOe-PNAw", "mNvbv5PSUuU", "kN7WPKnezU4", "OT6xJpnEWRY", "3Mtz9N_y1ik"
        ],
        assignedNode: null
      },
      {
        id: "custom-1780368138226",
        name: "Per Studium",
        videoIds: [
          "yI-vwnodsW8", "8u6j_fBkM_w", "sUl4r-AC6Vc", "deCpXINi9rQ", "nhyAD9XkVbc",
          "yfUXNpKKyIs", "648vG2ylCcQ", "NRHfrGgmO-o", "yyUAt8aAyy4", "M4mC_3K6lz0",
          "sjgI7VfAteY", "tqZNKgz27Fk", "CZs_-S-PAdw", "kr2f5mL9t2k", "1fc-2LJ9eYM",
          "KOG7IV1CYDs", "xUApEiXgFjU", "0QX6haTRqHo", "dXM9_iYENgk", "qAldvvzFCZc",
          "FfSx4UYeBZc", "t3EHW0Tt2Rk", "w5ICWa1PJRQ", "LHlyIBWdx0g", "jlG539DPTtQ",
          "ZiyMfBvzmN4", "53cDj5ldbSs", "3IAZ-9CqWI4", "PFgG3dG_PSE", "3sEo2FlA9kE"
        ],
        assignedNode: 1
      },
      {
        id: "custom-1780368159566",
        name: "Akira Studies",
        videoIds: [
          "eSB-PwkF0Pg", "3q3b2DJeKAc", "sC2-ZzhT-3I", "2DESAQvmctM", "gR4g6jtpYoQ",
          "ELcsLvxJY2w", "tvznoDmDWBY", "uKgTk8c5jUQ", "qTKewlWvtQM", "Ksd-mDI4_xg",
          "Lgko-c9wxIE", "J_0jBEgsJhg", "HSeavbzfCl0", "Osi49IsfHD0", "U0WrNxt6YN0",
          "GyZ1w_QdYD0", "OJX6c0gRYFU", "E7_0DfLL7go", "80XR89fomXo", "oqewXcUl3QY",
          "aPFwtuJnR54", "ENrOBAZn6Y8", "XMWiqbgTDvg", "m_y7985OlvE", "Fu-kY3JnA0k",
          "_IfH5TpSEyU", "ANKSUtkDsCw", "HqkEh61xPy4", "DJc8vc6NWKs", "WG3ZAv1Xcwo"
        ],
        assignedNode: 5
      },
      {
        id: "custom-1780368214019",
        name: "focus",
        videoIds: [
          "5jpfTtlgnTQ", "W6aparAWkcM", "CTmDTWkVIwc", "xqQMCQjzt2A", "poTDTMzV7VE",
          "HLOH_EPH_iI", "Z5NVpZ3spew", "kk9yq8ItBg8", "Q-JgSQyQ4H4", "OEdJ5SjX354",
          "mWQmfJN5Ixs", "5CU_JcFR0T0"
        ],
        assignedNode: 4
      },
      {
        id: "custom-1780368699184",
        name: "James Scholz",
        videoIds: [
          "7kgm_k00aqU", "OH4jci9hIew", "uuk0FbpOO7E", "XRd85K2Tfm8", "ZzBXzt71wyY",
          "GpGpX8I7kHs", "KjDFQWXIPXQ", "lfQQRMAwEHI", "Zze7QPPGSNA", "DiXZCboAD08",
          "xJudZttWuEY", "Em8Y23I4AUM", "P0qQGvJoK68", "pt0UQm8361A", "cEKYyGOm5m8",
          "V6vZLCaFCoM", "dhfM2b6eIRM", "1jKwCWb3anc", "nIfWhssPDw8", "c9s5jibiPdo",
          "Nb8en_Mes4s", "XCdmnqEKtl8", "doDZQIbv97U", "hzYtZrQxhW4", "YfW73eQauso",
          "I-IvCF7CD0A", "qkdUGC-izus", "_WADF7q5o-4", "v8Rb3LdGPnw", "R0d6dZWp8GQ"
        ],
        assignedNode: 3
      }
    ];

    try {
      const saved = localStorage.getItem('aesthetic-room:channels');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasOldPresets = parsed.some((c: any) => 
          ['lofi-girl', 'abao-study', 'chillhop-records', 'coffee-shop-vibes', 'tokyo-night-walk', 'warm-fireplace-cabin'].includes(c.id)
        );
        if (hasOldPresets) {
          // Permanently overwrite/update localStorage to ensure old presets are clean
          localStorage.setItem('aesthetic-room:channels', JSON.stringify(defaultChannelsList));
          return defaultChannelsList;
        }
        return parsed;
      }
      return defaultChannelsList;
    } catch {
      return defaultChannelsList;
    }
  });

  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelVideoIds, setNewChannelVideoIds] = useState('');
  const [importChannelUrl, setImportChannelUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [creatorTab, setCreatorTab] = useState<'auto' | 'manual'>('auto');

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

  // Study plans, deadlines and customizable dynamic periodic reminders
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>(() => {
    try {
      const saved = localStorage.getItem('aesthetic-room:study-plans');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [reminders, setReminders] = useState<StudyReminder[]>(() => {
    try {
      const saved = localStorage.getItem('aesthetic-room:reminders');
      return saved ? JSON.parse(saved) : [
        { id: 'rem-1', title: 'Hydration - Drink water', intervalMinutes: 15, isActive: true },
        { id: 'rem-2', title: 'Postural checkpoint & stretch', intervalMinutes: 30, isActive: true }
      ];
    } catch {
      return [
        { id: 'rem-1', title: 'Hydration - Drink water', intervalMinutes: 15, isActive: true },
        { id: 'rem-2', title: 'Postural checkpoint & stretch', intervalMinutes: 30, isActive: true }
      ];
    }
  });

  const [isFloatingCameraOpen, setIsFloatingCameraOpen] = useState<boolean>(() => {
    return localStorage.getItem('aesthetic-room:is-floating-camera-open') === 'true';
  });

  const reminderSecondsRef = useRef<{ [key: string]: number }>({});

  const playSubtleSynthChime = () => {
    if (silenceRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5 note
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5 note
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.30); // G5 note
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn("Web Audio synth skipped:", e);
    }
  };

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

  // Saved companion study buddy chat history (Llama)
  const [buddyHistory, setBuddyHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('zen-buddy:conversation-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
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

  // Accumulate focus ticks in seconds spent ref for real-time focus minute tracking
  const secondsSpentRef = useRef(0);

  // Helper helper to get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
    localStorage.setItem('aesthetic-room:active-timer-mode', activeTimerMode);
    if (user) {
      syncWorkspaceDataSave({ activeTimerMode });
    }
  }, [activeTimerMode, user]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:is-running', String(isRunning));
    if (isRunning) {
      const endTimestamp = Date.now() + (timeLeft * 1000);
      localStorage.setItem('aesthetic-room:timer-end-timestamp', String(endTimestamp));
    } else {
      localStorage.removeItem('aesthetic-room:timer-end-timestamp');
    }
  }, [isRunning, timeLeft]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:time-left', String(timeLeft));
    if (isRunning) {
      const endTimestamp = Date.now() + (timeLeft * 1000);
      localStorage.setItem('aesthetic-room:timer-end-timestamp', String(endTimestamp));
    }
  }, [timeLeft, isRunning]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:duration-focus', String(durationFocus));
    if (user) {
      syncWorkspaceDataSave({ durationFocus });
    }
  }, [durationFocus, user]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:duration-short', String(durationShort));
    if (user) {
      syncWorkspaceDataSave({ durationShort });
    }
  }, [durationShort, user]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:duration-long', String(durationLong));
    if (user) {
      syncWorkspaceDataSave({ durationLong });
    }
  }, [durationLong, user]);

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
    if (isCameraActive) {
      setIsFloatingCameraOpen(true);
    }
  }, [isCameraActive]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:is-floating-camera-open', String(isFloatingCameraOpen));
  }, [isFloatingCameraOpen]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:study-plans', JSON.stringify(studyPlans));
    if (user) {
      syncWorkspaceDataSave({ studyPlans });
    }
  }, [studyPlans, user]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:reminders', JSON.stringify(reminders));
    if (user) {
      syncWorkspaceDataSave({ reminders });
    }
  }, [reminders, user]);

  useEffect(() => {
    localStorage.setItem('aesthetic-room:channels', JSON.stringify(channels));
    if (user) {
      syncWorkspaceDataSave({ channels });
    }
  }, [channels, user]);

  useEffect(() => {
    localStorage.setItem('zen-buddy:conversation-history', JSON.stringify(buddyHistory));
    if (user) {
      syncWorkspaceDataSave({ buddyHistory });
    }
  }, [buddyHistory, user]);

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

  const remindersRef = useRef(reminders);
  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  // Main timer tick implementation
  useEffect(() => {
    let sub: any = null;
    if (isRunning) {
      sub = setInterval(() => {
        // Increment real-time focus seconds spent if we are focusing
        if (activeTimerMode === 'focus') {
          secondsSpentRef.current += 1;

          // Increment and check dynamic reminders using ref to avoid resetting countdown timer on list checks
          remindersRef.current.forEach((rem) => {
            if (rem.isActive) {
              const prevCount = reminderSecondsRef.current[rem.id] || 0;
              const count = prevCount + 1;
              const limit = rem.intervalMinutes * 60;
              if (count >= limit) {
                reminderSecondsRef.current[rem.id] = 0;
                if (!silenceRef.current) {
                  playSubtleSynthChime();
                  triggerToast(`🔔 Zen Reminder: ${rem.title}! Keep your focus strong.`);
                }
              } else {
                reminderSecondsRef.current[rem.id] = count;
              }
            }
          });

          if (secondsSpentRef.current >= 60) {
            secondsSpentRef.current = 0;
            const todayStr = getLocalDateString();
            setSessionLogs((prevLogs) => {
              const matchedLogIdx = prevLogs.findIndex((l) => l.date === todayStr);
              if (matchedLogIdx !== -1) {
                const updated = [...prevLogs];
                updated[matchedLogIdx] = {
                  ...updated[matchedLogIdx],
                  durationMinutes: updated[matchedLogIdx].durationMinutes + 1
                };
                return updated;
              } else {
                return [
                  ...prevLogs,
                  { date: todayStr, durationMinutes: 1, goalsCompleted: 0, checklistItemsCompleted: 0 }
                ];
              }
            });
          }
        }

        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (!silenceRef.current) {
              playCompletionChime();
            }
            triggerToast(`Session complete! Perfect focus maintained.`);
            
            // Reached completion. Flush any remaining seconds that are >= 30 seconds if any
            if (activeTimerMode === 'focus') {
              if (secondsSpentRef.current >= 30) {
                const todayStr = getLocalDateString();
                setSessionLogs((prevLogs) => {
                  const matchedLogIdx = prevLogs.findIndex((l) => l.date === todayStr);
                  if (matchedLogIdx !== -1) {
                    const updated = [...prevLogs];
                    updated[matchedLogIdx] = {
                      ...updated[matchedLogIdx],
                      durationMinutes: updated[updated.length - 1].durationMinutes + 1
                    };
                    return updated;
                  } else {
                    return [
                      ...prevLogs,
                      { date: todayStr, durationMinutes: 1, goalsCompleted: 0, checklistItemsCompleted: 0 }
                    ];
                  }
                });
              }
              secondsSpentRef.current = 0; // reset
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(sub);
  }, [isRunning, activeTimerMode, durationFocus, areRemindersSilenced]);

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

  // Scheduled Image Analysis with fallbacks - Only executes when Camera is active
  useEffect(() => {
    let sub: any = null;
    if (isAiMonitorActive && isCameraActive) {
      // Run once immediately on activation or mount
      runWorkspaceVisionCheck();
      
      sub = setInterval(() => {
        runWorkspaceVisionCheck();
      }, aiCheckInterval * 1000);
    } else {
      setAiAnalysisStatus('idle');
    }
    return () => {
      if (sub) clearInterval(sub);
    };
  }, [isAiMonitorActive, isCameraActive, aiCheckInterval]);

  // Capture frame of the Notepad canvas layout or webcams as visual proxy screenshot
  const runWorkspaceVisionCheck = async () => {
    if (!isCameraActive) {
      setAiAnalysisStatus('idle');
      return;
    }

    setAiAnalysisStatus('loading');
    
    // Check for playing webcam/screencare tracks on the visual render tree to compile collage frame buffers
    let visualBase64 = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Render rich dark studio wallpaper slate background
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, 640, 480);

        const videoNodes = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
        const playingVideos = videoNodes.filter(v => v.readyState >= 2 && !v.paused);

        if (playingVideos.length > 0) {
          if (playingVideos.length === 1) {
            ctx.drawImage(playingVideos[0], 0, 0, 640, 480);
          } else {
            // Split layout side-by-side
            ctx.drawImage(playingVideos[0], 0, 120, 320, 240);
            if (playingVideos[1]) {
              ctx.drawImage(playingVideos[1], 320, 120, 320, 240);
            }
          }
        } else {
          // Fallback: draw aesthetic notepad canvas matrix
          ctx.fillStyle = '#111115';
          ctx.fillRect(15, 15, 610, 450);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 15px monospace';
          ctx.fillText(`Zen Workspace Virtual Monitor`, 35, 55);
          ctx.fillStyle = '#8e8e93';
          ctx.font = '12px Courier';
          ctx.fillText(`Monitor: ACTIVE | Active goal: ${goals.find(g => !g.completed)?.text || 'None set'}`, 35, 90);
          ctx.fillText(`Current Notepad:`, 35, 130);
          const parts = notepadText.split('\n').slice(0, 10);
          parts.forEach((line, i) => {
            ctx.fillText(line.substring(0, 65), 45, 160 + i * 25);
          });
        }
        visualBase64 = canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch (e) {
      console.warn("Webcam stream composite snapshot fell back:", e);
    }

    const pendingGoal = goals.find(g => !g.completed)?.text || 'General Work Focus';

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: visualBase64,
          mode: 'camera', // Identify real webcam status checks
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
            if (data.state.durationFocus !== undefined && !localStorage.getItem('aesthetic-room:duration-focus')) setDurationFocus(data.state.durationFocus);
            if (data.state.durationShort !== undefined && !localStorage.getItem('aesthetic-room:duration-short')) setDurationShort(data.state.durationShort);
            if (data.state.durationLong !== undefined && !localStorage.getItem('aesthetic-room:duration-long')) setDurationLong(data.state.durationLong);
            if (data.state.backgroundVideoIds !== undefined) setGridVideos(data.state.backgroundVideoIds);
            if (data.state.chatMessages !== undefined) setChatMessages(data.state.chatMessages);
            if (data.state.studyPlans !== undefined) setStudyPlans(data.state.studyPlans);
            if (data.state.reminders !== undefined) setReminders(data.state.reminders);
            if (data.state.channels !== undefined) setChannels(data.state.channels);
            if (data.state.buddyHistory !== undefined) setBuddyHistory(data.state.buddyHistory);
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
        setStudyPlans(data.state.studyPlans || []);
        setReminders(data.state.reminders || []);
        setChannels(data.state.channels || []);
        setBuddyHistory(data.state.buddyHistory || []);
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

      setBuddyHistory([]);
      localStorage.removeItem('zen-buddy:conversation-history');
 
      syncWorkspaceDataSave({
        goals: cleanGoals,
        deadlines: cleanDeadlines,
        syllabusList: cleanSyllabus,
        sessionLogs: cleanLogs,
        chatMessages: [
          { role: 'assistant', content: 'Greeting student. I am your Zen Study Assistant on Groq. Ask any question!' }
        ],
        buddyHistory: []
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

  // Study plans handlings
  const handleAddStudyPlan = (newPlan: Omit<StudyPlan, 'id' | 'hoursLogged'>) => {
    const plan: StudyPlan = {
      ...newPlan,
      id: `plan-${Date.now()}`,
      hoursLogged: 0
    };
    setStudyPlans(prev => [...prev, plan]);
    triggerToast(`Scheduled study plan registered: ${plan.title}`);
  };

  const handleDeleteStudyPlan = (id: string) => {
    setStudyPlans(prev => prev.filter(p => p.id !== id));
    triggerToast('Study plan cleared.');
  };

  const handleToggleStudyPlanMilestone = (planId: string, milestoneId: string) => {
    setStudyPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      const updatedMilestones = p.milestones.map(m => {
        if (m.id !== milestoneId) return m;
        const nextCompleted = !m.completed;
        if (nextCompleted) {
          triggerToast(`Milestone completed: ${m.title}!`);
        }
        return { ...m, completed: nextCompleted };
      });
      return { ...p, milestones: updatedMilestones };
    }));
  };

  const handleLogStudyPlanHours = (planId: string, hours: number) => {
    setStudyPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      const total = p.hoursLogged + hours;
      triggerToast(`Logged ${hours}h study time towards ${p.title}. Keep progressing!`);
      return { ...p, hoursLogged: total };
    }));
  };

  const handleAddStudyPlanMilestone = (planId: string, title: string, dueDate: string) => {
    setStudyPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      const nextMilestone = {
        id: `m-${Date.now()}`,
        title,
        dueDate: dueDate || p.targetExamDate || new Date().toISOString().split('T')[0],
        completed: false
      };
      return { ...p, milestones: [...p.milestones, nextMilestone] };
    }));
    triggerToast('Added custom plan milestone.');
  };

  const handleAddReminder = (title: string, minutes: number) => {
    const nextReminder: StudyReminder = {
      id: `rem-${Date.now()}`,
      title,
      intervalMinutes: minutes,
      isActive: true
    };
    setReminders(prev => [...prev, nextReminder]);
    triggerToast(`Added periodic alert: ${title} every ${minutes}m.`);
  };

  const handleDeleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    triggerToast('Reminder deleted.');
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
    const todayStr = getLocalDateString();
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
    const todayStr = getLocalDateString();
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
      <BackgroundGrid gridVideos={gridVideos} activeGridCount={activeGridCount} channels={channels} />

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
                        onClick={() => {
                          setActiveTimerMode(m);
                          const targetMins = m === 'focus' ? durationFocus : m === 'short' ? durationShort : durationLong;
                          setTimeLeft(targetMins * 60);
                        }}
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

                  {/* Substantial elegant Clock display text - Click to edit hours & minutes */}
                  {!isEditingTime ? (
                    <div 
                      onClick={() => {
                        if (!isRunning) {
                          const h = Math.floor(timeLeft / 3600);
                          const m = Math.floor((timeLeft % 3600) / 60);
                          setCustomHoursInput(h > 0 ? String(h) : '');
                          setCustomMinsInput(String(m));
                          setIsEditingTime(true);
                        }
                      }}
                      className={`group relative select-none z-10 transition-all ${
                        isRunning ? '' : 'cursor-pointer'
                      }`}
                      title={isRunning ? 'Active Countdown' : 'Click to directly edit duration (hours & minutes)'}
                    >
                      <h2 className="text-7xl sm:text-8xl md:text-9xl font-mono font-bold tracking-tighter text-white select-none leading-none drop-shadow-[0_12px_44px_rgba(0,0,0,0.85)] group-hover:text-neutral-200 transition-colors">
                        {formatTimeSeconds(timeLeft)}
                      </h2>
                      {!isRunning && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-neutral-400 whitespace-nowrap bg-black/80 px-2 py-0.5 rounded border border-white/10">
                          Click to set custom hours/minutes
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="z-20 bg-black/90 border border-white/20 rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-3 backdrop-blur-md">
                      <div className="text-[10px] font-mono text-neutral-300 font-bold uppercase tracking-wider">
                        Set Custom Duration
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <div className="flex flex-col items-center">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            placeholder="0"
                            value={customHoursInput}
                            onChange={(e) => setCustomHoursInput(e.target.value)}
                            className="w-16 bg-white/10 border border-white/20 rounded-lg p-2 text-center text-lg font-bold text-white outline-none focus:border-white"
                          />
                          <span className="text-[9px] text-gray-400 mt-1">Hours</span>
                        </div>
                        <span className="text-xl font-bold text-gray-400 mb-4">:</span>
                        <div className="flex flex-col items-center">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="25"
                            value={customMinsInput}
                            onChange={(e) => setCustomMinsInput(e.target.value)}
                            className="w-16 bg-white/10 border border-white/20 rounded-lg p-2 text-center text-lg font-bold text-white outline-none focus:border-white"
                          />
                          <span className="text-[9px] text-gray-400 mt-1">Minutes</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const h = Math.max(0, Number(customHoursInput) || 0);
                            const m = Math.max(0, Number(customMinsInput) || 0);
                            const totalMinutes = (h * 60) + m;
                            if (totalMinutes > 0) {
                              const totalSeconds = totalMinutes * 60;
                              if (activeTimerMode === 'focus') setDurationFocus(totalMinutes);
                              else if (activeTimerMode === 'short') setDurationShort(totalMinutes);
                              else setDurationLong(totalMinutes);
                              setTimeLeft(totalSeconds);
                              triggerToast(`Timer set to ${h > 0 ? `${h}h ` : ''}${m}m!`);
                            }
                            setIsEditingTime(false);
                          }}
                          className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer font-mono"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingTime(false)}
                          className="bg-white/10 hover:bg-white/20 text-gray-300 text-xs py-1.5 px-3 rounded-lg transition-all cursor-pointer font-mono"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Preset Badges */}
                  {!isRunning && !isEditingTime && (
                    <div className="flex items-center gap-1.5 mt-3 z-10">
                      {[
                        { label: '25m', mins: 25 },
                        { label: '50m', mins: 50 },
                        { label: '2h', mins: 120 },
                        { label: '4h', mins: 240 },
                        { label: '8h', mins: 480 },
                        { label: '12h', mins: 720 },
                        { label: '20h', mins: 1200 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => {
                            if (activeTimerMode === 'focus') setDurationFocus(preset.mins);
                            else if (activeTimerMode === 'short') setDurationShort(preset.mins);
                            else setDurationLong(preset.mins);
                            setTimeLeft(preset.mins * 60);
                            triggerToast(`Set timer to ${preset.label}!`);
                          }}
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                            (activeTimerMode === 'focus' ? durationFocus : activeTimerMode === 'short' ? durationShort : durationLong) === preset.mins
                              ? 'bg-white/20 border-white/40 text-white font-bold'
                              : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}

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

                        <div className="flex flex-col gap-2 text-xs">
                          <button
                            onClick={handleToggleCamera}
                            className={`w-full py-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isCameraActive 
                                ? 'bg-white text-black border-white font-semibold' 
                                : 'bg-black/25 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{isCameraActive ? 'Disable Cams' : 'Start Cameras'}</span>
                          </button>

                          <button
                            onClick={() => {
                              const next = !isFloatingCameraOpen;
                              setIsFloatingCameraOpen(next);
                              triggerToast(next ? 'Floating Stream HUD display active.' : 'Floating Stream panel closed.');
                            }}
                            className={`w-full py-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isFloatingCameraOpen 
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-semibold' 
                                : 'bg-black/25 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>{isFloatingCameraOpen ? 'Close Stream HUD' : 'Open Stream HUD'}</span>
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
            {isFloatingCameraOpen && (
              <FloatingCamera
                isCameraActive={isCameraActive}
                onToggleCamera={() => {
                  setIsFloatingCameraOpen(false);
                }}
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

              {/* Central Study Plans Manager Dashboard */}
              <StudyPlansManager
                plans={studyPlans}
                onAddPlan={handleAddStudyPlan}
                onDeletePlan={handleDeleteStudyPlan}
                onToggleMilestone={handleToggleStudyPlanMilestone}
                onLogPlanHours={handleLogStudyPlanHours}
                onAddMilestone={handleAddStudyPlanMilestone}
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
                  onAddReminder={handleAddReminder}
                  onAddStudyPlan={handleAddStudyPlan}
                  goals={goals}
                  deadlines={deadlines}
                  studyPlans={studyPlans}
                  reminders={reminders}
                />
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM MIXER ROW (COLLAPSIBLE FOOTER BAR FOR CINEMATIC IMMERSION) */}
        {isBottomBarOpen && !isRunning ? (
          <footer className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10 pt-4 mt-6 text-xs text-gray-400">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 font-mono uppercase bg-white/5 border border-white/5 py-1 px-2.5 rounded-lg text-[9px]">
                Wallpaper Grid Screens:
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
                    {n} screen{n > 1 ? 's' : ''}
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

                {/* Channels Loop Manager Section */}
                <div className="bg-white/5 rounded-xl border border-white/5 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase font-space font-bold text-gray-200 flex items-center gap-2">
                      <Tv className="w-4 h-4 text-neutral-300 animate-pulse" />
                      Assigned Loop Channels
                    </h3>
                    <button
                      onClick={() => {
                        const defaults = [
                          {
                            id: "custom-1780367919151",
                            name: "kkoh",
                            videoIds: [
                              "YA4WApWMg5g", "LVWhS8_MW8M", "Q-le7kz7Uzc", "BenWCKFdONk", "EXB5BMzOmPI",
                              "QFE_Up4J2u8", "lm1ERWXtTHg", "nglhwwwPv6U", "vuRiWFb8ZAg", "eV2KQPG8XeA",
                              "wRWfhuo-c9A", "0ynCD9J-ZAs", "ky0v2xf_R4I", "MdewiPIldJA", "fDG5s-ETdjk",
                              "PrHIPfvtMYY", "C2Z8M-1OzeE", "RJ5XPMV-xZc", "8tC78EVHlG0", "UvVeVSo4epg",
                              "urZdBE-15o8", "N-nT00eFyoI", "nUpAzrSYTU0", "5bj0xSWlbew", "nE3K5pGXrNc",
                              "YdiSDbxbun0", "NzasiL0QE28", "kTav5DadwyM", "FXByyFLKgR8", "pQssJjPYYm8"
                            ],
                            assignedNode: null
                          },
                          {
                            id: "custom-1780368076658",
                            name: "STUDY SOCIETY",
                            videoIds: [
                              "qnqjIdMmUN4", "VWTQM6fQ_p0", "v9fxE5XsDJs", "FcNXIYDyO2Q", "6bYRGBU8TJ4",
                              "T0HP_gBrjCU", "2k4wtb6_TAY", "FaY9Avl_nuc", "MJvdm4ebS5g"
                            ],
                            assignedNode: 6
                          },
                          {
                            id: "custom-1780368114452",
                            name: "Emily Ann Edit",
                            videoIds: [
                              "yTI5B-gFJc0", "ly66BBahttc", "38NTU1SotAc", "M_X5IZ6GcTc", "2wdfXH9qdi8",
                              "X39Z1U93Cns", "r3tSqz0a-zI", "3HgXDcXZ3JQ", "AVaJUh9CDws", "xoq5CKt_3O0",
                              "rsi-Hv-vsI4", "Ou2pRs6ruYY", "-R84AzZJZ4k", "3LdsCoNq5gg", "hyFWx3MMkJs",
                              "mL472gTHQwI", "9GaaznbPGGU", "PKXKh8PbJ7Q", "TGeSaTG4xbQ", "EfqD4ievp6c",
                              "-6Rg-z4fphU", "OiuRMvhkKKw", "AlADoe_-2Ys", "crzUV5rkWTI", "bMp3L2186mk",
                              "haRKOe-PNAw", "mNvbv5PSUuU", "kN7WPKnezU4", "OT6xJpnEWRY", "3Mtz9N_y1ik"
                            ],
                            assignedNode: null
                          },
                          {
                            id: "custom-1780368138226",
                            name: "Per Studium",
                            videoIds: [
                              "yI-vwnodsW8", "8u6j_fBkM_w", "sUl4r-AC6Vc", "deCpXINi9rQ", "nhyAD9XkVbc",
                              "yfUXNpKKyIs", "648vG2ylCcQ", "NRHfrGgmO-o", "yyUAt8aAyy4", "M4mC_3K6lz0",
                              "sjgI7VfAteY", "tqZNKgz27Fk", "CZs_-S-PAdw", "kr2f5mL9t2k", "1fc-2LJ9eYM",
                              "KOG7IV1CYDs", "xUApEiXgFjU", "0QX6haTRqHo", "dXM9_iYENgk", "qAldvvzFCZc",
                              "FfSx4UYeBZc", "t3EHW0Tt2Rk", "w5ICWa1PJRQ", "LHlyIBWdx0g", "jlG539DPTtQ",
                              "ZiyMfBvzmN4", "53cDj5ldbSs", "3IAZ-9CqWI4", "PFgG3dG_PSE", "3sEo2FlA9kE"
                            ],
                            assignedNode: 1
                          },
                          {
                            id: "custom-1780368159566",
                            name: "Akira Studies",
                            videoIds: [
                              "eSB-PwkF0Pg", "3q3b2DJeKAc", "sC2-ZzhT-3I", "2DESAQvmctM", "gR4g6jtpYoQ",
                              "ELcsLvxJY2w", "tvznoDmDWBY", "uKgTk8c5jUQ", "qTKewlWvtQM", "Ksd-mDI4_xg",
                              "Lgko-c9wxIE", "J_0jBEgsJhg", "HSeavbzfCl0", "Osi49IsfHD0", "U0WrNxt6YN0",
                              "GyZ1w_QdYD0", "OJX6c0gRYFU", "E7_0DfLL7go", "80XR89fomXo", "oqewXcUl3QY",
                              "aPFwtuJnR54", "ENrOBAZn6Y8", "XMWiqbgTDvg", "m_y7985OlvE", "Fu-kY3JnA0k",
                              "_IfH5TpSEyU", "ANKSUtkDsCw", "HqkEh61xPy4", "DJc8vc6NWKs", "WG3ZAv1Xcwo"
                            ],
                            assignedNode: 5
                          },
                          {
                            id: "custom-1780368214019",
                            name: "focus",
                            videoIds: [
                              "5jpfTtlgnTQ", "W6aparAWkcM", "CTmDTWkVIwc", "xqQMCQjzt2A", "poTDTMzV7VE",
                              "HLOH_EPH_iI", "Z5NVpZ3spew", "kk9yq8ItBg8", "Q-JgSQyQ4H4", "OEdJ5SjX354",
                              "mWQmfJN5Ixs", "5CU_JcFR0T0"
                            ],
                            assignedNode: 4
                          },
                          {
                            id: "custom-1780368699184",
                            name: "James Scholz",
                            videoIds: [
                              "7kgm_k00aqU", "OH4jci9hIew", "uuk0FbpOO7E", "XRd85K2Tfm8", "ZzBXzt71wyY",
                              "GpGpX8I7kHs", "KjDFQWXIPXQ", "lfQQRMAwEHI", "Zze7QPPGSNA", "DiXZCboAD08",
                              "xJudZttWuEY", "Em8Y23I4AUM", "P0qQGvJoK68", "pt0UQm8361A", "cEKYyGOm5m8",
                              "V6vZLCaCoM", "dhfM2b6eIRM", "1jKwCWb3anc", "nIfWhssPDw8", "c9s5jibiPdo",
                              "Nb8en_Mes4s", "XCdmnqEKtl8", "doDZQIbv97U", "hzYtZrQxhW4", "YfW73eQauso",
                              "I-IvCF7CD0A", "qkdUGC-izus", "_WADF7q5o-4", "v8Rb3LdGPnw", "R0d6dZWp8GQ"
                            ],
                            assignedNode: 3
                          }
                        ];
                        setChannels(defaults);
                        localStorage.setItem('aesthetic-room:channels', JSON.stringify(defaults));
                        triggerToast('Presets restored successfully!');
                      }}
                      className="text-[9px] text-gray-400 hover:text-white underline cursor-pointer bg-transparent border-none p-0 transition-colors uppercase font-mono tracking-wider"
                    >
                      Restore Presets
                    </button>
                  </div>
                  
                  <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
                    Choose which channel’s ambient streams loop automatically on your camera nodes. You can delete presets to tailor your library.
                  </p>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {channels.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-white/10 rounded-lg bg-black/20">
                        <span className="text-[10px] text-gray-500 font-mono block">No loop channels active in database.</span>
                        <span className="text-[9px] text-gray-600 font-mono block mt-1">Import a custom channel from YouTube below.</span>
                      </div>
                    ) : (
                      channels.map((channel) => {
                        const isAssigned = channel.assignedNode !== null && channel.assignedNode !== undefined;
                        const nodeIdx = isAssigned ? (channel.assignedNode! - 1) : -1;
                        const currentPlayingIndex = isAssigned ? (nodePlaybackIndices[nodeIdx] ?? 0) : 0;
                        const safePlayingIndex = currentPlayingIndex < channel.videoIds.length ? currentPlayingIndex : 0;

                        return (
                          <div key={channel.id} className="bg-black/35 border border-white/5 p-2.5 rounded-lg space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-grow">
                                <span className="text-xs font-semibold text-gray-200 block truncate">
                                  {channel.name}
                                </span>
                                <span className="text-[9px] text-gray-500 font-mono block">
                                  {channel.videoIds.length} Loop streams loaded
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 shrink-0">
                                <select
                                  value={channel.assignedNode || ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? null : Number(e.target.value);
                                    setChannels(channels.map(c => {
                                      if (c.id === channel.id) {
                                        return { ...c, assignedNode: val };
                                      }
                                      // Auto-unassign other channels for target node to prevent conflict overlay
                                      if (val !== null && c.assignedNode === val) {
                                        return { ...c, assignedNode: null };
                                      }
                                      return c;
                                    }));
                                    triggerToast(`Assigned ${channel.name} to Camera Node ${val ? val : 'None (Manual slot fallback)'}`);
                                  }}
                                  className="bg-black font-semibold border border-white/10 text-[10px] text-gray-300 py-1 px-1.5 rounded cursor-pointer outline-none focus:border-white/30"
                                >
                                  <option value="">Unassigned</option>
                                  <option value="1">Cam Node 1</option>
                                  <option value="2">Cam Node 2</option>
                                  <option value="3">Cam Node 3</option>
                                  <option value="4">Cam Node 4</option>
                                  <option value="5">Cam Node 5</option>
                                  <option value="6">Cam Node 6</option>
                                </select>

                                <button
                                  onClick={() => {
                                    setChannels(channels.filter(c => c.id !== channel.id));
                                    triggerToast(`Deleted channel: ${channel.name}`);
                                  }}
                                  className="p-1 rounded bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-neutral-900 hover:text-red-300 cursor-pointer transition-colors"
                                  title="Delete Channel"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Staggered video items tags display */}
                            <div className="flex flex-wrap gap-1">
                              {channel.videoIds.slice(0, 3).map((vId, vIdx) => (
                                <span key={vIdx} className={`text-[8px] px-1.5 py-0.5 rounded font-mono ${
                                  isAssigned && safePlayingIndex === vIdx
                                    ? 'bg-zinc-200 text-black font-semibold ring-1 ring-white/15 shadow'
                                    : 'bg-white/5 text-gray-400'
                                }`}>
                                  {vId}
                                </span>
                              ))}
                              {channel.videoIds.length > 3 && (
                                <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded font-mono text-gray-500">
                                  +{channel.videoIds.length - 3} more
                                </span>
                              )}
                            </div>

                            {/* Expanded interactive control HUD segment */}
                            {isAssigned && (
                              <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1.5 gap-2">
                                <span className="text-[9px] font-mono tracking-wider text-neutral-450 select-none uppercase font-bold">
                                  Looping: <span className="text-white bg-white/10 px-1 py-0.5 rounded font-mono text-[9px] ml-0.5">{safePlayingIndex + 1}</span>/<span className="text-gray-300">{channel.videoIds.length}</span>
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('aesthetic-room:change-node-index', {
                                        detail: { nodeIdx, action: 'prev' }
                                      }));
                                    }}
                                    className="w-5 h-5 flex items-center justify-center text-[9px] bg-white/5 border border-white/15 text-gray-300 hover:text-white hover:bg-white/10 active:scale-90 rounded cursor-pointer transition-all select-none font-bold"
                                    title="Previous video stream track"
                                  >
                                    ◀
                                  </button>
                                  <button
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('aesthetic-room:change-node-index', {
                                        detail: { nodeIdx, action: 'next' }
                                      }));
                                    }}
                                    className="w-5 h-5 flex items-center justify-center text-[9px] bg-white/5 border border-white/15 text-gray-300 hover:text-white hover:bg-white/10 active:scale-90 rounded cursor-pointer transition-all select-none font-bold"
                                    title="Next video stream track"
                                  >
                                    ▶
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dynamic Creator Option Tab Selector */}
                  <div className="pt-3 border-t border-white/5 space-y-3">
                    <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5">
                      <button
                        onClick={() => setCreatorTab('auto')}
                        className={`flex-1 py-1 text-[10px] font-space font-bold uppercase rounded-md transition-all ${
                          creatorTab === 'auto'
                            ? 'bg-white/10 text-white font-semibold'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        ⚡ Auto-Import Channel
                      </button>
                      <button
                        onClick={() => setCreatorTab('manual')}
                        className={`flex-1 py-1 text-[10px] font-space font-bold uppercase rounded-md transition-all ${
                          creatorTab === 'manual'
                            ? 'bg-white/10 text-white font-semibold'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        ⚙️ Manual Build
                      </button>
                    </div>

                    {creatorTab === 'auto' ? (
                      <div className="space-y-2.5">
                        <span className="text-[10px] font-mono text-gray-400 block leading-normal">
                          Auto-fetch streams! Simply paste any YouTube link or handle. It will scrape, name, and compile all streams into your room loop.
                        </span>
                        
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="e.g. https://www.youtube.com/@i_kkoh/streams"
                            value={importChannelUrl}
                            onChange={(e) => setImportChannelUrl(e.target.value)}
                            disabled={isImporting}
                            className="w-full bg-black/45 border border-white/10 text-xs text-white py-2 pl-3 pr-8 rounded-lg outline-none focus:border-white/20 disabled:opacity-50"
                          />
                          {isImporting && (
                            <div className="absolute right-2.5 top-2.5">
                              <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                            </div>
                          )}
                        </div>

                        <button
                          onClick={async () => {
                            if (!importChannelUrl.trim()) {
                              triggerToast('Please provide a YouTube channel link or handle.');
                              return;
                            }
                            setIsImporting(true);
                            triggerToast('Analyzing YouTube channel feed...');
                            try {
                              const response = await fetch(`/api/youtube/streams?url=${encodeURIComponent(importChannelUrl.trim())}`);
                              const data = await response.json();
                              
                              if (!response.ok || data.success === false) {
                                triggerToast(data.error || 'YouTube parsing failed. Using manual build configuration.');
                              } else {
                                const newCh: StudyChannel = {
                                  id: `custom-${Date.now()}`,
                                  name: data.channelName,
                                  videoIds: data.videoIds,
                                  assignedNode: null
                                };
                                setChannels([...channels, newCh]);
                                setImportChannelUrl('');
                                triggerToast(`Imported ${data.videoIds.length} stream tracks from ${data.channelName}!`);
                              }
                            } catch (e) {
                              triggerToast('Resolution error. Check network or enter details manually.');
                            } finally {
                              setIsImporting(false);
                            }
                          }}
                          disabled={isImporting}
                          className="w-full bg-neutral-200 hover:bg-neutral-300 disabled:opacity-50 text-black font-semibold text-[10px] uppercase py-2 rounded-lg font-space tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1"
                        >
                          {isImporting ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Parsing Stream Grid...
                            </>
                          ) : (
                            'Fetch & Build Stream Loop'
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="e.g. Custom Study Cafe"
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value)}
                          className="w-full bg-black/45 border border-white/10 text-xs text-white py-1.5 px-2.5 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Video Links or 11-char IDs (comma-separated)"
                          value={newChannelVideoIds}
                          onChange={(e) => setNewChannelVideoIds(e.target.value)}
                          className="w-full bg-black/45 border border-white/15 text-xs text-white py-1.5 px-2.5 rounded-lg font-mono placeholder:text-[10px]"
                        />
                        <button
                          onClick={() => {
                            if (!newChannelName.trim()) {
                              triggerToast('Please provide a channel name!');
                              return;
                            }
                            const rawInput = newChannelVideoIds.trim();
                            if (!rawInput) {
                              triggerToast('Please specify stream IDs/Links to play!');
                              return;
                            }
                            const cleanIds = rawInput.split(/[,\s]+/)
                              .map(url => {
                                const trimmed = url.trim();
                                if (!trimmed) return '';
                                if (trimmed.includes('v=')) {
                                  const parts = trimmed.split('v=');
                                  if (parts[1]) return parts[1].split('&')[0];
                                }
                                if (trimmed.includes('youtu.be/')) {
                                  const parts = trimmed.split('youtu.be/');
                                  if (parts[1]) return parts[1].split('?')[0];
                                }
                                if (trimmed.includes('embed/')) {
                                  const parts = trimmed.split('embed/');
                                  if (parts[1]) return parts[1].split('?')[0];
                                }
                                return trimmed;
                              })
                              .filter(Boolean);

                            if (cleanIds.length === 0) {
                              triggerToast('Could not extract any valid YouTube stream ID coordinates.');
                              return;
                            }

                            const addedCh = {
                              id: `custom-${Date.now()}`,
                              name: newChannelName.trim(),
                              videoIds: cleanIds,
                              assignedNode: null
                            };

                            setChannels([...channels, addedCh]);
                            setNewChannelName('');
                            setNewChannelVideoIds('');
                            triggerToast(`Saved Custom Channel: ${addedCh.name}! Assign it to any Cam Node above.`);
                          }}
                          className="w-full bg-neutral-200 hover:bg-neutral-300 text-black font-semibold text-[10px] uppercase py-1.5 rounded-lg font-space tracking-wider cursor-pointer transition-all"
                        >
                          Save Channel Loop
                        </button>
                      </div>
                    )}
                  </div>
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
                        max="2880"
                        value={durationFocus}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          setDurationFocus(val);
                          if (!isRunning && activeTimerMode === 'focus') setTimeLeft(val * 60);
                        }}
                        className="w-full bg-black/40 border border-white/10 p-2 text-xs font-mono rounded-lg outline-none text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-gray-400 block mb-1">Short Break</span>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={durationShort}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          setDurationShort(val);
                          if (!isRunning && activeTimerMode === 'short') setTimeLeft(val * 60);
                        }}
                        className="w-full bg-black/40 border border-white/10 p-2 text-xs font-mono rounded-lg outline-none text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-gray-400 block mb-1">Long Break</span>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={durationLong}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          setDurationLong(val);
                          if (!isRunning && activeTimerMode === 'long') setTimeLeft(val * 60);
                        }}
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

      {/* 7. HIGH-CRAFT MOTIVATIONAL SUCCESS QUOTE OVERLAY */}
      <AnimatePresence>
        {activeQuotePopup && (
          <div className="fixed inset-x-0 top-10 z-[100] flex justify-center px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -55, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.94 }}
              className="pointer-events-auto max-w-lg bg-black/95 border border-emerald-500/30 rounded-2xl p-5 shadow-[0_12px_45px_rgba(16,185,129,0.3)] flex gap-4 backdrop-blur-xl relative"
            >
              <div className="w-1 self-stretch bg-gradient-to-b from-teal-400 to-emerald-500 rounded-full" />
              
              <div className="flex-grow space-y-2 select-none text-left">
                <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-wider text-emerald-400 font-mono font-bold">
                  <span>Success Inspiration Received</span>
                </div>
                
                <p className="font-serif italic text-xs md:text-sm text-gray-100 leading-relaxed font-semibold">
                  "{activeQuotePopup}"
                </p>
                
                <p className="text-[8px] text-gray-500 font-mono tracking-widest text-right uppercase">
                  — Your Zen Study Buddy
                </p>
              </div>

              <button
                onClick={() => setActiveQuotePopup(null)}
                className="self-start text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DRAGGABLE ZEN COMPANION THERAPIST WIDGET */}
      <CompanionBuddyChat
        currentTimerMode={activeTimerMode}
        timeLeft={timeLeft}
        goalsCompleted={sessionLogs.reduce((acc, curr) => acc + (curr.goalsCompleted || 0), 0)}
        goals={goals}
        deadlines={deadlines}
        studyPlans={studyPlans}
        reminders={reminders}
        onAddReminder={handleAddReminder}
        onTriggerQuotePopup={(q) => {
          setActiveQuotePopup(q);
          setTimeout(() => {
            setActiveQuotePopup(prev => prev === q ? null : prev);
          }, 12000);
        }}
        onToggleSilenceReminders={(silence) => {
          setAreRemindersSilenced(silence);
          localStorage.setItem('aesthetic-room:reminders-silenced', String(silence));
          triggerToast(silence ? 'Automated focus reminders muted.' : 'Automated focus reminders active.');
        }}
        areRemindersSilenced={areRemindersSilenced}
        buddyHistory={buddyHistory}
        onHistoryChange={setBuddyHistory}
      />

    </div>
  );
}
