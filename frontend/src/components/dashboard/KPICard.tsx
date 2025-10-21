import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface KPICardProps {
  title: string;
  value?: string | number;
  description: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  iconColor?: string;
  isLoading?: boolean;
  error?: string | null;
}

export function KPICard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  iconColor = 'text-blue-600',
  isLoading = false,
  error,
}: KPICardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
         {Icon &&  <Icon className={cn('h-5 w-5', iconColor)} /> } 
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold mb-1 text-blue-600">{error ? '—' : value}</div>
            {trend && !error && (
              <div className="flex items-center gap-1 mb-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
                <span className="text-sm text-muted-foreground">vs last period</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {error ? error : description}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
