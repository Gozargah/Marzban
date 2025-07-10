import { AdminDetails, SystemStats, useGetSystemStats } from '@/service/api'
import { UserCircleIcon } from 'lucide-react'
import UserStatisticsCard from './users-statistics-card'
import DataUsageChart from './data-usage-chart'

const AdminStatisticsCard = ({ 
  admin, 
  systemStats, 
  showAdminInfo = true, 
  currentAdmin 
}: { 
  admin: AdminDetails | undefined; 
  systemStats: SystemStats | undefined; 
  showAdminInfo?: boolean;
  currentAdmin?: AdminDetails | undefined;
}) => {
  if (!admin) return null

  // Only send admin_username if this admin is different from current admin
  const systemStatsParams = admin.username !== currentAdmin?.username 
    ? { admin_username: admin.username }
    : undefined;

  // Fetch system stats specific to this admin
  const { data: adminSystemStats } = useGetSystemStats(
    systemStatsParams,
    {
      query: {
        refetchInterval: 5000,
      },
    }
  )

  // Use admin-specific stats if available, otherwise fall back to global stats
  const statsToUse = adminSystemStats || systemStats

  // For DataUsageChart: pass admin_username only if different from current admin
  const shouldPassAdminUsername = admin.username !== currentAdmin?.username;

  if (showAdminInfo)
    return (
      <div className="flex flex-col gap-6 rounded-lg border px-2.5 md:px-4 py-4 shadow-lg">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-2">
            <UserCircleIcon className="size-7 text-muted-foreground" />
            <span className="text-xl font-bold">{admin.username}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <UserStatisticsCard data={statsToUse} />
          <DataUsageChart admin_username={shouldPassAdminUsername ? admin.username : undefined} />
        </div>
      </div>
    )

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <UserStatisticsCard data={statsToUse} />
      <DataUsageChart admin_username={shouldPassAdminUsername ? admin.username : undefined} />
    </div>
  )
}

export default AdminStatisticsCard
