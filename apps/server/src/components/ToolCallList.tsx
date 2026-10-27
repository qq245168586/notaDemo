import type { ToolCallRecord } from '@/domain/types';

export function ToolCallList({ calls }: { calls: ToolCallRecord[] }) {
  if (!calls.length) return <p className="empty">Agent 尚未执行工具。</p>;
  return (
    <div className="tool-list">
      {calls.map((call, index) => (
        <article className="tool-call" key={call.id}>
          <span>{index + 1}</span>
          <div>
            <h4>{call.name}</h4>
            <code>{JSON.stringify(call.arguments)}</code>
            <p>{JSON.stringify(call.result)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
