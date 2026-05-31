/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { HeatMapConfig, FocusSessionLog } from '../types';
import { Calendar, Palette, Layers, Trash2 } from 'lucide-react';

interface HeatMapProps {
  logs: FocusSessionLog[];
  config: HeatMapConfig;
  onConfigChange: (newConfig: Partial<HeatMapConfig>) => void;
  onClearLogs?: () => void;
}

export default function HeatMap({ logs, config, onConfigChange, onClearLogs }: HeatMapProps) {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; mins: number; goals: number } | null>(null);

  // Helper: Gather last N days worth of list
  const getDaysArray = (range: string) => {
    const daysToShow = 
      range === 'week' ? 7 :
      range === 'month' ? 30 :
      range === '3month' ? 90 :
      range === '6month' ? 180 : 365;

    const arr = [];
    const today = new Date();
    
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      arr.push({
        date: dateString,
        dayOfWeek: d.getDay(),
        label: d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      });
    }
    return arr;
  };

  const activeDays = getDaysArray(config.viewRange);

  // Map logs for effortless fast read matches
  const logsMap = new Map<string, FocusSessionLog>();
  logs.forEach(log => {
    logsMap.set(log.date, log);
  });

  // Calculate maximum score for relative intensities
  let maxScore = 1;
  activeDays.forEach(day => {
    const log = logsMap.get(day.date);
    if (log) {
      const score = (log.durationMinutes || 0) + (log.goalsCompleted || 0) * 15;
      if (score > maxScore) maxScore = score;
    }
  });

  // Color mapper depending on the chosen color palette theme
  const getIntensityColor = (score: number) => {
    if (score === 0) return 'bg-white/5 border border-white/5';
    
    const fraction = score / maxScore;
    const level = 
      fraction < 0.25 ? 1 :
      fraction < 0.50 ? 2 :
      fraction < 0.75 ? 3 : 4;

    if (config.palette === 'emerald') {
      if (level === 1) return 'bg-emerald-950 text-emerald-200 border-emerald-900/40';
      if (level === 2) return 'bg-emerald-800 text-emerald-100 border-emerald-700/40';
      if (level === 3) return 'bg-emerald-600 text-white border-emerald-500/40';
      return 'bg-emerald-400 text-emerald-950 border-emerald-300 font-bold';
    }

    if (config.palette === 'sapphire') {
      if (level === 1) return 'bg-blue-950 text-blue-200 border-blue-900/40';
      if (level === 2) return 'bg-blue-800 text-blue-100 border-blue-700/40';
      if (level === 3) return 'bg-blue-600 text-white border-blue-500/40';
      return 'bg-cyan-400 text-cyan-950 border-cyan-300 font-bold';
    }

    if (config.palette === 'amber') {
      if (level === 1) return 'bg-amber-950 text-amber-200 border-amber-900/40';
      if (level === 2) return 'bg-amber-800 text-amber-100 border-amber-700/40';
      if (level === 3) return 'bg-amber-600 text-white border-amber-500/40';
      return 'bg-amber-400 text-amber-950 border-amber-300 font-bold';
    }

    if (config.palette === 'crimson') {
      if (level === 1) return 'bg-red-950 text-red-200 border-red-900/40';
      if (level === 2) return 'bg-red-800 text-red-100 border-red-700/40';
      if (level === 3) return 'bg-red-600 text-white border-red-500/40';
      return 'bg-red-400 text-red-950 border-red-300 font-bold';
    }

    // Default monochrome slate gray minimalist aesthetic!
    if (level === 1) return 'bg-neutral-800 text-neutral-200 border-neutral-700';
    if (level === 2) return 'bg-neutral-600 text-neutral-100 border-neutral-500';
    if (level === 3) return 'bg-neutral-400 text-neutral-950 border-neutral-300';
    return 'bg-white text-neutral-950 border-white font-bold';
  };

  return (
    <div className="bg-black/55 rounded-2xl border border-white/10 p-5 space-y-4">
      {/* Header controls for Heat Map */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-200" />
          <div>
            <h3 className="text-sm font-semibold text-gray-100 tracking-wide uppercase">Workspace Heat Map</h3>
            <p className="text-[10px] text-gray-400">Tracking daily focus sessions & goals accomplished</p>
          </div>
        </div>

        {/* View range selectors and color picker */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* View Range */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5">
            {(['week', 'month', '3month', '6month', '12month'] as const).map(range => (
              <button
                key={range}
                onClick={() => onConfigChange({ viewRange: range })}
                className={`px-2 py-1 rounded-md text-[10px] uppercase font-mono transition-colors ${
                  config.viewRange === range 
                    ? 'bg-white text-black font-semibold' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {range === '3month' ? '3M' : range === '6month' ? '6M' : range === '12month' ? '12M' : range}
              </button>
            ))}
          </div>

          {/* Color palette selector */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-1 gap-1">
            <Palette className="w-3.5 h-3.5 text-gray-400 mr-0.5" />
            {(['monochrome', 'emerald', 'sapphire', 'amber', 'crimson'] as const).map(pal => {
              const previewColor = 
                pal === 'monochrome' ? 'bg-white' :
                pal === 'emerald' ? 'bg-emerald-500' :
                pal === 'sapphire' ? 'bg-blue-500' :
                pal === 'amber' ? 'bg-amber-500' : 'bg-red-500';

              return (
                <button
                  key={pal}
                  title={pal}
                  onClick={() => onConfigChange({ palette: pal })}
                  className={`w-3.5 h-3.5 rounded-full ${previewColor} transition-all border ${
                    config.palette === pal ? 'ring-2 ring-white scale-110' : 'opacity-45 hover:opacity-100'
                  }`}
                />
              );
            })}
          </div>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono text-gray-400 hover:text-red-400 bg-black/40 border border-white/10 hover:border-red-500/30 hover:bg-red-500/5 transition-all cursor-pointer"
              title="Reset all daily focus history and goals stats"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Structured day visual rows */}
      <div className="relative">
        <div className="flex flex-wrap gap-1.5 justify-start max-h-[220px] overflow-y-auto p-1 bg-black/20 rounded-xl border border-white/5">
          {activeDays.map(day => {
            const log = logsMap.get(day.date);
            const focusVal = log ? log.durationMinutes : 0;
            const goalsVal = log ? log.goalsCompleted : 0;
            const score = focusVal + goalsVal * 15;
            
            return (
              <div
                key={day.date}
                onMouseEnter={() => setHoveredDay({ date: day.date, mins: focusVal, goals: goalsVal })}
                onMouseLeave={() => setHoveredDay(null)}
                className={`w-6 h-6 rounded-md transition-all flex items-center justify-center text-[7px] select-none cursor-pointer hover:none relative hover:scale-115 ${getIntensityColor(score)}`}
              >
                {focusVal > 0 ? `${focusVal}m` : ''}
              </div>
            );
          })}
        </div>

        {/* Dynamic tooltip details display */}
        <div className="h-6 flex items-center justify-center text-center mt-2 text-[10px] font-mono text-gray-400">
          {hoveredDay ? (
            <span className="text-gray-200">
              <strong className="text-white">{hoveredDay.date}</strong>: Focus: {hoveredDay.mins} mins | Goals: {hoveredDay.goals} complete
            </span>
          ) : (
            <span>Hover on a square grid to observe performance intensity stats</span>
          )}
        </div>
      </div>
    </div>
  );
}
