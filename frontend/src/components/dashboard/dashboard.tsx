import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { KPICard } from './KPICard'
import { ChartPieLabel } from './PieChart'
import { ContractSigningsChart, EnvelopeTypeCycleChart } from './BarChart'
import { analyticsApi, DashboardKpisResponse } from '@/lib/analytics-api'
import { EnvelopesTable } from './EnvelopesTable'
import PromptInputComponent from '@/components/AIChat/prompt-input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DashboardInsightPayload, insightPayloadToPrompt } from './insights'
import { useLocalStorageCache } from '@/hooks/use-local-storage-cache'

const Dashboard = () => {
  const [kpiError, setKpiError] = useState<string | null>(null)
  const [isLoadingKpis, setLoadingKpis] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [activeInsight, setActiveInsight] = useState<DashboardInsightPayload | null>(null)
  const [prefillPrompt, setPrefillPrompt] = useState('')
  const [promptSessionId, setPromptSessionId] = useState(0)

  const kpiCacheKey = useMemo(() => 'analytics:kpis:v1', [])
  const TEN_MIN = 10 * 60 * 1000
  const [kpis, setKpis, isKpiHydrated, isKpiFresh] = useLocalStorageCache<DashboardKpisResponse | null>(kpiCacheKey, null, TEN_MIN)

  useEffect(() => {
    if (!isKpiHydrated) return
    // If cache is fresh, don't refetch
    if (isKpiFresh && kpis) {
      return
    }

    const controller = new AbortController()
    setLoadingKpis(true)
    setKpiError(null)

    analyticsApi
      .getKpis(controller.signal)
      .then((response) => {
        setKpis(response)
      })
      .catch((error) => {
        if ((error as Error).name === 'AbortError') {
          return
        }
        console.error('[dashboard] Failed to load KPI data', error)
        setKpiError('Unable to load KPI data right now. Please try again later.')
      })
      .finally(() => {
        setLoadingKpis(false)
      })

    return () => {
      controller.abort()
    }
  }, [isKpiHydrated, isKpiFresh])

  const handleOpenInsight = useCallback((payload: DashboardInsightPayload) => {
    setActiveInsight(payload)
    setPrefillPrompt(insightPayloadToPrompt(payload))
    setPromptSessionId((session) => session + 1)
    setAssistantOpen(true)
  }, [])

  const handleSheetChange = useCallback((open: boolean) => {
    setAssistantOpen(open)
    if (!open) {
      setActiveInsight(null)
    }
  }, [])

  const cards = useMemo(
    () => [
      {
        title: 'Average Contract Cycle Time',
        description: 'Average time from sent to completion over the last 90 days.',
        value: kpis ? `${kpis.average_contract_cycle_days.toFixed(1)} Days` : undefined,
        rawValue: kpis?.average_contract_cycle_days ?? undefined,
        iconColor: 'text-blue-600',
      },
      {
        title: 'Agreements Completed (30 days)',
        description: 'Completed DocuSign envelopes during the last 30-days.',
        value: kpis ? kpis.agreements_completed_last_30_days.toLocaleString() : undefined,
        rawValue: kpis?.agreements_completed_last_30_days ?? undefined,
        iconColor: 'text-green-600',
      },
      {
        title: 'Active Envelopes (90 days)',
        description: 'Open envelopes awaiting completion in the last 90 days.',
        value: kpis ? kpis.pending_envelopes_last_90_days.toLocaleString() : undefined,
        rawValue: kpis?.pending_envelopes_last_90_days ?? undefined,
        iconColor: 'text-amber-600',
      },
    ],
    [kpis]
  )

  return (
    <>
      <div className='mt-4 '>
        <div className='text-2xl mb-3  font-bold'>
          Your Campaign Metrics
        </div>
        <div className="grid grid-cols-3 gap-6 mb-6 ">
        {cards.map((card) => (
          <KPICard
            key={card.title}
            title={card.title}
            value={card.value}
            rawValue={card.rawValue}
            description={card.description}
            iconColor={card.iconColor}
            isLoading={isLoadingKpis}
            error={kpiError}
            onOpenInsight={handleOpenInsight}
          />
        ))}

      </div>
        <div className="gap-6 grid grid-cols-1 lg:grid-cols-5 mb-6">
          <ContractSigningsChart className="lg:col-span-3" onOpenInsight={handleOpenInsight} />
          <ChartPieLabel className="lg:col-span-2" onOpenInsight={handleOpenInsight} />
        </div>
        <div className="mb-6">
          <EnvelopeTypeCycleChart onOpenInsight={handleOpenInsight} />
        </div>
        <div className="mb-10">
          <EnvelopesTable onOpenInsight={handleOpenInsight} />
        </div>
      </div>

      <Sheet open={assistantOpen} onOpenChange={handleSheetChange}>
        <SheetContent side="right" className="flex h-full w-full max-w-full flex-col p-0 sm:max-w-xl">
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle>{activeInsight?.title ?? 'Ask the AI Assistant'}</SheetTitle>
            <SheetDescription>
              {activeInsight?.summary ?? 'Chat with the agent about any metric on this dashboard.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden px-2 pb-4">
            <PromptInputComponent
              key={promptSessionId}
              layout="embedded"
              prefillText={prefillPrompt}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export default Dashboard