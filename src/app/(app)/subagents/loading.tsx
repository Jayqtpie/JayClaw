import { Card, Skeleton } from '@/components/ui';

export default function LoadingSubagents() {
  return (
    <div className="space-y-6">
      <Card title="Subagents" subtitle="Loading…">
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
      <Card title="Spawn / Steer" subtitle="Loading…">
        <Skeleton className="h-40 w-full" />
      </Card>
      <Card title="Raw list" subtitle="Loading…">
        <Skeleton className="h-44 w-full" />
      </Card>
    </div>
  );
}
