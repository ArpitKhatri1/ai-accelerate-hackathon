import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  description: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  iconColor?: string;
}

export function KPICard({ title, value, description, icon: Icon, trend, iconColor = 'text-blue-600' }: KPICardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
         {Icon &&  <Icon className={cn('h-5 w-5', iconColor)} /> } 
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-1">{value}</div>
        {trend && (
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
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
