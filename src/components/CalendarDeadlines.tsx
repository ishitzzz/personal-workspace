/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Deadline, FocusSessionLog } from '../types';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Check, AlertCircle } from 'lucide-react';

interface CalendarDeadlinesProps {
  deadlines: Deadline[];
  logs: FocusSessionLog[];
  onAddDeadline: (title: string, date: string, priority: 'low' | 'medium' | 'high') => void;
  onToggleDeadline: (id: string) => void;
  onDeleteDeadline: (id: string) => void;
}

export default function CalendarDeadlines({
  deadlines,
  logs,
  onAddDeadline,
  onToggleDeadline,
  onDeleteDeadline,
}: CalendarDeadlinesProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Interactive submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onAddDeadline(title, date, priority);
    setTitle('');
    setDate('');
  };

  // Build calendar matrix values for current month (May 2026/Current month)
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayIndex = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayIndex(year, month);
  const monthLabel = today.toLocaleDateString([], { month: 'long', year: 'numeric' });

  // Generate calendar cells (blanks then consecutive numbers)
  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push(i);
  }

  // Map session logs to day integer for active checkmarks
  const logsSet = new Set<number>();
  logs.forEach(log => {
    try {
      const d = new Date(log.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        logsSet.add(d.getDate());
      }
    } catch {}
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-transparent">
      {/* Column Left: Visual Month Calendar Grid */}
      <div className="bg-black/55 rounded-2xl border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-200" />
            <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wide">{monthLabel}</h3>
          </div>
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 py-0.5 px-2 rounded-full border border-emerald-500/20">
            {logsSet.size} days active streak
          </span>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] text-gray-400 uppercase font-semibold">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>

        {/* Calendar Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            if (cell === null) {
              return <div key={`empty-${idx}`} className="aspect-square bg-transparent rounded-lg" />;
            }

            const isCurrentDay = cell === today.getDate();
            const hasActivity = logsSet.has(cell);

            return (
              <div
                key={`day-${cell}`}
                className={`aspect-square flex flex-col items-center justify-between p-1 rounded-lg text-xs font-semibold relative transition-all ${
                  isCurrentDay 
                    ? 'bg-white text-black ring-2 ring-white/20' 
                    : 'bg-white/5 text-gray-300 border border-white/5'
                }`}
              >
                <span>{cell}</span>
                {hasActivity && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isCurrentDay ? 'bg-black' : 'bg-emerald-400'} animate-pulse`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="text-[9px] text-gray-500 font-mono flex items-center gap-2 justify-center bg-black/20 p-2 rounded-lg border border-white/5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 block" /> Represents focus check-ins on that date
        </div>
      </div>

      {/* Column Right: Interactive Deadlines manager sorted by closest */}
      <div className="bg-black/55 rounded-2xl border border-white/10 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-200" />
              <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wide">Work Priorities & Deadlines</h3>
            </div>
            <span className="text-[10px] font-mono text-gray-300 bg-white/5 py-0.5 px-2 rounded-full">
              {deadlines.filter(dl => !dl.completed).length} remaining
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 mb-4">
            <input
              type="text"
              placeholder="Target task/exam title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black/45 border border-white/10 focus:border-white text-xs outline-none py-2 px-3 rounded-xl text-white outline-none transition-colors"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-black/45 border border-white/10 focus:border-white text-xs outline-none py-1.5 px-2.5 rounded-xl text-white outline-none"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="bg-black/45 border border-white/10 text-xs py-1.5 px-2 rounded-xl text-gray-300"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">Urgent/High</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-white hover:bg-gray-100 text-black font-semibold text-xs py-2 rounded-xl active:scale-98 transition-all cursor-pointer"
            >
              Add Deadline
            </button>
          </form>

          {/* List items with priorities */}
          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
            {deadlines.map((dl) => (
              <div
                key={dl.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-xs transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => onToggleDeadline(dl.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                      dl.completed 
                        ? 'bg-neutral-200 border-neutral-200 text-black' 
                        : 'border-white/20 hover:border-white/30 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3px]" />
                  </button>
                  <div className="min-w-0">
                    <div className={`truncate font-semibold ${dl.completed ? 'line-through text-gray-500' : 'text-slate-200'}`}>
                      {dl.title}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      Due: {dl.date}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${
                    dl.priority === 'high' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                    dl.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                    'bg-gray-500/10 border-gray-500/30 text-gray-300'
                  }`}>
                    {dl.priority}
                  </span>
                  <button
                    onClick={() => onDeleteDeadline(dl.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {deadlines.length === 0 && (
              <div className="text-center py-6 text-gray-500 text-xs italic">
                No active deadlines registered. Take it easy!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
