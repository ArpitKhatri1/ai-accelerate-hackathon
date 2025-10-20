'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PlusCircle } from 'lucide-react'

import { DashboardBuilder } from '@/components/analytics/dashboard-builder'
import { AnalyticsDashboard, ChartWidget } from '@/components/analytics/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useLocalStorageState } from '@/hooks/use-local-storage'

const STORAGE_KEY = 'custom-analytics-dashboards'

type StoredChartWidget = Omit<ChartWidget, 'width'> & { width?: ChartWidget['width'] }
type StoredDashboard = Omit<AnalyticsDashboard, 'charts'> & {
  charts: StoredChartWidget[]
}

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function AnalyticsPage() {
  const [dashboards, setDashboards, isHydrated] = useLocalStorageState<StoredDashboard[]>(
    STORAGE_KEY,
    []
  )
  const [isBuilderOpen, setBuilderOpen] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    const needsNormalization = dashboards.some((dashboard) =>
      dashboard.charts.some((chart) => chart.width === undefined)
    )
    if (needsNormalization) {
      setDashboards((prev) =>
        prev.map((dashboard) => ({
          ...dashboard,
          charts: dashboard.charts.map((chart) => ({
            ...chart,
            width: chart.width ?? 'full',
          })),
        }))
      )
    }
  }, [dashboards, isHydrated, setDashboards])

  const normalizeChart = (chart: StoredChartWidget): ChartWidget => ({
    ...chart,
    width: chart.width ?? 'full',
  })

  const normalizedDashboards = useMemo(
    () =>
      dashboards.map((dashboard) => ({
        ...dashboard,
        charts: dashboard.charts.map(normalizeChart),
      })),
    [dashboards]
  )

  const handleCreateDashboard = (
    payload: Omit<AnalyticsDashboard, 'id' | 'createdAt'>
  ) => {
    const normalizedCharts = payload.charts.map(normalizeChart)
    const dashboard: StoredDashboard = {
      ...payload,
      charts: normalizedCharts,
      id: generateId(),
      createdAt: new Date().toISOString(),
    }
    setDashboards((prev) => [...prev, dashboard])
    setBuilderOpen(false)
  }

  const emptyState = (
    <></>
    // <Card className="border-primary/20 bg-primary/5">
    //   {/* <CardHeader>
    //     <CardTitle className="text-lg text-primary">
    //       Create your first analytics dashboard
    //     </CardTitle>
    //     <CardDescription className="text-primary/70">
    //       Drag charts into a custom layout and save them for quick access.
    //     </CardDescription>
    //   </CardHeader>
    //   <CardFooter>
    //     <Button onClick={() => setBuilderOpen(true)}>
    //       <PlusCircle className="mr-2 h-4 w-4" /> Build dashboard
    //     </Button>
    //   </CardFooter> */}
    // </Card>


  )

  return (



        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-primary">Custom Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Build bespoke dashboards with drag-and-drop charts powered by shadcn components.
              </p>
            </div>
            <Button onClick={() => setBuilderOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> New dashboard
            </Button>
          </header>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isHydrated && normalizedDashboards.length === 0 ? (
              emptyState
            ) : (
              normalizedDashboards.map((dashboard) => (
                <Card key={dashboard.id} className="border-primary/30 bg-background">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-lg text-primary">
                      {dashboard.name}
                    </CardTitle>
                    {dashboard.description && (
                      <CardDescription className="line-clamp-2 text-primary/70">
                        {dashboard.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Created {formatDate(dashboard.createdAt)}
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="outline" className="w-full border-primary/30 text-primary">
                      <Link href={`/analytics/${dashboard.id}`}>Open dashboard</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>

          <Dialog open={isBuilderOpen} onOpenChange={setBuilderOpen}>
            <DialogContent className="min-w-[90vw] overflow-y-auto max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Create custom analytics</DialogTitle>
                <DialogDescription>
                  Drag charts into your layout and save when you&apos;re ready. All charts use blue-themed demo data.
                </DialogDescription>
              </DialogHeader>
              <DashboardBuilder
                onCancel={() => setBuilderOpen(false)}
                onSave={({ name, description, charts }) =>
                  handleCreateDashboard({ name, description, charts })
                }
              />
            </DialogContent>
          </Dialog>
        </section>
 
  )
}