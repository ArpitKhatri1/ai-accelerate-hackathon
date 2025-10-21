import React, { useEffect, useMemo, useState } from 'react'
import { KPICard } from './KPICard'
import { ChartPieLabel } from './PieChart'
import { ContractSigningsChart, EnvelopeTypeCycleChart } from './BarChart'
import { analyticsApi, DashboardKpisResponse } from '@/lib/analytics-api'
import { EnvelopesTable } from './EnvelopesTable'

const Dashboard = () => {
  const [kpis, setKpis] = useState<DashboardKpisResponse | null>(null)
  const [kpiError, setKpiError] = useState<string | null>(null)
  const [isLoadingKpis, setLoadingKpis] = useState(false)

  useEffect(() => {
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
  }, [])

  const cards = useMemo(
    () => [
      {
        title: 'Average Contract Cycle Time',
        description: 'Average time from sent to completion over the last 90 days.',
        value: kpis ? `${kpis.average_contract_cycle_days.toFixed(1)} days` : undefined,
        iconColor: 'text-blue-600',
      },
      {
        title: 'Agreements Completed (30 days)',
        description: 'Completed DocuSign envelopes during the trailing 30-day window.',
        value: kpis ? kpis.agreements_completed_last_30_days.toLocaleString() : undefined,
        iconColor: 'text-green-600',
      },
      {
        title: 'Active Envelopes (90 days)',
        description: 'Open envelopes awaiting completion or action in the last 90 days.',
        value: kpis ? kpis.pending_envelopes_last_90_days.toLocaleString() : undefined,
        iconColor: 'text-amber-600',
      },
    ],
    [kpis]
  )

  return (
    <div className='mt-4 '>
      <div className='text-2xl mb-3  font-bold'>
        Your Campain Metrics
      </div>
      <div className="flex gap-6 mb-6 ">
        {cards.map((card) => (
          <KPICard
            key={card.title}
            title={card.title}
            value={card.value}
            description={card.description}
            iconColor={card.iconColor}
            isLoading={isLoadingKpis}
            error={kpiError}
          />
        ))}

      </div>
         <div className="gap-6 grid grid-cols-1 lg:grid-cols-5 mb-6">
        <ContractSigningsChart className="lg:col-span-3" />
        <ChartPieLabel className="lg:col-span-2" />
      </div>
      <div className="mb-6">
        <EnvelopeTypeCycleChart />
      </div>
      <EnvelopesTable />
    </div>
  )
}

export default Dashboard