"use client"

import { useEffect, useMemo, useState } from "react"
import { Star, TrendingUp } from "lucide-react"
import { Pie, PieChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  analyticsApi,
  StatusDistributionItem,
} from "@/lib/analytics-api"
import { useLocalStorageCache } from "@/hooks/use-local-storage-cache"
import { cn } from "@/lib/utils"
import { DashboardInsightPayload } from "./insights"

export const description = "Envelope status distribution overview"

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6, #4c1d95)",
]

export function ChartPieLabel({
  className,
  onOpenInsight,
}: {
  className?: string
  onOpenInsight?: (payload: DashboardInsightPayload) => void
}) {
  const TEN_MIN = 10 * 60 * 1000
  const [data, setData, isHydrated, isFresh] = useLocalStorageCache<StatusDistributionItem[]>(
    "analytics:status-distribution:v1",
    [],
    TEN_MIN
  )
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (isFresh && data && data.length > 0) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    analyticsApi
      .getStatusDistribution(controller.signal)
      .then((response) => {
        setData(response.items)
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") {
          return
        }
        console.error("[dashboard] Failed to load status distribution", error)
        setError("Unable to load status distribution data. Try again later.")
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [isHydrated, isFresh])

  const chartConfig = useMemo(() => {
    return data.reduce<ChartConfig>((acc, item, index) => {
      acc[item.status] = {
        label: item.status,
        color: PIE_COLORS[index % PIE_COLORS.length],
      }
      return acc
    }, {} as ChartConfig)
  }, [data])

  const chartData = useMemo(
    () =>
      data.map((item, index) => ({
        name: item.status,
        value: item.count,
        fill: PIE_COLORS[index % PIE_COLORS.length],
      })),
    [data]
  )

  const topStatus = useMemo(() => {
    if (data.length === 0) return null
    return data.reduce((prev, curr) => (curr.count > prev.count ? curr : prev))
  }, [data])

  const totalCount = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data])

  const handleInsightClick = () => {
    if (!onOpenInsight) return

    const summary = error
      ? error
      : chartData.length === 0
        ? "No envelope status data is currently available."
        : `Envelope status distribution across ${chartData.length} statuses totaling ${totalCount.toLocaleString()} envelopes. Leading status: ${topStatus ? `${topStatus.status} with ${topStatus.count.toLocaleString()} envelopes` : 'N/A'}.`

    onOpenInsight({
      title: "Envelope Status Mix",
      summary,
      data: chartData,
      metadata: {
        component: 'envelope-status-pie',
        totalCount,
        isLoading,
      },
    })
  }

  return (
    <Card className={cn("relative flex flex-col group", className)}>
      {onOpenInsight && (
        <button
          type="button"
          onClick={handleInsightClick}
          className="absolute top-3 right-3 flex items-center justify-center rounded-full bg-white/95 p-2 text-amber-500 shadow-lg transition-all duration-200 hover:scale-105 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          aria-label="Ask AI about envelope status mix"
        >
          <Star className="h-4 w-4" />
        </button>
      )}
      <CardHeader className="items-center pb-0">
        <CardTitle>Envelope Status Mix</CardTitle>
        <CardDescription>Distribution of envelopes by their latest status.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="mx-auto aspect-square h-[220px] max-w-[220px]" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive text-center">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-primary text-center">
            No envelope status data available yet.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="[&_.recharts-pie-label-text]:fill-foreground mx-auto aspect-square max-h-[250px] pb-0"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={chartData}
                dataKey="value"
                label
                nameKey="name"
                stroke="#fff"
                strokeWidth={2}
                innerRadius={50}
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        {topStatus ? (
          <div className="flex items-center gap-2 leading-none font-medium">
            {topStatus.status} leads with {topStatus.count.toLocaleString()} envelopes
            <TrendingUp className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex items-center gap-2 leading-none font-medium text-muted-foreground">
            Waiting for envelope activity
          </div>
        )}
        <div className="text-muted-foreground leading-none">
          Data updates automatically as DocuSign envelope statuses change.
        </div>
      </CardFooter>
    </Card>
  )
}
