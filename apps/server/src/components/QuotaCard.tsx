import type { QuotaSnapshot } from '@/domain/types';

export function QuotaCard({ quota }: { quota?: QuotaSnapshot }) {
  return (
    <section className="card quota-card">
      <div>
        <p className="label">FREE 今日额度</p>
        <strong>{quota ? `${quota.remaining} / ${quota.limit}` : '--'}</strong>
      </div>
      <div className="quota-meta">
        已使用 {quota?.used ?? 0} · 处理中 {quota?.reserved ?? 0}
      </div>
    </section>
  );
}
