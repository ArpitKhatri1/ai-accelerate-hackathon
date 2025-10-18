import React from 'react'
import { KPICard } from './dashboard/KPICard'
import { ChartPieLabel } from './dashboard/PieChart'

const Dashboard = () => {
  return (
    <div className='max-w-[1200px] mt-4'>
      <div className='text-2xl mb-3  font-bold'>
        Your Campain Metrics
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
      <ChartPieLabel/>
    </div>
  )
}

export default Dashboard