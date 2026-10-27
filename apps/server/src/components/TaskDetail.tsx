import type { RecordingTask } from '@/domain/types';
import { StageBadge } from '@/components/StageBadge';
import { ToolCallList } from '@/components/ToolCallList';

export function TaskDetail({ task }: { task?: RecordingTask }) {
  if (!task) {
    return <section className="card detail empty">选择一条任务查看完整处理结果。</section>;
  }

  return (
    <section className="card detail">
      <div className="section-heading">
        <div>
          <p className="label">TASK DETAIL</p>
          <h2>{task.id.slice(0, 12)}</h2>
        </div>
        <StageBadge stage={task.status} />
      </div>
      {task.error && <p className="error">{task.error}</p>}
      <ResultBlock title="ASR 原文" value={task.rawTranscript} />
      <ResultBlock title="校准文本" value={task.correctedTranscript} />
      <ResultBlock title="AI 摘要" value={task.summary} />
      <ResultBlock
        title="待办"
        value={task.todos.length ? JSON.stringify(task.todos) : task.status === 'COMPLETED' ? '无' : undefined}
      />
      <ResultBlock
        title="提醒"
        value={task.reminders.length ? JSON.stringify(task.reminders) : task.status === 'COMPLETED' ? '无' : undefined}
      />
      <div className="result-block">
        <h3>Agent 工具调用</h3>
        <ToolCallList calls={task.toolCalls} />
      </div>
    </section>
  );
}

function ResultBlock({ title, value }: { title: string; value?: string }) {
  return (
    <div className="result-block">
      <h3>{title}</h3>
      <p>{value ?? '等待处理…'}</p>
    </div>
  );
}
