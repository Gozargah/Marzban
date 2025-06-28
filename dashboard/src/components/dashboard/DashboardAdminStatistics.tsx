import { useGetAdmins, useGetCurrentAdmin } from '@/service/api'
import AdminStatisticsCard from './admin-statistics-card'

const DashboardAdminStatistics = () => {
  const { data } = useGetAdmins(undefined, {
    query: {
      refetchInterval: 60000,
    },
  })

  const { data: currentAdmin } = useGetCurrentAdmin()

  if (!data) return null

  if (data.length === 1) {
    return <AdminStatisticsCard showAdminInfo={false} admin={data[0]} />
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
