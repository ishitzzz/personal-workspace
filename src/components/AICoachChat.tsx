/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Brain, Clock, Coffee, ShieldAlert } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AICoachChatProps {
  currentTimerMode: string;
  timeLeft: number;
  goalsCompleted: number;
  messages: Message[];
  onSetMessages: (updated: Message[]) => void;
}

export default function AICoachChat({
  currentTimerMode,
  timeLeft,
  goalsCompleted,
  messages,
  onSetMessages,
}: AICoachChatProps) {
  const [inputMsg, setInputMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = textToSend || inputMsg;
    if (!content.trim() || isLoading) return;

    if (!textToSend) setInputMsg('');
    
    const updatedMessages = [...messages, { role: 'user', content } as Message];
    onSetMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: updatedMessages.slice(-5), // share latest conversation snapshots
          context: {
            timerState: `${currentTimerMode} Countdown at ${Math.floor(timeLeft / 60)}m`,
            goalsCompleted
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        onSetMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
      } else {
        onSetMessages([...updatedMessages, { role: 'assistant', content: "My thoughts are slightly scattered. Let me double-check my parameters." }]);
      }
    } catch {
      onSetMessages([...updatedMessages, { role: 'assistant', content: "My connection is a little hazy. Keep working diligently on your targets in the meantime!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="bg-black/55 rounded-2xl border border-white/10 p-5 flex flex-col h-[320px] sm:h-[400px] justify-between">
      {/* Header section of chatbot */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-gray-200" />
          <div>
            <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-widest font-mono">Zen AI assistant</h3>
            <p className="text-[9px] text-gray-400 font-mono">Running on Groq (llama-3.3)</p>
          </div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      {/* Messages Feed panel */}
      <div className="flex-grow overflow-y-auto space-y-3 pr-1 text-xs mb-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col max-w-[85%] rounded-xl p-3 ${
              m.role === 'user'
                ? 'bg-white text-black self-end ml-auto'
                : 'bg-white/5 border border-white/5 text-gray-200 self-start mr-auto font-mono'
            }`}
          >
            <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mb-1">
              {m.role === 'user' ? 'You' : 'Coach Llama'}
            </span>
            <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="bg-white/5 border border-white/5 text-gray-300 rounded-xl p-3 self-start mr-auto flex items-center gap-2 max-w-[85%] font-mono">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="text-[10px] text-gray-400 uppercase font-mono tracking-widest pl-1">Thinking...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Instant suggestions triggers */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <button
          onClick={() => handleSuggestionPrompt("Suggest a 5-minute physical stretch checklist!")}
          className="text-[10px] bg-white/5 border border-white/5 hover:border-white/15 px-2 py-1.5 rounded-lg text-left text-gray-300 font-mono flex items-center gap-1.5"
        >
          <Coffee className="w-3.5 h-3.5" />
          Stretch exercise
        </button>
        <button
          onClick={() => handleSuggestionPrompt("Is it time for a water break? Keep me hydrated!")}
          className="text-[10px] bg-white/5 border border-white/5 hover:border-white/15 px-2 py-1.5 rounded-lg text-left text-gray-300 font-mono flex items-center gap-1.5"
        >
          <Clock className="w-3.5 h-3.5" />
          Water Reminder
        </button>
      </div>

      {/* Input panel row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask Llama study advisor..."
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-grow bg-black/45 border border-white/10 focus:border-white text-xs outline-none py-2 px-3 rounded-xl text-white outline-none"
        />
        <button
          onClick={() => handleSendMessage()}
          className="bg-white hover:bg-gray-100 text-black p-2 rounded-xl transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
