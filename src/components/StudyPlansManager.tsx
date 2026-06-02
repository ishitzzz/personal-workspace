/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StudyPlan, StudyPlanMilestone } from '../types';
import { Calendar, CheckSquare, Square, Trash2, Plus, Clock, BookOpen, ChevronRight, Sparkles, Award } from 'lucide-react';

interface StudyPlansManagerProps {
  plans: StudyPlan[];
  onAddPlan: (plan: Omit<StudyPlan, 'id' | 'hoursLogged'>) => void;
  onDeletePlan: (id: string) => void;
  onToggleMilestone: (planId: string, milestoneId: string) => void;
  onLogPlanHours: (planId: string, hours: number) => void;
  onAddMilestone: (planId: string, title: string, dueDate: string) => void;
}

export default function StudyPlansManager({
  plans = [],
  onAddPlan,
  onDeletePlan,
  onToggleMilestone,
  onLogPlanHours,
  onAddMilestone,
}: StudyPlansManagerProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newHours, setNewHours] = useState(15);
  const [newExamDate, setNewExamDate] = useState('');
  const [newMilestoneText, setNewMilestoneText] = useState('');
  const [formMilestones, setFormMilestones] = useState<string[]>([]);
  
  // Milestone add state
  const [quickMilestoneTitle, setQuickMilestoneTitle] = useState('');
  const [quickMilestoneDate, setQuickMilestoneDate] = useState('');

  // Log manual hour state
  const [logHoursValue, setLogHoursValue] = useState<number>(1);

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || null;

  const handleAddFormMilestone = () => {
    if (!newMilestoneText.trim()) return;
    setFormMilestones([...formMilestones, newMilestoneText.trim()]);
    setNewMilestoneText('');
  };

  const handleRemoveFormMilestone = (idx: number) => {
    setFormMilestones(formMilestones.filter((_, i) => i !== idx));
  };

  const handleSubmitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddPlan({
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom study track',
      hourlyGoal: Number(newHours) || 10,
      targetExamDate: newExamDate || undefined,
      milestones: formMilestones.map((m, idx) => ({
        id: `m-${Date.now()}-${idx}`,
        title: m,
        dueDate: newExamDate || new Date().toISOString().split('T')[0],
        completed: false
      }))
    });

    // Reset fields
    setNewTitle('');
    setNewDesc('');
    setNewHours(15);
    setNewExamDate('');
    setFormMilestones([]);
    setIsCreating(false);
  };

  const handleAddQuickMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !quickMilestoneTitle.trim()) return;
    onAddMilestone(selectedPlanId, quickMilestoneTitle.trim(), quickMilestoneDate);
    setQuickMilestoneTitle('');
    setQuickMilestoneDate('');
  };

  return (
    <div id="study-plans-section" className="bg-black/55 rounded-2xl border border-white/10 p-5 space-y-5">
      {/* Header element */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gray-200" />
          <div>
            <h3 className="text-sm font-semibold text-gray-100 tracking-wide uppercase">AI-Linked Study Plans</h3>
            <p className="text-[10px] text-gray-400">Structure exams & syllabi customized verbally by your Zen AI</p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsCreating(!isCreating);
            setSelectedPlanId(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono text-black bg-white hover:bg-gray-200 font-semibold transition-all cursor-pointer"
        >
          {isCreating ? 'View Plans' : 'Create Custom Plan'}
        </button>
      </div>

      {isCreating ? (
        /* Create Plan visual Form */
        <form onSubmit={handleSubmitPlan} className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-300 uppercase block font-bold">Plan Title / Exam Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Calculus Midterm Study"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-neutral-900 border border-white/15 focus:border-white rounded-xl py-2 px-3 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-300 uppercase block font-bold">Exam / Deadline Date</label>
              <input
                type="date"
                value={newExamDate}
                onChange={e => setNewExamDate(e.target.value)}
                className="w-full bg-neutral-900 border border-white/15 focus:border-white rounded-xl py-2 px-3 text-white outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-300 uppercase block font-bold">Description / Concepts covered</label>
            <textarea
              placeholder="Chapters 4-8 focus targets..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full h-16 bg-neutral-900 border border-white/15 focus:border-white rounded-xl py-2 px-3 text-white outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-300 uppercase block font-bold">Target focus hours</label>
              <input
                type="number"
                min={1}
                max={500}
                value={newHours}
                onChange={e => setNewHours(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-white/15 focus:border-white rounded-xl py-2 px-3 text-white outline-none"
              />
            </div>

            {/* Form list creator for Milestones */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-300 uppercase block font-bold">Syllabus Milestones / Chapters</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Chapter 4 Integrals"
                  value={newMilestoneText}
                  onChange={e => setNewMilestoneText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddFormMilestone())}
                  className="flex-grow bg-neutral-900 border border-white/15 focus:border-white rounded-xl py-2 px-3 text-white outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddFormMilestone}
                  className="bg-white hover:bg-gray-200 text-black px-3.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {formMilestones.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 bg-black/30 p-2 rounded-xl border border-white/5">
                  {formMilestones.map((m, idx) => (
                    <span key={idx} className="bg-white/5 border border-white/5 text-[9px] text-gray-300 px-2 py-1 rounded-md flex items-center gap-1.5">
                      <span>{m}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFormMilestone(idx)}
                        className="text-gray-400 hover:text-white font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-white hover:bg-gray-200 text-black py-2 rounded-xl transition-all font-mono font-bold uppercase tracking-widest text-[11px] cursor-pointer"
          >
            Schedule Study Track
          </button>
        </form>
      ) : (
        /* Visual display of plans and selected details */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* List panel column */}
          <div className="md:col-span-1 space-y-2 border-r border-white/5 pr-0 md:pr-4">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2 font-mono">My Active Plans</span>
            {plans.length === 0 ? (
              <div className="text-center p-6 bg-black/25 rounded-xl border border-white/5 border-dashed flex flex-col items-center justify-center space-y-2">
                <BookOpen className="w-6 h-6 text-neutral-600" />
                <p className="text-[10px] text-gray-400 font-mono">No exam plans yet. Tell Zen AI to create one for you!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {plans.map(p => {
                  const loggedFraction = p.hourlyGoal > 0 ? p.hoursLogged / p.hourlyGoal : 0;
                  const percentComplete = Math.min(100, Math.round(loggedFraction * 100));
                  const isFinished = percentComplete >= 100;

                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPlanId(p.id);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-mono block relative ${
                        selectedPlanId === p.id 
                          ? 'bg-white/10 border-white text-white' 
                          : 'bg-black/35 border-white/10 hover:border-white/20 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-100 truncate pr-2">{p.title}</span>
                        {isFinished && <Award className="w-3.5 h-3.5 text-yellow-400 stretch-0" />}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5 text-[9px] text-gray-400">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span>{p.hoursLogged.toFixed(1)} / {p.hourlyGoal} Hours</span>
                      </div>

                      {/* Micro progress bar */}
                      <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden border border-white/5">
                        <div
                          style={{ width: `${percentComplete}%` }}
                          className={`h-full transition-all ${isFinished ? 'bg-amber-400' : 'bg-white'}`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Details segment workspace panel */}
          <div className="md:col-span-2 font-mono">
            {selectedPlan ? (
              <div className="space-y-4 bg-black/20 p-4 border border-white/5 rounded-xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase">{selectedPlan.title}</h4>
                    {selectedPlan.targetExamDate && (
                      <span className="text-[9px] text-gray-400 block mt-0.5">
                        Target Exam/Deadline Date: <strong className="text-white">{selectedPlan.targetExamDate}</strong>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      onDeletePlan(selectedPlan.id);
                      setSelectedPlanId(null);
                    }}
                    className="p-1 px-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-white/5 hover:border-red-500/20 transition-all text-[9px]"
                    title="Delete entire plan"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Remove
                  </button>
                </div>

                <p className="text-[11px] text-gray-300 italic whitespace-pre-wrap">{selectedPlan.description}</p>

                {/* Progress bar controller */}
                <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-400 uppercase text-[9px] tracking-wider block font-mono">Focus Logged Progression</span>
                    <span className="text-white">
                      {Math.min(100, Math.round((selectedPlan.hoursLogged / selectedPlan.hourlyGoal) * 100))}% Complete
                    </span>
                  </div>

                  <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div
                      style={{ width: `${Math.min(100, (selectedPlan.hoursLogged / selectedPlan.hourlyGoal) * 100)}%` }}
                      className="h-full bg-white transition-all"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1.5 text-[10px]">
                    <span className="text-gray-400">
                      Logged study time: <strong className="text-white">{selectedPlan.hoursLogged.toFixed(2)}</strong> out of <strong className="text-white">{selectedPlan.hourlyGoal}</strong> Target Hours
                    </span>

                    {/* Simple Log focus hours controller */}
                    <div className="flex items-center gap-1.5 shrink-0 font-mono">
                      <span className="text-gray-400">Log:</span>
                      <input
                        type="number"
                        step={0.5}
                        min={0.5}
                        max={12}
                        value={logHoursValue}
                        onChange={e => setLogHoursValue(Number(e.target.value) || 1)}
                        className="w-12 bg-neutral-900 border border-white/10 rounded-md text-center py-0.5 text-white outline-none text-[10px]"
                      />
                      <button
                        onClick={() => {
                          onLogPlanHours(selectedPlan.id, logHoursValue);
                          setLogHoursValue(1);
                        }}
                        className="bg-white hover:bg-gray-200 font-semibold text-black px-2 py-0.5 rounded text-[9px] transition-colors cursor-pointer"
                      >
                        + Add Hours
                      </button>
                    </div>
                  </div>
                </div>

                {/* Milestones checklists block with bullet checkboxes */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block font-mono">Task Plan Breakdowns / Milestones</span>
                  
                  {selectedPlan.milestones.length === 0 ? (
                    <p className="text-[10px] text-gray-500 italic">No milestones set. Use the form below to register chapters.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedPlan.milestones.map(m => (
                        <button
                          key={m.id}
                          onClick={() => onToggleMilestone(selectedPlan.id, m.id)}
                          className={`w-full text-left p-2.5 rounded-xl border flex items-center gap-2.5 transition-all outline-none ${
                            m.completed 
                              ? 'bg-white/5 border-emerald-500/20 text-gray-400 line-through' 
                              : 'bg-black/25 border-white/5 hover:border-white/15 text-gray-100 hover:bg-neutral-900/40'
                          }`}
                        >
                          {m.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-500 shrink-0" />
                          )}
                          <div className="min-w-0 flex-grow font-mono">
                            <span className="text-xs truncate block">{m.title}</span>
                            {m.dueDate && (
                              <span className="text-[8px] text-neutral-500 font-mono block">Due: {m.dueDate}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick Milestone input form */}
                  <form onSubmit={handleAddQuickMilestone} className="flex gap-2 pt-2 border-t border-white/5 flex-col sm:flex-row">
                    <input
                      type="text"
                      required
                      placeholder="Add specific chapter or goal..."
                      value={quickMilestoneTitle}
                      onChange={e => setQuickMilestoneTitle(e.target.value)}
                      className="flex-grow bg-neutral-900 border border-white/10 focus:border-white rounded-xl py-1.5 px-3 text-[10px] text-white outline-none font-mono"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="date"
                        value={quickMilestoneDate}
                        onChange={e => setQuickMilestoneDate(e.target.value)}
                        className="bg-neutral-900 border border-white/10 focus:border-white rounded-xl py-1.5 px-2 text-[10px] text-white outline-none font-mono shrink-0"
                      />
                      <button
                        type="submit"
                        className="bg-white hover:bg-gray-200 text-black px-3 rounded-xl transition-all text-[9.5px] font-bold shrink-0 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> ADD
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="h-[280px] bg-black/10 border border-white/5 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-3">
                <Sparkles className="w-7 h-7 text-neutral-600 animate-pulse" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-200 uppercase font-mono tracking-widest">Plan Details Panel</h4>
                  <p className="text-[10px] text-neutral-400 font-mono max-w-sm mt-1">
                    Select a plan to log focused homework hours, track milestone completeness checkbox progress, and map deadlines.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
