import type { RecordingTask } from '@/domain/types';
import { StageBadge } from '@/components/StageBadge';

export function TaskList(props: {
  tasks: RecordingTask[];
  selectedId?: string;
  onSelect: (task: RecordingTask) => void;
}) {
  return (
    <section className="card task-list">
      <div className="section-heading">
        <div>
          <p className="label">TASKS</p>
          <h2>录音任务</h2>
        </div>
        <span>{props.tasks.length} 条</span>
      </div>
      <div className="task-items">
        {props.tasks.length === 0 && <p className="empty">等待 Simulator 上传第一条录音。</p>}
        {props.tasks.map((task) => (
          <button
            type="button"
            className={`task-item ${props.selectedId === task.id ? 'is-selected' : ''}`}
            key={task.id}
            onClick={() => props.onSelect(task)}
          >
            <span>
              <b>{new Date(task.createdAt).toLocaleString('zh-CN')}</b>
              <small>{task.id.slice(0, 8)}</small>
            </span>
            <StageBadge stage={task.status} />
          </button>
        ))}
      </div>
    </section>
  );
}
