import DashboardStatistics from '@/components/dashboard/DashboardStatistics'
import UserModal from '@/components/dialogs/UserModal'
import GroupModal from '@/components/dialogs/GroupModal'
import HostModal from '@/components/dialogs/HostModal'
import NodeModal from '@/components/dialogs/NodeModal'
import AdminModal from '@/components/dialogs/AdminModal'
import UserTemplateModal from '@/components/dialogs/UserTemplateModal'
import CoreConfigModal from '@/components/dialogs/CoreConfigModal'
import QuickActionsModal from '@/components/dialogs/ShortcutsModal'
import { Separator } from '@/components/ui/separator'
import { Bookmark, SearchIcon, X } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { UseEditFormValues, UseFormValues, UserFormDefaultValues } from './_dashboard.users'
import { useQueryClient } from '@tanstack/react-query'
import { useGetCurrentAdmin, useGetSystemStats, useGetAdmins } from '@/service/api'
import AdminStatisticsCard from '@/components/dashboard/admin-statistics-card'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { groupFormSchema, GroupFormValues } from '@/components/dialogs/GroupModal'
import { nodeFormSchema, NodeFormValues } from '@/components/dialogs/NodeModal'
import { adminFormSchema, AdminFormValues } from '@/components/dialogs/AdminModal'
import { userTemplateFormSchema, UserTemplatesFromValue } from '@/components/dialogs/UserTemplateModal'
import { coreConfigFormSchema, CoreConfigFormValues } from '@/components/dialogs/CoreConfigModal'
import { HostFormValues } from '@/components/hosts/Hosts'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import useDirDetection from '@/hooks/use-dir-detection'
import { Input } from '@/components/ui/input'

const Dashboard = () => {
  const [isUserModalOpen, setUserModalOpen] = useState(false)
  const [isGroupModalOpen, setGroupModalOpen] = useState(false)
  const [isHostModalOpen, setHostModalOpen] = useState(false)
  const [isNodeModalOpen, setNodeModalOpen] = useState(false)
  const [isAdminModalOpen, setAdminModalOpen] = useState(false)
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false)
  const [isCoreModalOpen, setCoreModalOpen] = useState(false)
  const [isQuickActionsModalOpen, setQuickActionsModalOpen] = useState(false)
  const [adminSearch, setAdminSearch] = useState('')

  const userForm = useForm<UseFormValues | UseEditFormValues>({
    defaultValues: UserFormDefaultValues,
  })

  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: '',
      inbound_tags: [],
      is_disabled: false,
    },
  })

  const nodeForm = useForm<NodeFormValues>({
    resolver: zodResolver(nodeFormSchema),
    defaultValues: {
      name: '',
      address: '',
      port: 62050,
      usage_coefficient: 1,
      connection_type: 'grpc' as any,
      server_ca: '',
      keep_alive: 60,
      keep_alive_unit: 'seconds',
      max_logs: 1000,
      api_key: '',
      core_config_id: 1,
      gather_logs: true,
    },
  })

  const adminForm = useForm<AdminFormValues>({
    resolver: zodResolver(adminFormSchema),
    defaultValues: {
      username: '',
      password: '',
      passwordConfirm: '',
      is_sudo: false,
      is_disabled: false,
      discord_webhook: '',
      sub_domain: '',
      sub_template: '',
      support_url: '',
      telegram_id: undefined,
      profile_title: '',
      discord_id: undefined,
    },
  })

  const templateForm = useForm<UserTemplatesFromValue>({
    resolver: zodResolver(userTemplateFormSchema),
    defaultValues: {
      name: '',
      status: 'active' as any,
      username_prefix: '',
      username_suffix: '',
      data_limit: undefined,
      expire_duration: undefined,
      on_hold_timeout: undefined,
      method: undefined,
      flow: undefined,
      groups: [],
      resetUsages: false,
      data_limit_reset_strategy: undefined,
    },
  })

  const coreForm = useForm<CoreConfigFormValues>({
    resolver: zodResolver(coreConfigFormSchema),
    defaultValues: {
      name: '',
      config: '',
      fallback_id: [],
      excluded_inbound_ids: [],
      public_key: '',
      private_key: '',
      restart_nodes: true,
    },
  })

  const hostForm = useForm<HostFormValues>({
    defaultValues: {
      inbound_tag: '',
      status: [],
      remark: '',
      address: '',
      port: 443,
      sni: '',
      host: '',
      path: '',
      priority: 1,
      alpn: undefined,
      fingerprint: undefined,
      mux_settings: undefined,
      fragment_settings: undefined,
    },
  })

  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const dir = useDirDetection()

  const refreshAllUserData = () => {
    queryClient.invalidateQueries({ queryKey: ['getUsers'] })
    queryClient.invalidateQueries({ queryKey: ['getUsersUsage'] })
    queryClient.invalidateQueries({ queryKey: ['/api/users/'] })
  }

  const handleCreateUser = () => {
    userForm.reset()
    setUserModalOpen(true)
  }

  const handleCreateGroup = () => {
    groupForm.reset()
    setGroupModalOpen(true)
  }

  const handleCreateHost = () => {
    hostForm.reset()
    setHostModalOpen(true)
  }

  const handleCreateNode = () => {
    nodeForm.reset()
    setNodeModalOpen(true)
  }

  const handleCreateAdmin = () => {
    adminForm.reset()
    setAdminModalOpen(true)
  }

  const handleCreateTemplate = () => {
    templateForm.reset()
    setTemplateModalOpen(true)
  }

  const handleCreateCore = () => {
    coreForm.reset()
    setCoreModalOpen(true)
  }

  const handleOpenQuickActions = () => {
    setQuickActionsModalOpen(true)
  }

  const handleHostSubmit = async () => {
    try {
      // For now, just pass the form data directly to the modal
      // The modal will handle the complex type conversions
      return { status: 200 }
    } catch (error: any) {
      console.error('Error submitting host:', error)
      toast.error(error?.message || 'Failed to create host')
      return { status: 500 }
    }
  }

  // Keyboard shortcuts for dashboard actions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + N - Create new user
      if (event.key === 'n' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handleCreateUser()
      }
      // Ctrl/Cmd + R - Refresh data
      if (event.key === 'r' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        refreshAllUserData()
      }
      // Ctrl/Cmd + K - Open quick actions modal
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handleOpenQuickActions()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const { data: systemStatsData } = useGetSystemStats(undefined, {
    query: {
      refetchInterval: 5000,
    },
  })

  const { data: currentAdmin } = useGetCurrentAdmin()
  const is_sudo = currentAdmin?.is_sudo || false

  const { data: admins } = useGetAdmins()
  const filteredAdmins = useMemo(() => {
    if (!admins) return []
    if (!adminSearch.trim()) return admins
    return admins.filter(admin =>
      admin.username.toLowerCase().includes(adminSearch.toLowerCase())
    )
  }, [admins, adminSearch])

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="w-full transform-gpu animate-fade-in" style={{ animationDuration: '400ms' }}>
        <div className="w-full mx-auto py-4 md:pt-6 gap-4 flex items-start justify-between flex-row px-4">
          <div className="flex flex-col gap-y-1 flex-1 min-w-0">
            <h1 className="font-medium text-lg sm:text-xl">{t('dashboard')}</h1>
            <span className="whitespace-normal text-muted-foreground text-xs sm:text-sm">{t('dashboardDescription')}</span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button onClick={handleOpenQuickActions} size="sm" variant="outline" className="hidden sm:flex">
              <Bookmark className="h-4 w-4 mr-2" />
              {t('quickActions.title')}
            </Button>
            <Button onClick={handleOpenQuickActions} size="sm" variant="outline" className="sm:hidden">
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Separator />
      </div>

      <div className="w-full px-4 pt-2">
        <div className="flex flex-col gap-6">
          <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}>
            <DashboardStatistics systemData={systemStatsData} />
          </div>
          <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '250ms', animationFillMode: 'both' }}>
            {is_sudo ? (
              <>
                {/* Admin search input */}
                <div className="relative w-full mb-4" dir={dir}>
                  <SearchIcon className={`absolute ${dir === 'rtl' ? 'right-2' : 'left-2'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                  <Input
                    placeholder={t('search')}
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                    className="pl-8 pr-10"
                  />
                  {adminSearch && (
                    <button
                      onClick={() => setAdminSearch('')}
                      className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {/* Filtered admin cards */}
                <div className="flex flex-col gap-4">
                  {filteredAdmins.map(admin => (
                    <AdminStatisticsCard key={admin.username} admin={admin} systemStats={systemStatsData} />
                  ))}
                </div>
              </>
            ) : (
              <AdminStatisticsCard showAdminInfo={false} admin={currentAdmin} systemStats={systemStatsData} />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <UserModal isDialogOpen={isUserModalOpen} onOpenChange={setUserModalOpen} form={userForm} editingUser={false} onSuccessCallback={refreshAllUserData} />
      <GroupModal isDialogOpen={isGroupModalOpen} onOpenChange={setGroupModalOpen} form={groupForm} editingGroup={false} />
      <HostModal isDialogOpen={isHostModalOpen} onOpenChange={setHostModalOpen} onSubmit={handleHostSubmit} form={hostForm} />
      <NodeModal isDialogOpen={isNodeModalOpen} onOpenChange={setNodeModalOpen} form={nodeForm} editingNode={false} />
      <AdminModal isDialogOpen={isAdminModalOpen} onOpenChange={setAdminModalOpen} form={adminForm} editingAdmin={false} editingAdminUserName="" />
      <UserTemplateModal isDialogOpen={isTemplateModalOpen} onOpenChange={setTemplateModalOpen} form={templateForm} editingUserTemplate={false} />
      <CoreConfigModal isDialogOpen={isCoreModalOpen} onOpenChange={setCoreModalOpen} form={coreForm} editingCore={false} />
      <QuickActionsModal
        open={isQuickActionsModalOpen}
        onClose={() => setQuickActionsModalOpen(false)}
        onCreateUser={handleCreateUser}
        onCreateGroup={handleCreateGroup}
        onCreateHost={handleCreateHost}
        onCreateNode={handleCreateNode}
        onCreateAdmin={handleCreateAdmin}
        onCreateTemplate={handleCreateTemplate}
        onCreateCore={handleCreateCore}
      />
    </div>
  )
}

export default Dashboard
