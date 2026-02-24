import { Card, Skeleton } from '@/components/ui';

export default function LoadingAudit() {
  return (
    <div className="space-y-6">
      <Card title="Audit Trail" subtitle="Loading…">
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
      <Card title="Entries" subtitle="Loading…">
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Card>
    </div>
  );
}
