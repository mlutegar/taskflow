/**
 * Tipos compartilhados entre os sub-componentes do ModesPanel.
 */

export interface ModeClass {
  emoji: string;
  name: string;
  desc: string;
  color: string;
}

export interface ModeConfig {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  color: string;
  colorBg: string;
  context?: string[];
  prerequisite?: string;
  whyItWorks?: string;
  whenToUse?: string;
  steps?: string[];
  tips?: string;
  category?: string;
  session?: string;
  preset?: Record<string, unknown>;
  isCustom?: boolean;
  classes?: ModeClass[];
  tags?: string[];
  type?: string;
}

export interface SavedShuffle {
  id: number;
  name: string;
  seed: number;
}

export interface ComboStat {
  key: string;
  modeIdA: string;
  modeIdB: string;
  total: number;
  successRate: number;
}

export interface WeeklyEntry {
  modeId: string;
  count: number;
  mode?: ModeConfig;
}

export interface Reminder {
  modeId: string;
  modeName: string;
}

export interface DetoxSuggestion {
  platform: string;
  count: number;
  detoxId: string;
}

export interface ComboSuggestion {
  modeA: ModeConfig;
  modeB: ModeConfig;
}
