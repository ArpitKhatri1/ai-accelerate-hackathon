import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardInsightPayload } from './insights';

interface KPICardProps {
  title: string;
  value?: string | number;
  rawValue?: number;
  description: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  iconColor?: string;
  isLoading?: boolean;
  error?: string | null;
  onOpenInsight?: (payload: DashboardInsightPayload) => void;
}

export function KPICard({
  title,
  value,
  rawValue,
  description,
  trend,
  iconColor = 'text-blue-600',
  isLoading = false,
  error,
  onOpenInsight,
}: KPICardProps) {
  const handleInsightClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (!onOpenInsight) return;

    const payload: DashboardInsightPayload = {
      title,
      summary: error ? `Encountered error: ${error}` : description,
      data: {
        displayedValue: value,
        rawValue,
        trend,
      },
      metadata: {
        component: 'kpi-card',
        iconColor,
      },
    };

    onOpenInsight(payload);
  };

  return (
    <Card className={cn('relative group hover:shadow-lg transition-shadow duration-200 ', onOpenInsight && 'focus-within:shadow-lg')}>
      {onOpenInsight && (
        <button
          type="button"
          onClick={handleInsightClick}
          className="absolute -top-2 -right-2 flex items-center justify-center rounded-full bg-white/95 p-2 text-amber-500 shadow-lg transition-all duration-200 hover:scale-105 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          aria-label={`Ask AI about ${title}`}
        >
          <Star className="h-4 w-4" />
        </button>
      )}
      <CardHeader className="flex flex-row items-center justify-between  ">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
         {/* {Icon &&  <Icon className={cn('h-5 w-5', iconColor)} /> }  */}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : (
          <div  className='w-full h-full flex flex-col justify-between '>
            <div className="text-3xl font-bold -mt-3 mb-1 text-blue-600">{value ?? '—'}</div>
     
            <p className="text-xs text-muted-foreground leading-relaxed mt-auto">
              {error ?? description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
