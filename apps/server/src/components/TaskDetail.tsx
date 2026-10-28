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
      {task.review && <div className="result-block">
        <h3>AI 校验说明</h3>
        <p>{task.review.summary}</p>
        <small>文本复核结论与依据摘要，不是声学置信分数。</small>
        {task.review.findings.map((item, index) => <p key={index}>
          {item.decision}：{item.original}{item.candidate ? `，候选：${item.candidate}` : ''}。{item.evidence}
        </p>)}
      </div>}
      <div className="result-block">
        <h3>处理过程{!['COMPLETED', 'FAILED'].includes(task.status) ? ' · 实时更新' : ''}</h3>
        <ol>{task.progress?.map((entry) => <li key={entry.id}>{entry.message}</li>)}</ol>
      </div>
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
