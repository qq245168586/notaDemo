export const TASK_STAGES = [
  'PENDING',
  'AUDIO_PROCESSING',
  'ASR_PROCESSING',
  'TEXT_CORRECTING',
  'AGENT_RUNNING',
  'RESULT_VALIDATING',
  'COMPLETED',
  'FAILED',
] as const;

export type TaskStage = (typeof TASK_STAGES)[number];
export type QuotaState = 'RESERVED' | 'CONSUMED' | 'RELEASED';

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
