/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cat, Send, X, GripHorizontal, BellOff, Volume2 } from 'lucide-react';
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

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist conversation history
  useEffect(() => {
    localStorage.setItem('zen-buddy:conversation-history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isLoading]);

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
          history: newHistory.slice(-10),
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
            onClick={() => setIsOpen(true)}
            drag
            dragMomentum={false}
            dragElastic={0.02}
            dragConstraints={{ left: -1200, right: 1200, top: -1200, bottom: 1200 }}
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
            dragHandleClassName="draggable-drag-handle-bar"
            dragMomentum={false}
            dragElastic={0.02}
            dragConstraints={{ left: -1200, right: 1200, top: -1200, bottom: 1200 }}
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
                  <span className="text-[8px] font-bold tracking-wider text-zinc-500 uppercase mb-1 pointer-events-none select-none">
                    {m.role === 'user' ? 'student' : 'buddy'}
                  </span>
                  <p className="whitespace-pre-wrap break-words select-text text-[11px] sm:text-xs text-left">{m.content}</p>
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
              <button
                onClick={clearHistory}
                className="p-2.5 rounded-xl border border-zinc-850 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer animate-fade"
                title="Reset conversation"
              >
                <X className="w-4 h-4" />
              </button>

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
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
