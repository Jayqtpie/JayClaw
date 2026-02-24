import { Card, Skeleton } from '@/components/ui';

export default function LoadingHealth() {
  return (
    <div className="space-y-6">
      <Card title="Health Wall" subtitle="Loading…">
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </Card>
      <Card title="Recent failures" subtitle="Loading…">
        <Skeleton className="h-44 w-full" />
      </Card>
      <Card title="Raw health payload" subtitle="Loading…">
        <Skeleton className="h-44 w-full" />
      </Card>
    </div>
  );
}
