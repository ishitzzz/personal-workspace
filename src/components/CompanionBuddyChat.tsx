/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cat, Send, X, GripHorizontal, BellOff, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StudyPlan, StudyReminder } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CompanionBuddyChatProps {
  currentTimerMode: string;
  timeLeft: number;
  goalsCompleted: number;
  goals?: any[];
  deadlines?: any[];
  studyPlans?: StudyPlan[];
  reminders?: StudyReminder[];
  onAddReminder?: (title: string, minutes: number) => void;
  onTriggerQuotePopup: (quote: string) => void;
  onToggleSilenceReminders?: (silence: boolean) => void;
  areRemindersSilenced?: boolean;
  buddyHistory?: Message[];
  onHistoryChange?: (newHistory: Message[]) => void;
}

export default function CompanionBuddyChat({
  currentTimerMode,
  timeLeft,
  goalsCompleted,
  goals = [],
  deadlines = [],
  studyPlans = [],
  reminders = [],
  onAddReminder,
  onTriggerQuotePopup,
  onToggleSilenceReminders,
  areRemindersSilenced = false,
  buddyHistory,
  onHistoryChange,
}: CompanionBuddyChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('zen-buddy:conversation-history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse zen-buddy chat history:', e);
    }
    return [
      {
        role: 'assistant',
        content: "Hello, my friend. I'm your Llama-powered Zen Study Buddy and Therapist. 🌸\n\nIf you're feeling overwhelmed, anxious, distracted, or find yourself spiraling, please talk to me. I'm designed to listen, understand, and reason through things with genuine warmth. How are you holding up today?"
      }
    ];
  });

  // TTS Speech Synthesis State
  const [playingMessageIdx, setPlayingMessageIdx] = useState<number | null>(null);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Stop TTS if user minimizes or opens dialog to keep it clean and non-eccentric
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setPlayingMessageIdx(null);
    setIsSpeechPaused(false);
  }, [isOpen]);

  // Clean TTS cleanups on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Correct loop-safe local storage and parent synchronizer
  useEffect(() => {
    localStorage.setItem('zen-buddy:conversation-history', JSON.stringify(history));
    if (onHistoryChange) {
      onHistoryChange(history);
    }
  }, [history]);

  // Synchronize history when parent loads a synced profile
  useEffect(() => {
    if (buddyHistory && buddyHistory.length >= 0) {
      const isDifferent = buddyHistory.length !== history.length || 
        JSON.stringify(buddyHistory) !== JSON.stringify(history);
      if (isDifferent) {
        setHistory(buddyHistory.length > 0 ? buddyHistory : [
          {
            role: 'assistant',
            content: "Hello, my friend. I'm your Llama-powered Zen Study Buddy and Therapist. 🌸\n\nIf you're feeling overwhelmed, anxious, distracted, or find yourself spiraling, please talk to me. I'm designed to listen, understand, and reason through things with genuine warmth. How are you holding up today?"
          }
        ]);
      }
    }
  }, [buddyHistory]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isLoading]);

  // Scroll to bottom immediately on opening dialog to start from where spoke last
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 100);
    }
  }, [isOpen]);

  // Core TTS Speach Engine Implementation
  const handleToggleSpeak = (textToSpeak: string, idx: number) => {
    if (!window.speechSynthesis) return;

    // Clean out custom automation brackets/tags before speaking for an extremely clean audio experience
    const cleanSpeechText = textToSpeak
      .replace(/\[\[QUOTE:.*?\]\]/gi, '')
      .replace(/\[\[SET_REMINDER:.*?\]\]/gi, '')
      .replace(/\[\[CREATE_PLAN:.*?\]\]/gi, '')
      .trim();

    if (playingMessageIdx === idx) {
      if (isSpeechPaused) {
        window.speechSynthesis.resume();
        setIsSpeechPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsSpeechPaused(true);
      }
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
      utteranceRef.current = utterance;
      
      const voices = window.speechSynthesis.getVoices();
      // Try to find natural, warm, and highly expressive voices
      const preferredKeywords = [
        'natural',            // Microsoft Natural voices (Jenny Online, Aria Online)
        'samantha',           // Classic warm expressive Apple macOS/iOS voice
        'google us english',  // High quality Google cloud-backed synthesizers
        'jenny',
        'aria',
        'daniel',
        'moira',
        'karen'
      ];
      
      let targetVoice = null;
      for (const keyword of preferredKeywords) {
        const found = voices.find(v => 
          v.name.toLowerCase().includes(keyword) && 
          (v.lang.startsWith('en-US') || v.lang.startsWith('en'))
        );
        if (found) {
          targetVoice = found;
          break;
        }
      }
      
      if (!targetVoice) {
        targetVoice = voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
      }

      if (targetVoice) {
        utterance.voice = targetVoice;
      }

      // Elegant expressive calibration for Therapist/Study Llama buddy:
      // Slightly more relaxed, comfortable rate (0.93) and warm pitch level (1.04)
      utterance.rate = 0.93;
      utterance.pitch = 1.04;

      utterance.onend = () => {
        setPlayingMessageIdx(null);
        setIsSpeechPaused(false);
      };
      utterance.onerror = () => {
        setPlayingMessageIdx(null);
        setIsSpeechPaused(false);
      };

      window.speechSynthesis.speak(utterance);
      setPlayingMessageIdx(idx);
      setIsSpeechPaused(false);
    }
  };

  const handlePlayAllAssistantMessages = () => {
    const jointText = history
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n\n');
    if (jointText) {
      handleToggleSpeak(jointText, -999);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputMsg).trim();
    if (!text && !customText) return;

    if (!customText) setInputMsg('');

    const newHistory = [...history, { role: 'user', content: text } as Message];
    setHistory(newHistory);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: newHistory.slice(-40),
          isBuddyCounselor: true,
          model: 'llama-3.3-70b-versatile',
          context: {
            timerState: `${currentTimerMode} Mode counting down at ${Math.floor(timeLeft / 60)}m left`,
            goalsCompleted,
            goals,
            deadlines,
            studyPlans,
            reminders
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        let reply = data.reply || "Let's breathe deep together and center our minds.";

        // Special parsed triggers inside the Therapist AI buddy:
        const quoteRegex = /\[\[QUOTE:\s*"(.*?)"\s*\]\]/i;
        const quoteMatch = reply.match(quoteRegex);
        if (quoteMatch && quoteMatch[1]) {
          onTriggerQuotePopup(quoteMatch[1]);
        }

        const reminderRegex = /\[\[SET_REMINDER:\s*({.*?})\s*\]\]/i;
        const reminderMatch = reply.match(reminderRegex);
        if (reminderMatch && reminderMatch[1]) {
          try {
            const parsedRem = JSON.parse(reminderMatch[1]);
            if (onAddReminder && parsedRem.title && parsedRem.minutes) {
              onAddReminder(parsedRem.title, Number(parsedRem.minutes));
            }
          } catch (e) {
            console.warn('[Buddy Engine] Failed to auto-register reminder tag:', e);
          }
        }

        const lowerInput = text.toLowerCase();
        if (lowerInput.includes('reminders off') || lowerInput.includes('turn off reminders') || lowerInput.includes('mute reminders') || lowerInput.includes('silence reminders')) {
          if (onToggleSilenceReminders) {
            onToggleSilenceReminders(true);
          }
        } else if (lowerInput.includes('reminders on') || lowerInput.includes('activate reminders') || lowerInput.includes('unmute reminders')) {
          if (onToggleSilenceReminders) {
            onToggleSilenceReminders(false);
          }
        }

        const filteredReply = reply
          .replace(/\[\[QUOTE:.*?\]\]/gi, '')
          .replace(/\[\[SET_REMINDER:.*?\]\]/gi, '')
          .trim();

        setHistory([...newHistory, { role: 'assistant', content: filteredReply }]);
      } else {
        setHistory([...newHistory, { role: 'assistant', content: "My thoughts got a little cloudy just now. Let's close our eyes, take a slow breath, and try again in a moment." }]);
      }
    } catch (err) {
      console.error('[Buddy Chat] API request failure:', err);
      setHistory([...newHistory, { role: 'assistant', content: "I am having temporary trouble checking Groq keys. But remember, you are doing great. Keep focus on the simple goals in front of you." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Reset conversation and start fresh with your buddy therapist?")) {
      setHistory([
        {
          role: 'assistant',
          content: "Mind cleared. Let's start fresh, my friend. How are you holding up inside your headspace right now?"
        }
      ]);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-auto">
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="buddy-compact-badge"
            id="draggable-buddy-toggle-badge"
            onDragStart={() => {
              isDraggingRef.current = true;
            }}
            onDragEnd={() => {
              setTimeout(() => {
                isDraggingRef.current = false;
              }, 120);
            }}
            onClick={() => {
              if (!isDraggingRef.current) {
                setIsOpen(true);
              }
            }}
            drag
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{ left: -1400, right: 1400, top: -1400, bottom: 1400 }}
            className="flex items-center gap-2 bg-black hover:bg-zinc-900 text-white shadow-[0_8px_30px_rgba(0,0,0,0.85)] border border-zinc-800 px-4 py-3 rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none"
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            title="Draggable Study Buddy & Therapist (Llama 3.3)"
          >
            <Cat className="w-5 h-5 text-white" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider select-none">Talk to Buddy</span>
          </motion.button>
        )}

        {isOpen && (
          <motion.div
            key="buddy-chat-floating-dialog"
            id="draggable-buddy-chat-panel"
            drag
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{ left: -1400, right: 1400, top: -1400, bottom: 1400 }}
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="w-96 sm:w-[445px] h-[calc(100vh-140px)] max-h-[680px] bg-black border border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden backdrop-blur-md"
          >
            {/* Draggable Handle and Header */}
            <div className="draggable-drag-handle-bar bg-zinc-950 border-b border-zinc-900 py-3 px-4 flex items-center justify-between cursor-move select-none">
              <div className="flex items-center gap-2.5">
                <GripHorizontal className="w-4 h-4 text-zinc-600 pointer-events-none" />
                <div className="flex items-center gap-2 pointer-events-none">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-white font-bold">Llama study buddy</h4>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Global Read Conversation History Button */}
                {history.some(m => m.role === 'assistant') && (
                  <button
                    onClick={handlePlayAllAssistantMessages}
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer font-mono text-[9px] font-bold mr-1"
                    title="Synthesize conversation stream to audio TTS"
                  >
                    {playingMessageIdx === -999 ? (
                      <>
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        <span>{isSpeechPaused ? 'RESUME ALL' : 'PAUSE ALL'}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-2.5 h-2.5 text-zinc-400" />
                        <span>PLAY CHAT</span>
                      </>
                    )}
                  </button>
                )}

                {onToggleSilenceReminders && (
                  <button
                    onClick={() => onToggleSilenceReminders(!areRemindersSilenced)}
                    className={`p-1.5 rounded-lg hover:bg-zinc-900 transition-all cursor-pointer ${areRemindersSilenced ? 'text-white font-bold' : 'text-zinc-500 hover:text-white'}`}
                    title={areRemindersSilenced ? "Reminders muted" : "Mute automated reminders"}
                  >
                    <BellOff className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
                  title="Minimize chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation Messages area */}
            <div 
              ref={chatContainerRef}
              className="flex-grow overflow-y-auto overflow-x-hidden p-4 space-y-4 text-xs font-mono bg-black custom-scrollbar-buddy"
            >
              <div className="flex justify-center">
                <div className="bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1.5 text-[8.5px] uppercase text-zinc-400 text-center tracking-wider font-bold">
                  🤖 Chat Companion • Powered by Llama 3.3
                </div>
              </div>

              {history.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed relative break-words ${
                    m.role === 'user'
                      ? 'bg-zinc-800 text-white self-end ml-auto border border-zinc-700'
                      : 'bg-zinc-900 border border-zinc-850 text-neutral-200 self-start mr-auto'
                  }`}
                >
                  <div className="flex items-center justify-between gap-6 mb-1.5 select-none">
                    <span className="text-[8px] font-bold tracking-wider text-zinc-500 uppercase pointer-events-none">
                      {m.role === 'user' ? 'student' : 'buddy'}
                    </span>
                    
                    {m.role === 'assistant' && (
                      <button
                        onClick={() => handleToggleSpeak(m.content, idx)}
                        className="text-[8px] text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-850 hover:border-zinc-700 transition-all flex items-center gap-1 cursor-pointer font-bold uppercase tracking-wider h-5"
                        title="Read this message response out loud"
                      >
                        {playingMessageIdx === idx ? (
                          <>
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                            <span>{isSpeechPaused ? 'RESUME' : 'PAUSE'}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-2.5 h-2.5 text-zinc-400" />
                            <span>SPEAK</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  
                  <div className="markdown-body select-text text-left text-[11px] sm:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="bg-zinc-900 border border-zinc-850 text-neutral-400 rounded-xl px-3 py-2.5 self-start mr-auto flex items-center gap-1.5 max-w-[85%]">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-widest pl-1 font-bold">Thinking...</span>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            {/* Quick response suggestive cards */}
            <div className="p-2.5 flex-shrink-0 border-t border-zinc-900 bg-zinc-950 flex gap-2 overflow-x-auto overflow-y-hidden select-none font-mono no-scrollbar-buddy">
              <button
                onClick={() => handleSendMessage("I'm starting to get distracted. Can you keep me on track?")}
                className="flex-shrink-0 text-[10px] text-zinc-350 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-750 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
              >
                Distraction Spiral
              </button>
              <button
                onClick={() => handleSendMessage("Give me a powerful success quote to fuel me up right now.")}
                className="flex-shrink-0 text-[10px] text-zinc-350 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-750 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
              >
                Motivational Quote
              </button>
              <button
                onClick={() => handleSendMessage("I have some study anxiety and deadlines stress. Let's chat.")}
                className="flex-shrink-0 text-[10px] text-zinc-350 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-750 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
              >
                Anxiety Support
              </button>
              <button
                onClick={() => handleSendMessage("Can we organize a quick 15-minute relaxation timer break?")}
                className="flex-shrink-0 text-[10px] text-zinc-350 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-750 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
              >
                Time Out Break
              </button>
            </div>

            {/* Input form area */}
            <div className="p-3 flex-shrink-0 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between gap-2">
              <input
                type="text"
                placeholder="Talk to your Llama Zen Buddy..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-grow bg-zinc-900 border border-zinc-800 focus:border-zinc-600 text-xs py-2.5 px-3.5 rounded-xl text-white outline-none font-mono tracking-wide transition-colors"
                autoFocus
              />

              <button
                onClick={() => handleSendMessage()}
                className="bg-white hover:bg-zinc-200 text-black p-2.5 rounded-xl transition-all shadow-md cursor-pointer hover:scale-105"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Custom Embedded Scrollbar Overrides Style Block */}
            <style>{`
              #draggable-buddy-chat-panel *::-webkit-scrollbar {
                width: 6px !important;
                height: 0px !important;
              }
              #draggable-buddy-chat-panel *::-webkit-scrollbar-track {
                background: transparent !important;
              }
              #draggable-buddy-chat-panel *::-webkit-scrollbar-thumb {
                background-color: #27272a !important; /* zinc-800 */
                border-radius: 999px !important;
              }
              #draggable-buddy-chat-panel *::-webkit-scrollbar-thumb:hover {
                background-color: #3f3f46 !important; /* zinc-700 */
              }
              .custom-scrollbar-buddy {
                scrollbar-width: thin !important;
                scrollbar-color: #27272a transparent !important;
                overflow-x: hidden !important;
              }
              
              .no-scrollbar-buddy::-webkit-scrollbar {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
              }
              .no-scrollbar-buddy {
                -ms-overflow-style: none !important;
                scrollbar-width: none !important;
              }

              /* Elegant Academic Markdown & Table Styles */
              .markdown-body {
                font-family: inherit;
                line-height: 1.6;
                color: #e4e4e7; /* zinc-200 */
              }
              .markdown-body p {
                margin-top: 0px;
                margin-bottom: 8px;
              }
              .markdown-body p:last-child {
                margin-bottom: 0px;
              }
              .markdown-body ul {
                list-style-type: disc !important;
                padding-left: 18px !important;
                margin-bottom: 8px;
              }
              .markdown-body ol {
                list-style-type: decimal !important;
                padding-left: 18px !important;
                margin-bottom: 8px;
              }
              .markdown-body li {
                margin-bottom: 4px;
              }
              .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
                font-weight: bold;
                color: #ffffff;
                margin-top: 12px;
                margin-bottom: 4px;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
              .markdown-body table {
                width: 100%;
                border-collapse: collapse;
                margin: 12px 0px;
                font-size: 10px;
                border: 1px solid #27272a;
              }
              .markdown-body th {
                background-color: #09090b;
                border: 1px solid #27272a;
                padding: 6px 10px;
                font-weight: bold;
                text-align: left;
                color: #ffffff;
              }
              .markdown-body td {
                border: 1px solid #27272a;
                padding: 6px 10px;
                background-color: #121214;
              }
              .markdown-body blockquote {
                border-left: 3px solid #3f3f46;
                padding-left: 8px;
                color: #a1a1aa;
                font-style: italic;
                margin-bottom: 8px;
              }
              .markdown-body code {
                font-family: monospace;
                font-size: 9px;
                background-color: #18181b;
                padding: 2px 4px;
                border-radius: 4px;
                color: #f4f4f5;
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
