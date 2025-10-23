export type DashboardInsightPayload = {
  title: string
  summary: string
  data?: unknown
  metadata?: Record<string, unknown>
}

function serializeData(data: unknown): unknown {
  if (Array.isArray(data)) {
    const limit = 10
    if (data.length <= limit) {
      return data
    }

    return {
      sample: data.slice(0, limit),
      note: `Showing first ${limit} of ${data.length} records. Ask for more if needed.`,
    }
  }

  if (data && typeof data === 'object') {
    try {
      return JSON.parse(JSON.stringify(data))
    } catch (error) {
      console.warn('[insights] Failed to serialize insight data', error)
      return data
    }
  }

  return data
}

export function insightPayloadToPrompt(payload: DashboardInsightPayload): string {
  const sections: string[] = [
    `Help me understand the dashboard insight \"${payload.title}\".`,
    `Summary: ${payload.summary}`,
  ]

  if (payload.metadata && Object.keys(payload.metadata).length > 0) {
    sections.push(`Metadata:\n${JSON.stringify(payload.metadata, null, 2)}`)
  }

  if (payload.data !== undefined) {
    sections.push(`Relevant data:\n${JSON.stringify(serializeData(payload.data), null, 2)}`)
  }

  sections.push('Provide key takeaways and suggest any follow-up analysis I should consider.')

  return sections.join('\n\n')
}
