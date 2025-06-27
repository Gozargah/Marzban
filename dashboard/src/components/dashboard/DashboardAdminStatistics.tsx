import { useGetAdmins, useGetCurrentAdmin } from '@/service/api'
import AdminStatisticsCard from './admin-statistics-card'
import DataUsageChart from './data-usage-chart'
import UserStatisticsCard from './users-statistics-card'

const DashboardAdminStatistics = () => {
  const { data } = useGetAdmins(undefined, {
    query: {
      refetchInterval: 60000,
    },
  })

  const { data: currentAdmin } = useGetCurrentAdmin()

  if (!data) return null

  if (data.length === 1) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DataUsageChart />
        <UserStatisticsCard />
      </div>
    )
  }

  if (currentAdmin?.is_sudo)
    return (
      <div className="flex flex-col gap-4">
        {data?.map(admin => (
          <AdminStatisticsCard admin={admin} />
        ))}
      </div>
    )

  return null
}

export default DashboardAdminStatistics
