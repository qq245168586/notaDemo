import { TaskDashboard } from '@/components/TaskDashboard';

export default function Home() {
  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">NOTA LOCAL MVP</p>
        <h1>录音处理控制台</h1>
        <p>Hardware Simulator 上传录音后，在这里查看 ASR、校准和 Agent 工具调用过程。</p>
      </header>
      <TaskDashboard />
    </main>
  );
}
