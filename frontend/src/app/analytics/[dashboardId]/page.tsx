'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react'

import { ChatChartRenderer } from '@/components/AIChat/ChatChartRenderer'
import { chartMetadata } from '@/components/analytics/chart-library'
import { TEXT_INSIGHT_META } from '@/components/analytics/widget-metadata'
import type {
  AnalyticsDashboard,
  ChartWidget,
  DashboardWidget,
} from '@/components/analytics/types'
import {
  StoredDashboard,
  normalizeStoredWidget,
} from '@/components/analytics/storage'
import type { AgentMessageContent } from '@/lib/agent-types'
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
const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? 'http://localhost:8001'

const heightToPixels: Record<'half' | 'full', number> = {
  half: 220,
  full: 360,
}

const isChartWidget = (widget: DashboardWidget): widget is ChartWidget => widget.kind === 'chart'

const getWidgetLabel = (widget: DashboardWidget) =>
  isChartWidget(widget) ? chartMetadata[widget.chartType].label : TEXT_INSIGHT_META.label

const getWidgetDescription = (widget: DashboardWidget) =>
  isChartWidget(widget)
    ? chartMetadata[widget.chartType].description
    : TEXT_INSIGHT_META.description

export default function AnalyticsDetailPage() {
  const params = useParams<{ dashboardId: string }>()
  const [dashboards, _setDashboards, isHydrated] = useLocalStorageState<StoredDashboard[]>(
    STORAGE_KEY,
    []
  )
  const router = useRouter()

  const dashboard = useMemo(() => {
    const found = dashboards.find((item) => item.id === params.dashboardId)
    if (!found) return undefined
    return {
      ...found,
      charts: found.charts.map((chart) => normalizeStoredWidget(chart)) as DashboardWidget[],
    } satisfies AnalyticsDashboard
  }, [dashboards, params.dashboardId])

  const [widgetResults, setWidgetResults] = useState<Record<string, AgentMessageContent>>({})
  const [widgetErrors, setWidgetErrors] = useState<Record<string, string>>({})
  const [isResolving, setResolving] = useState(false)

  useEffect(() => {
    if (!dashboard || dashboard.charts.length === 0) {
      setWidgetResults({})
      setWidgetErrors({})
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const resolveWidgets = async () => {
      setResolving(true)
      setWidgetResults({})
      setWidgetErrors({})

      const tasks = dashboard.charts.map((widget) =>
        (async () => {
          try {
            const response = await fetch(`${AGENT_BASE_URL}/analytics/resolve-widget`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                prompt: widget.prompt,
                kind: widget.kind,
                chartType: widget.kind === 'chart' ? widget.chartType : undefined,
              }),
            })

            if (!response.ok) {
              const responseText = await response.text()
              let message = 'Failed to resolve widget.'
              if (responseText) {
                try {
                  const data = JSON.parse(responseText)
                  if (typeof data?.error === 'string') {
                    message = data.error
                  } else {
                    message = responseText
                  }
                } catch {
                  message = responseText
                }
              }
              throw new Error(message || 'Failed to resolve widget.')
            }

            const data = (await response.json()) as { content?: AgentMessageContent }
            return { id: widget.id, content: data.content }
          } catch (error) {
            if ((error as Error)?.name === 'AbortError') {
              throw error
            }
            throw { id: widget.id, error }
          }
        })()
      )

      const settled = await Promise.allSettled(tasks)
      if (cancelled) {
        return
      }

      const nextResults: Record<string, AgentMessageContent> = {}
      const nextErrors: Record<string, string> = {}

      settled.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value?.content) {
            nextResults[result.value.id] = result.value.content
          }
        } else {
          const failure = result.reason as { id?: string; error?: unknown } | Error
          if (failure instanceof Error) {
            if (failure.name === 'AbortError') {
              return
            }
          } else if (failure?.error instanceof Error) {
            if (failure.error.name === 'AbortError') {
              return
            }
            if (failure.id) {
              nextErrors[failure.id] = failure.error.message
            }
          } else if (failure && typeof failure === 'object' && 'id' in failure && failure.id) {
            nextErrors[failure.id as string] = 'Failed to resolve widget.'
          }
        }
      })

      setWidgetResults(nextResults)
      setWidgetErrors(nextErrors)
      setResolving(false)
    }

    resolveWidgets().catch((error) => {
      if (!cancelled && (error as Error)?.name !== 'AbortError') {
        console.error('[analytics-detail] Failed to resolve widgets', error)
        setResolving(false)
      }
    })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [dashboard])

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

      {isResolving && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Contacting agents to render your widgets...
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        {dashboard.charts.length === 0 ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">No widgets yet</CardTitle>
              <CardDescription>
                This dashboard doesn&apos;t have any widgets. Return to the analytics page to edit or create a new one.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          dashboard.charts.map((widget) => {
            const widthStyle =
              widget.width === 'full' ? '100%' : 'min(100%, calc(50% - 0.5rem))'
            const result = widgetResults[widget.id]
            const error = widgetErrors[widget.id]

            return (
              <Card
                key={widget.id}
                className="border-primary/20 bg-background"
                style={{
                  minHeight: isChartWidget(widget)
                    ? heightToPixels[widget.height] + 120
                    : 220,
                  width: widthStyle,
                }}
              >
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg text-primary">{getWidgetLabel(widget)}</CardTitle>
                  <CardDescription className="text-primary/70">
                    {widget.prompt || getWidgetDescription(widget)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {error ? (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <span>{error}</span>
                    </div>
                  ) : isChartWidget(widget) ? (
                    result?.charts && result.charts.length > 0 ? (
                      <div className="space-y-4">
                        {result.charts.map((chart) => (
                          <ChatChartRenderer key={chart.id} chart={chart} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating chart...
                      </div>
                    )
                  ) : result?.text ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-primary">
                      {result.text}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Drafting insight...
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </section>
  )
}
