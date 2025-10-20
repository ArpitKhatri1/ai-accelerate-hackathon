import type { AgentChart, AgentChartType, AgentMessageContent } from './agent-types'

const ALLOWED_CHART_TYPES: Set<AgentChartType> = new Set(['bar', 'double-bar', 'line', 'pie'])

export const isAgentChart = (value: unknown): value is AgentChart => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const chart = value as Record<string, unknown>
  if (typeof chart.id !== 'string') {
    return false
  }

  if (typeof chart.type !== 'string' || !ALLOWED_CHART_TYPES.has(chart.type as AgentChartType)) {
    return false
  }

  if (!Array.isArray(chart.data)) {
    return false
  }

  return true
}

export const normalizeStructuredPayload = (value: unknown): AgentMessageContent | null => {
  if (!value || typeof value !== 'object' || value === null) {
    return null
  }

  const payload = value as Record<string, unknown>
  const normalized: AgentMessageContent = {}

  const textCandidate = payload['text'] ?? payload['message']
  if (typeof textCandidate === 'string' && textCandidate.trim().length > 0) {
    normalized.text = textCandidate
  }

  const chartsCandidate = payload['charts']
  if (Array.isArray(chartsCandidate)) {
    const charts = chartsCandidate.filter(isAgentChart)
    if (charts.length > 0) {
      normalized.charts = charts
    }
  } else {
    const singleChartCandidate = payload['chart']
    if (isAgentChart(singleChartCandidate)) {
      normalized.charts = [singleChartCandidate]
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null
}

export const extractJsonCandidate = (raw: string): string | null => {
  const jsonFenceMatch = /```json\s*([\s\S]*?)\s*```/.exec(raw)
  if (jsonFenceMatch && jsonFenceMatch[1]) {
    return jsonFenceMatch[1]
  }
  return raw.trim().length > 0 ? raw : null
}
