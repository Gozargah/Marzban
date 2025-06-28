import { AdminDetails, SystemStats } from '@/service/api'
import { UserCircleIcon } from 'lucide-react'
import UserStatisticsCard from './users-statistics-card'
import DataUsageChart from './data-usage-chart'

const AdminStatisticsCard = ({ admin, systemStats, showAdminInfo = true }: { admin: AdminDetails | undefined; systemStats: SystemStats | undefined; showAdminInfo?: boolean }) => {
  if (!admin) return null

  if (showAdminInfo)
    return (
      <div className="flex flex-col gap-6 rounded-lg border p-6 shadow-lg">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-2">
            <UserCircleIcon className="size-7 text-muted-foreground" />
            <span className="text-xl font-bold">{admin.username}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <UserStatisticsCard data={systemStats} />
          <DataUsageChart admin_username={admin.username} />
        </div>
      </div>
    )

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <UserStatisticsCard data={systemStats} />
      <DataUsageChart admin_username={admin.username} />
    </div>
  )
}

export default AdminStatisticsCard
