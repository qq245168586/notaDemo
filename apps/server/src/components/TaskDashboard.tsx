'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QuotaSnapshot, RecordingTask } from '@/domain/types';
import { AgentQuery } from '@/components/AgentQuery';
import { QuotaCard } from '@/components/QuotaCard';
import { TaskDetail } from '@/components/TaskDetail';
import { TaskList } from '@/components/TaskList';

export function TaskDashboard() {
  const [tasks, setTasks] = useState<RecordingTask[]>([]);
  const [quota, setQuota] = useState<QuotaSnapshot>();
  const [selectedId, setSelectedId] = useState<string>();

  const refresh = useCallback(async () => {
    const [tasksResponse, quotaResponse] = await Promise.all([
      fetch('/api/tasks', { cache: 'no-store' }),
      fetch('/api/quota', { cache: 'no-store' }),
    ]);
    const [{ tasks: nextTasks }, nextQuota] = await Promise.all([
      tasksResponse.json(),
      quotaResponse.json(),
    ]);
    setTasks(nextTasks);
    setQuota(nextQuota);
    setSelectedId((current) => current ?? nextTasks[0]?.id);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <>
      <QuotaCard quota={quota} />
      <div className="workspace-grid">
        <TaskList
          tasks={tasks}
          selectedId={selectedId}
          onSelect={(task) => setSelectedId(task.id)}
        />
        <TaskDetail task={tasks.find((task) => task.id === selectedId)} />
      </div>
      <AgentQuery />
    </>
  );
}
