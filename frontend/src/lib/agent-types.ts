export type AgentChartType = 'bar' | 'double-bar' | 'line' | 'pie'

export interface AgentChart {
  id: string
  type: AgentChartType
  title?: string
  description?: string
  data: Array<Record<string, string | number>>
  meta?: {
    seriesALabel?: string
    seriesBLabel?: string
  }
}

export interface AgentMessageContent {
  text?: string
  charts?: AgentChart[]
  raw?: string
}
