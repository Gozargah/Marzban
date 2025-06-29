import { AdminDetails, SystemStats, useGetAdmins } from '@/service/api'
import AdminStatisticsCard from './admin-statistics-card'

const DashboardAdminStatistics = ({ currentAdmin, systemStats }: { currentAdmin: AdminDetails | undefined; systemStats: SystemStats | undefined }) => {
  const { data } = useGetAdmins(undefined, {
    query: {
      refetchInterval: 60000,
    },
  })

  if (!data || !currentAdmin) return null

  if (data.length === 1) {
    return <AdminStatisticsCard showAdminInfo={false} admin={currentAdmin} systemStats={systemStats} />
  }

  return (
    <div className="flex flex-col gap-4">
      {data?.map(admin => (
        <AdminStatisticsCard key={admin.username} admin={admin} systemStats={systemStats} />
      ))}
    </div>
  )
}

export default DashboardAdminStatistics
