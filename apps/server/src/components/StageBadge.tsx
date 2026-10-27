import type { TaskStage } from '@/domain/types';

const labels: Record<TaskStage, string> = {
  PENDING: '等待处理',
  AUDIO_PROCESSING: '音频处理',
  ASR_PROCESSING: 'ASR 转写',
  TEXT_CORRECTING: '文本校准',
  AGENT_RUNNING: 'Agent 执行',
  RESULT_VALIDATING: '结果验证',
  COMPLETED: '已完成',
  FAILED: '失败',
};

export function StageBadge({ stage }: { stage: TaskStage }) {
  return <span className={`stage stage-${stage.toLowerCase()}`}>{labels[stage]}</span>;
}
