// Tarefa — contrato canônico da API. O alias preserva imports existentes.
export type { TaskChecklistItem as ChecklistItem } from "./tasks";
export type { TaskRecord, TaskCreateInput, TaskUpdateInput, TaskSyncState } from "./tasks";
export type Task = import("./tasks").TaskRecord;

// Rotina
export interface Routine {
  id: string
  title: string
  emoji?: string
  frequency: 'daily' | 'weekly' | 'monthly' | string
  days?: number[]
  time?: string | null
  last_done?: string | null
  streak?: number
  user_id?: string
  created_at?: string
}

// Modo de execução
export interface Mode {
  id: string
  name: string
  emoji: string
  description: string
  category: string
  tags?: string[]
  steps?: string[]
  durations?: number[]
  variants?: ModeVariant[]
  color?: string
  isPro?: boolean
  isNew?: boolean
}

export interface ModeVariant {
  id: string
  label: string
  description?: string
  durations?: number[]
}

// Sessão
export interface ModeSession {
  id?: string
  mode_id: string
  mode_name: string
  duration_minutes: number
  task_id?: string | null
  task_title?: string | null
  started_at: string
  ended_at?: string | null
  completed: boolean
  notes?: string | null
  user_id?: string
}

export interface ModeComboLog {
  id?: string
  mode_ids: string[]
  mode_names: string[]
  duration_minutes: number
  started_at: string
  ended_at?: string | null
  completed: boolean
  user_id?: string
}

// Usuário / Auth
export interface AppUser {
  id: string
  email: string
  name?: string | null
  avatar_url?: string | null
}

// Daily Focus
export interface DailyFocusDay {
  date: string
  level: number
  checkins: number
  achievements: string[]
  tasks_done: number
  user_id?: string
}

export interface DailyFocusAchievement {
  id: string
  date: string
  type: string
  label: string
  emoji?: string
  user_id?: string
}

export interface CheckIn {
  id?: string
  date: string
  time: string
  mood?: number | null
  note?: string | null
  user_id?: string
}

// Checkpoint emocional do Daily Focus (Play / Retomar / Fim de tarefa)
export type EmotionMoment = "start" | "resume" | "end"

export interface SessionEmotion {
  id?: string
  emotion: string                 // id da emoção (ex.: "focado")
  moment: EmotionMoment
  intensity?: "leve" | "forte"
  date: string                    // YYYY-MM-DD
  hour: number                    // 0-23
  timestamp: string               // ISO
  taskTitle?: string
  taskIndex?: number
  taskId?: string
  modeIds?: string[]
  level?: number
  rushMode?: boolean
  tabMode?: boolean
  pauseSecs?: number
  completed?: boolean
  usedSecs?: number
  totalSecs?: number
  user_id?: string
}

// Preferências
export interface UserPreferences {
  theme?: 'dark' | 'light'
  notifications?: boolean
  dailyGoal?: number
  [key: string]: unknown
}

// API
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// Storage
export type StorageKey = string

// Utilitários
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
