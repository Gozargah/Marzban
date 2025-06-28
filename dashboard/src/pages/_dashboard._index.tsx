import DashboardAdminStatistics from '@/components/dashboard/DashboardAdminStatistics'
import DashboardStatistics from '@/components/dashboard/DashboardStatistics'
import UserModal from '@/components/dialogs/UserModal'
import PageHeader from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Settings2Icon, UserPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { UseEditFormValues, UseFormValues, UserFormDefaultValues } from './_dashboard.users'
import { useQueryClient } from '@tanstack/react-query'
import { useGetCurrentAdmin, useGetSystemStats } from '@/service/api'
import AdminStatisticsCard from '@/components/dashboard/admin-statistics-card'

const Dashboard = () => {
  const { t } = useTranslation()
  const [isUserModalOpen, setUserModalOpen] = useState(false)

  const userForm = useForm<UseFormValues | UseEditFormValues>({
    defaultValues: UserFormDefaultValues,
  })

  const queryClient = useQueryClient()

  const refreshAllUserData = () => {
    queryClient.invalidateQueries({ queryKey: ['getUsers'] })
    queryClient.invalidateQueries({ queryKey: ['getUsersUsage'] })
    queryClient.invalidateQueries({ queryKey: ['/api/users/'] })
  }

  const handleCreateUser = () => {
    userForm.reset()
    setUserModalOpen(true)
  }

  const { data: systemStatsData } = useGetSystemStats(undefined, {
    query: {
      refetchInterval: 5000,
    },
  })

  const { data: currentAdmin } = useGetCurrentAdmin()
  const is_sudo = currentAdmin?.is_sudo || false

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="w-full transform-gpu animate-fade-in" style={{ animationDuration: '400ms' }}>
        <div className="flex items-center justify-between">
          <PageHeader title="dashboard" />
          <Button className="me-4">
            <Settings2Icon />
            {t('edit')}
          </Button>
        </div>
        <Separator />
      </div>

      <div className="flex w-full flex-col gap-8 px-4 pt-2">
        <div
          className="flex transform-gpu animate-slide-up flex-row items-center justify-between rounded-lg border p-4"
          style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}
        >
          <Button onClick={handleCreateUser}>
            <UserPlusIcon />
            {t('createUser')}
          </Button>
        </div>
        <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}>
          <DashboardStatistics systemData={systemStatsData} />
        </div>
        <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}>
          {is_sudo ? (
            <DashboardAdminStatistics currentAdmin={currentAdmin} systemStats={systemStatsData} />
          ) : (
            <AdminStatisticsCard showAdminInfo={false} admin={currentAdmin} systemStats={systemStatsData} />
          )}
        </div>
      </div>
      <UserModal isDialogOpen={isUserModalOpen} onOpenChange={setUserModalOpen} form={userForm} editingUser={false} onSuccessCallback={refreshAllUserData} />
    </div>
  )
}

export default Dashboard
