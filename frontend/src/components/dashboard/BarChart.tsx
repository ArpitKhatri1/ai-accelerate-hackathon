"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { analyticsApi } from "@/lib/analytics-api";
import { useLocalStorageCache } from "@/hooks/use-local-storage-cache";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { DashboardInsightPayload } from "./insights";

// Config for the vertical bar chart (avg cycle time)
const envelopeTypeConfig = {
  avgHours: {
    label: "Avg Hours",
    color: "hsl(217, 91%, 60%)",
  },
} satisfies ChartConfig;

type CycleTimeItem = {
  type: string;
  avgHours: number;
};

export function EnvelopeTypeCycleChart({
  className,
  onOpenInsight,
}: {
  className?: string;
  onOpenInsight?: (payload: DashboardInsightPayload) => void;
}) {
  const TEN_MIN = 10 * 60 * 1000;
  const [items, setItems, isHydrated, isFresh] = useLocalStorageCache<CycleTimeItem[]>(
    "analytics:cycle-time-by-document:v1",
    [],
    TEN_MIN
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (isFresh && items && items.length > 0) {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    analyticsApi
      .getCycleTimeByDocument(controller.signal)
      .then((res) => setItems(res.items ?? []))
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load cycle time data");
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isHydrated, isFresh]);

  const chartData = useMemo(
    () =>
      items.map((item) => ({
        type: item.type,
        avgHours: Number.isFinite(item.avgHours) ? Number(item.avgHours) : 0,
      })),
    [items]
  );

  const showEmpty = !isLoading && !error && chartData.length === 0;
  const topPerformer = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((best, current) =>
      current.avgHours < best.avgHours ? current : best
    );
  }, [chartData]);

  const handleInsightClick = () => {
    if (!onOpenInsight) return;

    const summary = error
      ? `Unable to load cycle time data: ${error}`
      : showEmpty
        ? "No document types were returned for the current filters."
        : `Displaying average completion hours for ${chartData.length} envelope types.${
            topPerformer ? ` Fastest completion: ${topPerformer.type} at ${topPerformer.avgHours.toFixed(2)} hours.` : ""
          }`;

    onOpenInsight({
      title: "Average Contract Cycle Time by Envelope Type",
      summary,
      data: chartData,
      metadata: {
        component: "envelope-type-cycle-chart",
        lastUpdated: new Date().toISOString(),
        isLoading,
        dataPoints: chartData.length,
      },
    });
  };

  return (
    <Card className={cn("relative group", className)}>
      {onOpenInsight && (
        <button
          type="button"
          onClick={handleInsightClick}
          className="absolute top-3 right-3 flex items-center justify-center rounded-full bg-white/95 p-2 text-amber-500 shadow-lg transition-all duration-200 hover:scale-105 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          aria-label="Ask AI about envelope cycle time"
        >
          <Star className="h-4 w-4" />
        </button>
      )}
      <CardHeader>
        <CardTitle>Average Contract Cycle Time by Envelope Type</CardTitle>
        <CardDescription>Average time to completion by envelope type (in hours)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : showEmpty ? (
          <div className="text-sm text-muted-foreground">No document types found yet.</div>
        ) : (
          <ChartContainer config={envelopeTypeConfig} className="h-[300px] w-full">
            <RechartsBarChart accessibilityLayer data={chartData} layout="vertical">
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="type"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                width={160}
                style={{ fontSize: "12px" }}
              />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value) =>
                      typeof value === "number" ? `${value.toFixed(2)} hours` : `${value} hours`
                    }
                  />
                }
              />
              <Bar dataKey="avgHours" fill="var(--color-avgHours)" radius={4} />
            </RechartsBarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// Daily sent vs completed (uses backend analytics)
const dailyConfig = {
  sent: {
    label: "Sent",
    color: "hsl(217, 91%, 60%)",
  },
  completed: {
    label: "Completed",
    color: "hsl(267, 91%, 60%)",
  },
} satisfies ChartConfig;

type DailyItem = { date: string; sent: number; completed: number };

export function ContractSigningsChart({
  className,
  onOpenInsight,
}: {
  className?: string;
  onOpenInsight?: (payload: DashboardInsightPayload) => void;
}) {
  const DAYS = 10;
  const TEN_MIN = 10 * 60 * 1000;
  const [items, setItems, isHydrated, isFresh] = useLocalStorageCache<DailyItem[]>(
    `analytics:daily-sent-completed:${DAYS}:v1`,
    [],
    TEN_MIN
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (isFresh && items && items.length > 0) {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    analyticsApi
      .getDailySentVsCompleted(DAYS, controller.signal)
      .then((res) => setItems(res.items ?? []))
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") {
          setError("Unable to load daily envelope metrics. Try again later.");
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isHydrated, isFresh]);

  const chartData = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
    return items.map((d) => ({
      date: fmt.format(new Date(d.date)),
      sent: d.sent,
      completed: d.completed,
    }));
  }, [items]);

  const totalSent = useMemo(() => chartData.reduce((sum, item) => sum + item.sent, 0), [chartData]);
  const totalCompleted = useMemo(() => chartData.reduce((sum, item) => sum + item.completed, 0), [chartData]);

  const handleInsightClick = () => {
    if (!onOpenInsight) return;

    const summary = error
      ? error
      : chartData.length === 0
        ? "No recent envelope activity is available for analysis."
        : `Tracking daily sent vs completed envelopes for the last ${chartData.length} days. Total sent: ${totalSent}. Total completed: ${totalCompleted}.`;

    onOpenInsight({
      title: "Contract Signings",
      summary,
      data: chartData,
      metadata: {
        component: "contract-signings-chart",
        windowDays: DAYS,
        isLoading,
        totalSent,
        totalCompleted,
      },
    });
  };

  return (
    <Card className={cn("relative group", className)}>
      {onOpenInsight && (
        <button
          type="button"
          onClick={handleInsightClick}
          className="absolute top-3 right-3 flex items-center justify-center rounded-full bg-white/95 p-2 text-amber-500 shadow-lg transition-all duration-200 hover:scale-105 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          aria-label="Ask AI about contract signings"
        >
          <Star className="h-4 w-4" />
        </button>
      )}
      <CardHeader>
        <CardTitle>Contract Signings</CardTitle>
        <CardDescription>Daily sent vs completed envelopes</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
            No recent envelope activity available.
          </div>
        ) : (
          <ChartContainer config={dailyConfig} className="h-[300px] w-full">
            <RechartsBarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
              <Bar dataKey="sent" fill="var(--color-sent)" radius={4} />
              <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
            </RechartsBarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
