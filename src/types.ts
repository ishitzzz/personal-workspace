/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Goal {
  id: string;
  text: string;
  completed: boolean;
}

export interface SyllabusItem {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'link';
  sourceUrl: string;
  addedAt: string;
  deadline?: string;
}

export interface Deadline {
  id: string;
  title: string;
  date: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}

export interface FocusSessionLog {
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  goalsCompleted: number;
  checklistItemsCompleted: number;
}

export interface HeatMapConfig {
  palette: 'monochrome' | 'emerald' | 'sapphire' | 'amber' | 'crimson';
  viewRange: 'week' | 'month' | '3month' | '6month' | '12month';
}

export interface StudyPlanMilestone {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  hoursRequired?: number;
}

export interface StudyPlan {
  id: string;
  title: string;
  targetExamDate?: string;
  description: string;
  hourlyGoal: number;
  hoursLogged: number;
  milestones: StudyPlanMilestone[];
}

export interface StudyReminder {
  id: string;
  title: string;
  intervalMinutes: number;
  isActive: boolean;
  lastTriggeredAt?: string; // ISO string or timestamp
}

export interface UserProfile {
  username: string;
  joinedAt: string;
}

export interface StudyChannel {
  id: string;
  name: string;
  videoIds: string[];
  assignedNode: number | null; // index 1 to 6
}

export interface SyncState {
  goals: Goal[];
  syllabusList: SyllabusItem[];
  deadlines: Deadline[];
  sessionLogs: FocusSessionLog[];
  heatMapConfig: HeatMapConfig;
  backgroundVideoIds: string[]; // up to 6 video streams
  activeGridCount: number; // 1, 2, 3, 4, or 6
  durationFocus: number;
  durationShort: number;
  durationLong: number;
  studyPlans?: StudyPlan[];
  reminders?: StudyReminder[];
  channels?: StudyChannel[];
}
