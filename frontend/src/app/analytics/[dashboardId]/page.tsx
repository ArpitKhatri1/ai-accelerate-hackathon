'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

import { ChartRenderer, chartMetadata } from '@/components/analytics/chart-library'
import type { AnalyticsDashboard, ChartWidget } from '@/components/analytics/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocalStorageState } from '@/hooks/use-local-storage'

const STORAGE_KEY = 'custom-analytics-dashboards'

const heightToPixels: Record<'half' | 'full', number> = {
  half: 220,
  full: 360,
}

const ensureWidth = (widget: ChartWidget): ChartWidget => {
  if (widget.width) return widget
  return { ...widget, width: 'full' }
}

export default function AnalyticsDetailPage() {
  const params = useParams<{ dashboardId: string }>()
  const [dashboards, _setDashboards, isHydrated] = useLocalStorageState<AnalyticsDashboard[]>(
    STORAGE_KEY,
    []
  )
  const router = useRouter()

  const dashboard = useMemo(() => {
    const found = dashboards.find((item) => item.id === params.dashboardId)
    if (!found) return undefined
    return {
      ...found,
      charts: found.charts.map(ensureWidth),
    }
  }, [dashboards, params.dashboardId])

  if (!isHydrated) {
    return (
      <section className="mx-auto w-full max-w-6xl p-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <div className="grid gap-4">
          <Skeleton className="h-[280px] w-full" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      </section>
    )
  }

  if (!dashboard) {
    return (
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="text-2xl font-semibold text-primary">Dashboard not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find the analytics dashboard you&apos;re looking for. It may have been removed.
        </p>
        <Button onClick={() => router.push('/analytics')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to analytics
        </Button>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="w-fit px-0 text-primary">
            <Link href="/analytics">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to analytics
            </Link>
          </Button>
          <h1 className="mt-2 text-3xl font-semibold text-primary">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-sm text-muted-foreground">{dashboard.description}</p>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Created on {new Date(dashboard.createdAt).toLocaleString()}
        </div>
      </header>
      <div className="flex flex-wrap gap-4">
        {dashboard.charts.length === 0 ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">No charts yet</CardTitle>
              <CardDescription>
                This dashboard doesn&apos;t have any charts. Return to the analytics page to edit or create a new one.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          dashboard.charts.map((widget) => {
            const chartHeight = heightToPixels[widget.height]
            const widthStyle =
              widget.width === 'full'
                ? '100%'
                : 'min(100%, calc(50% - 0.5rem))'

            return (
              <Card
                key={widget.id}
                className="border-primary/20 bg-background"
                style={{
                  minHeight: chartHeight + 60,
                  width: widthStyle,
                }}
              >
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg text-primary">
                    {chartMetadata[widget.type].label}
                  </CardTitle>
                  <CardDescription className="text-primary/70">
                    {chartMetadata[widget.type].description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ChartRenderer type={widget.type} height={chartHeight} />
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </section>
  )
}
