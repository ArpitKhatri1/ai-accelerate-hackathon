import React from 'react'
import { KPICard } from './KPICard'
import { ChartPieLabel } from './PieChart'
import { ContractSigningsChart, EnvelopeTypeCycleChart } from './BarChart'

const Dashboard = () => {
  return (
    <div className='mt-4 '>
      <div className='text-2xl mb-3  font-bold'>
        Your Campain Metrics
      </div>
      <div className="flex gap-6 mb-6 ">
        <KPICard
          title="Average Contract Cycle Time"
          value={`2 days`}
          description="Average time from creation to completion over the last 90 days"
          // icon={Clock}
          iconColor="text-blue-600" />
        <KPICard
          title="Agreement Velocity"
          value={3}
          description="Agreements completed in the last 30 days"
          // icon={TrendingUp}

          iconColor="text-green-600" />
        <KPICard
          title="Upcoming Expiration"
          value={2}
          description="Contracts set to expire or renew within the next 90 days"
          // icon={Calendar}
          iconColor="text-amber-600" />

      </div>
      <div className="mb-6">
        <EnvelopeTypeCycleChart />
      </div>
      <div className="gap-6 grid grid-cols-1 lg:grid-cols-5">
        <ContractSigningsChart className="lg:col-span-3" />
        <ChartPieLabel className="lg:col-span-2" />
      </div>
    </div>
  )
}

export default Dashboard