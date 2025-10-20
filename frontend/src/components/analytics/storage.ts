import type { AnalyticsDashboard, ChartVisualizationType, DashboardWidget } from './types'

export const KNOWN_CHART_TYPES: ChartVisualizationType[] = ['bar', 'double-bar', 'line', 'pie']

export const isChartVisualizationType = (value: unknown): value is ChartVisualizationType =>
  typeof value === 'string' && KNOWN_CHART_TYPES.includes(value as ChartVisualizationType)

export type LegacyChartWidget = {
  id: string
  type?: ChartVisualizationType | string
  chartType?: ChartVisualizationType | string
  width?: DashboardWidget['width']
  height?: 'half' | 'full'
  prompt?: string
}

export type StoredWidget = DashboardWidget | LegacyChartWidget

export type StoredDashboard = Omit<AnalyticsDashboard, 'charts'> & {
  charts: StoredWidget[]
}

const ensureId = (id?: string): string => {
  if (id) return id
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const normalizeStoredWidget = (widget: StoredWidget): DashboardWidget => {
  const id = ensureId('id' in widget ? widget.id : undefined)
  const prompt = 'prompt' in widget && typeof widget.prompt === 'string' ? widget.prompt : ''
  const width = 'width' in widget && widget.width ? widget.width : 'full'

  if ('kind' in widget) {
    if (widget.kind === 'text-insight') {
      return {
        id,
        kind: 'text-insight',
        prompt,
        width,
      }
    }
    if (widget.kind === 'chart') {
      const chartType = isChartVisualizationType(widget.chartType) ? widget.chartType : 'bar'
      const height = widget.height ?? 'half'
      return {
        id,
        kind: 'chart',
        chartType,
        prompt,
        height,
        width,
      }
    }
  }

  const candidateChartType =
    ('chartType' in widget && typeof widget.chartType === 'string' && widget.chartType) ||
    ('type' in widget && typeof widget.type === 'string' ? widget.type : undefined)

  const chartType = isChartVisualizationType(candidateChartType) ? candidateChartType : 'bar'
  const height = 'height' in widget && widget.height === 'full' ? 'full' : 'half'

  return {
    id,
    kind: 'chart',
    chartType,
    prompt,
    height,
    width,
  }
}
