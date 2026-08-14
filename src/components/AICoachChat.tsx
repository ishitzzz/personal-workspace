/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Clock, Coffee, Sparkles, Paperclip, FileText, CheckCircle, Trash2, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StudyPlan, StudyReminder } from '../types';

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
  onAddReminder?: (title: string, minutes: number) => void;
  onAddStudyPlan?: (plan: any) => void;
  goals?: any[];
  deadlines?: any[];
  studyPlans?: StudyPlan[];
  reminders?: StudyReminder[];
}

export default function AICoachChat({
  currentTimerMode,
  timeLeft,
  goalsCompleted,
  messages,
  onSetMessages,
  onAddReminder,
  onAddStudyPlan,
  goals = [],
  deadlines = [],
  studyPlans = [],
  reminders = [],
}: AICoachChatProps) {
  const [inputMsg, setInputMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeModel, setActiveModel] = useState<'llama-3.3-70b-versatile' | 'qwen/qwen3-32b' | 'openai/gpt-oss-20b'>(() => {
    return (localStorage.getItem('aesthetic-room:selected-coach-model') as any) || 'llama-3.3-70b-versatile';
  });

  // Attached files state
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; base64?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleModelChange = (model: 'llama-3.3-70b-versatile' | 'qwen/qwen3-32b' | 'openai/gpt-oss-20b') => {
    setActiveModel(model);
    localStorage.setItem('aesthetic-room:selected-coach-model', model);
  };

  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        type: file.type,
        base64: typeof reader.result === 'string' ? reader.result : undefined
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const content = textToSend || inputMsg;
    if (!content.trim() && !attachedFile && !textToSend) return;

    if (!textToSend) setInputMsg('');
    
    // Build user message body with file decoration if parsed
    let userMsgText = content;
    let textToSubmit = content;
    if (attachedFile) {
      userMsgText = `📎 [Attached: ${attachedFile.name}]\n${content}`;
      textToSubmit = `Study material attachment: ${attachedFile.name}. Content type: ${attachedFile.type}. User prompt: ${content}`;
      setAttachedFile(null); // Clear attachment field
    }

    const updatedMessages = [...messages, { role: 'user', content: userMsgText } as Message];
    onSetMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSubmit,
          history: updatedMessages.slice(-8), // Elevated conversation snapshot history
          model: activeModel,
          context: {
            timerState: `${currentTimerMode} Countdown at ${Math.floor(timeLeft / 60)}m`,
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
        let reply = data.reply || 'Diligently focus and breathe.';

        // Search for automatic action SET_REMINDER tag -> [[SET_REMINDER: {"title": "X", "minutes": Y}]]
        const reminderRegex = /\[\[SET_REMINDER:\s*({.*?})\s*\]\]/i;
        const reminderMatch = reply.match(reminderRegex);
        if (reminderMatch) {
          try {
            const parsedReminder = JSON.parse(reminderMatch[1]);
            if (onAddReminder && parsedReminder.title && parsedReminder.minutes) {
              onAddReminder(parsedReminder.title, Number(parsedReminder.minutes));
            }
          } catch (err) {
            console.warn('[Automation Engine] Failed to parse SET_REMINDER:', err);
          }
        }

        // Search for automatic action CREATE_PLAN tag -> [[CREATE_PLAN: {"title": "X", ...}]]
        const planRegex = /\[\[CREATE_PLAN:\s*({.*?})\s*\]\]/i;
        const planMatch = reply.match(planRegex);
        if (planMatch) {
          try {
            const parsedPlan = JSON.parse(planMatch[1]);
            if (onAddStudyPlan && parsedPlan.title) {
              // Ensure proper structural mapping
              onAddStudyPlan(parsedPlan);
            }
          } catch (err) {
            console.warn('[Automation Engine] Failed to parse CREATE_PLAN:', err);
          }
        }

        // Clean out action brackets from rendering on the conversation pane for high aesthetic design
        const cleanReply = reply
          .replace(/\[\[SET_REMINDER:.*?\]\]/gi, '')
          .replace(/\[\[CREATE_PLAN:.*?\]\]/gi, '')
          .trim();

        onSetMessages([...updatedMessages, { role: 'assistant', content: cleanReply }]);
      } else {
        onSetMessages([...updatedMessages, { role: 'assistant', content: "My cognitive model answers are temporarily hazy. Staying in clean zen silence." }]);
      }
    } catch {
      onSetMessages([...updatedMessages, { role: 'assistant', content: "My connection to Groq is slightly quiet. Proceed offline and stay focused!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="bg-black/55 rounded-2xl border border-white/10 p-5 flex flex-col h-[480px] sm:h-[500px] justify-between">
      {/* Header controls for model selections */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-gray-200" />
          <div>
            <h3 className="text-xs font-semibold text-gray-100 uppercase tracking-widest font-mono">Zen AI assistant</h3>
            <p className="text-[9px] text-gray-400 font-mono">Cognitive Support Unit</p>
          </div>
        </div>

        {/* Model switcher row option */}
        <div className="flex items-center bg-black/45 border border-white/10 rounded-xl p-0.5 self-start sm:self-auto">
          <button
            onClick={() => handleModelChange('llama-3.3-70b-versatile')}
            className={`px-1.5 py-0.5 rounded-lg text-[8px] font-mono uppercase transition-all font-bold ${
              activeModel === 'llama-3.3-70b-versatile'
                ? 'bg-neutral-800 text-white border-white/10'
                : 'text-gray-500 hover:text-gray-200'
            }`}
            title="Llama 3.3 (Cozy/Basic study guide)"
          >
            Llama 3.3
          </button>
          <button
            onClick={() => handleModelChange('qwen/qwen3-32b')}
            className={`px-1.5 py-0.5 rounded-lg text-[8px] font-mono uppercase transition-all font-bold ${
              activeModel === 'qwen/qwen3-32b'
                ? 'bg-white text-black'
                : 'text-gray-500 hover:text-gray-200'
            }`}
            title="Qwen 32B (Planning and syllabus reasoning)"
          >
            Qwen 3-32B
          </button>
          <button
            onClick={() => handleModelChange('openai/gpt-oss-20b')}
            className={`px-1.5 py-0.5 rounded-lg text-[8px] font-mono uppercase transition-all font-bold ${
              activeModel === 'openai/gpt-oss-20b'
                ? 'bg-yellow-400 text-neutral-950'
                : 'text-gray-500 hover:text-gray-200'
            }`}
            title="GPT-OSS 20B (Empathetic study counselor)"
          >
            GPT-OSS
          </button>
        </div>
      </div>

      {/* Messages feed */}
      <div className="flex-grow overflow-y-auto space-y-3 pr-1 text-xs mb-3 font-mono">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col max-w-[85%] rounded-xl p-3 ${
              m.role === 'user'
                ? 'bg-white text-black self-end ml-auto'
                : 'bg-white/5 border border-white/5 text-gray-200 self-start mr-auto'
            }`}
          >
            <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mb-1 select-none">
              {m.role === 'user' ? 'Student' : activeModel === 'qwen/qwen3-32b' ? 'Qwen Planner' : activeModel === 'openai/gpt-oss-20b' ? 'Zen Therapist' : 'Coach Llama'}
            </span>
            <div className="markdown-body select-text text-left">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {m.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="bg-white/5 border border-white/5 text-gray-300 rounded-xl p-3 self-start mr-auto flex items-center gap-2 max-w-[85%] font-mono">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="text-[10px] text-gray-400 uppercase font-mono tracking-widest pl-1">Reasoning...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Upload attachment banner */}
      {attachedFile && (
        <div className="bg-white/5 border border-white/5 p-2 rounded-xl mb-3 flex items-center justify-between text-[10px] text-gray-300">
          <div className="flex items-center gap-1.5 font-mono">
            <FileText className="w-4 h-4 text-gray-400 animate-pulse" />
            <span className="truncate max-w-44 font-semibold">{attachedFile.name} (Ready to send)</span>
          </div>
          <button
            onClick={() => setAttachedFile(null)}
            className="text-red-400 hover:text-red-300 font-bold"
          >
            Remove
          </button>
        </div>
      )}

      {/* Suggestion fast buttons */}
      <div className="grid grid-cols-2 gap-1.5 mb-3 font-mono">
        <button
          onClick={() => handleSuggestionPrompt(activeModel === 'openai/gpt-oss-20b' ? "Help me destress. Give me emotional reassurance." : "Suggest a quick 5-minute study breakdown routine!")}
          className="text-[9px] bg-white/5 border border-white/5 hover:border-white/10 px-2.5 py-1.5 rounded-lg text-left text-gray-300 flex items-center gap-1.5"
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>{activeModel === 'openai/gpt-oss-20b' ? "Calm Reassurance" : "Study Breakdown"}</span>
        </button>
        <button
          onClick={() => handleSuggestionPrompt("Set up my water hydration countdown alert for 15 minutes!")}
          className="text-[9px] bg-white/5 border border-white/5 hover:border-white/10 px-2.5 py-1.5 rounded-lg text-left text-gray-300 flex items-center gap-1.5"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Set water reminder</span>
        </button>
      </div>

      {/* Input panel with upload paperclip option */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,application/pdf,text/*"
          className="hidden"
        />
        <button
          onClick={handleFileUploadClick}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            attachedFile ? 'bg-white/15 border-white text-white' : 'bg-black/45 border-white/10 text-gray-400 hover:text-white'
          }`}
          title="Upload Syllabus PDF, Schedule Image, or Material"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          placeholder={activeModel === 'qwen/qwen3-32b' ? "Ask Qwen study planner scheduler..." : activeModel === 'openai/gpt-oss-20b' ? "Tell Zen Therapist how you feel..." : "Ask Coach Llama..."}
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-grow bg-black/45 border border-white/10 focus:border-white text-xs outline-none py-2 px-3 rounded-xl text-white outline-none font-mono"
        />
        <button
          onClick={() => handleSendMessage()}
          className="bg-white hover:bg-gray-100 text-black p-2 rounded-xl transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Elegant Academic Markdown & Table Styles scoped to Coach planner */}
      <style>{`
        .markdown-body {
          font-family: inherit;
          line-height: 1.62;
          color: #d1d5db; /* gray-300 */
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
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .markdown-body th {
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 6px 10px;
          font-weight: bold;
          text-align: left;
          color: #ffffff;
        }
        .markdown-body td {
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 6px 10px;
          background-color: rgba(0, 0, 0, 0.25);
        }
        .markdown-body blockquote {
          border-left: 3px solid rgba(255, 255, 255, 0.3);
          padding-left: 8px;
          color: #9ca3af;
          font-style: italic;
          margin-bottom: 8px;
        }
        .markdown-body code {
          font-family: monospace;
          font-size: 9px;
          background-color: rgba(255, 255, 255, 0.08);
          padding: 2px 4px;
          border-radius: 4px;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
