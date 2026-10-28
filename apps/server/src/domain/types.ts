export const TASK_STAGES = [
  'PENDING',
  'AUDIO_PROCESSING',
  'ASR_PROCESSING',
  'TEXT_CORRECTING',
  'TRANSCRIPT_REVIEWING',
  'AGENT_RUNNING',
  'RESULT_VALIDATING',
  'COMPLETED',
  'FAILED',
] as const;

export type TaskStage = (typeof TASK_STAGES)[number];
export type QuotaState = 'RESERVED' | 'CONSUMED' | 'RELEASED';

export interface TaskProgress {
  id: number;
  stage: TaskStage;
  message: string;
  createdAt: string;
}

export interface ToolCallRecord {
  id: string;
  name: 'createTodo' | 'setReminder' | 'searchHistory';
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface RecordingTask {
  id: string;
  requestId: string;
  status: TaskStage;
  audioPath: string;
  transcriptHint?: string;
  rawTranscript?: string;
  correctedTranscript?: string;
  summary?: string;
  todos: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  toolCalls: ToolCallRecord[];
  error?: string;
  quotaDate: string;
  quotaState: QuotaState;
  createdAt: string;
  updatedAt: string;
  progress: TaskProgress[];
  review?: TranscriptReview;
  timeMentions?: TimeMention[];
}

export interface TranscriptReview {
  summary: string;
  findings: Array<{ original: string; candidate: string; decision: string; evidence: string }>;
  source: 'text_review';
  model: string;
  changes?: { before: string; after: string };
}

export interface TimeMention {
  id: string;
  start: number;
  end: number;
  quote: string;
  context: string;
  title: string;
  date: string | null;
  time: string | null;
  startAt: string | null;
  remindBeforeMinutes: number;
  note: string;
}

export interface QuotaSnapshot {
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
}

export interface AgentResult {
  summary: string;
  todos: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  toolCalls: ToolCallRecord[];
}
