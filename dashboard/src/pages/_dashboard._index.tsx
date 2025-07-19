import DashboardStatistics from '@/components/dashboard/DashboardStatistics'
import UserModal from '@/components/dialogs/UserModal'
import GroupModal from '@/components/dialogs/GroupModal'
import HostModal from '@/components/dialogs/HostModal'
import NodeModal from '@/components/dialogs/NodeModal'
import AdminModal from '@/components/dialogs/AdminModal'
import UserTemplateModal from '@/components/dialogs/UserTemplateModal'
import QuickActionsModal from '@/components/dialogs/ShortcutsModal'
import { Separator } from '@/components/ui/separator'
import { Bookmark, UserRound, UserCog, ChevronDown, Check, Sigma } from 'lucide-react'
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
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
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { AdminDetails } from '@/service/api'
import { Loader2 } from 'lucide-react'
import { debounce } from 'es-toolkit'

// Lazy load CoreConfigModal to prevent Monaco Editor from loading until needed
const CoreConfigModal = lazy(() => import('@/components/dialogs/CoreConfigModal'))

const PAGE_SIZE = 20;

const totalAdmin: AdminDetails = {
  username: 'Total',
  is_sudo: false,
};


const Dashboard = () => {
  const [isUserModalOpen, setUserModalOpen] = useState(false)
  const [isGroupModalOpen, setGroupModalOpen] = useState(false)
  const [isHostModalOpen, setHostModalOpen] = useState(false)
  const [isNodeModalOpen, setNodeModalOpen] = useState(false)
  const [isAdminModalOpen, setAdminModalOpen] = useState(false)
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false)
  const [isCoreModalOpen, setCoreModalOpen] = useState(false)
  const [isQuickActionsModalOpen, setQuickActionsModalOpen] = useState(false)
  const { data: currentAdmin } = useGetCurrentAdmin()
  const is_sudo = currentAdmin?.is_sudo || false

  // Admin search state - only for sudo admins
  const [selectedAdmin, setSelectedAdmin] = useState<AdminDetails | undefined>(totalAdmin)
  const [adminSearch, setAdminSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [admins, setAdmins] = useState<AdminDetails[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Debounced search - only for sudo admins
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      if (!is_sudo) return // Don't run for non-sudo admins
      setOffset(0)
      setAdmins([])
      setHasMore(true)
      setAdminSearch(value)
    }, 300),
    [is_sudo]
  )

  // In the useGetAdmins call, only set username if searching and not current admin or 'system'
  let usernameParam: string | undefined = undefined;
  if (
    is_sudo &&
    adminSearch &&
    adminSearch !== 'system' &&
    adminSearch !== currentAdmin?.username
  ) {
    usernameParam = adminSearch;
  }

  // Only fetch admins for sudo admins
  const { data: fetchedAdmins = [] } = useGetAdmins({
    limit: PAGE_SIZE,
    offset,
    ...(usernameParam ? { username: usernameParam } : {}),
  }, {
    query: {
      enabled: is_sudo, // Only fetch admins for sudo admins
    },
  })

  // When fetchedAdmins changes, update admins and hasMore - only for sudo admins
  useEffect(() => {
    if (!is_sudo) return // Don't run for non-sudo admins
    if (fetchedAdmins) {
      setAdmins(prev =>
        offset === 0 ? fetchedAdmins : [...prev, ...fetchedAdmins]
      )
      setHasMore(fetchedAdmins.length === PAGE_SIZE)
      setIsLoading(false)
    }
  }, [fetchedAdmins, offset, is_sudo])

  // Infinite scroll - only for sudo admins
  const handleScroll = useCallback(() => {
    if (!is_sudo || !listRef.current || isLoading || !hasMore) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    if (scrollHeight - scrollTop - clientHeight < 100) {
      setIsLoading(true)
      setOffset(prev => prev + PAGE_SIZE)
    }
  }, [isLoading, hasMore, is_sudo])

  useEffect(() => {
    if (!is_sudo) return // Don't add scroll listeners for non-sudo admins
    const el = listRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll, is_sudo])

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

  // Auto-select current admin when it loads - only for sudo admins
  useEffect(() => {
    if (is_sudo && currentAdmin && !selectedAdmin) {
      setSelectedAdmin(totalAdmin)
    }
  }, [currentAdmin, selectedAdmin, is_sudo])

  // Only send admin_username if selectedAdmin is explicitly set and not 'Total'
  const systemStatsParams = is_sudo && selectedAdmin && selectedAdmin.username !== 'Total'
    ? { admin_username: selectedAdmin.username }
    : undefined;

  const { data: systemStatsData } = useGetSystemStats(systemStatsParams, {
    query: {
      refetchInterval: 5000,
    },
  })

  // Filter out current admin and 'system' - only for sudo admins
  const filteredAdmins = is_sudo ? admins.filter(
    admin =>
      admin.username !== currentAdmin?.username &&
      admin.username !== 'system'
  ) : []

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="w-full transform-gpu animate-fade-in" style={{ animationDuration: '400ms' }}>
        <div className="w-full mx-auto py-3 md:py-4 lg:pt-6 gap-2 sm:gap-4 flex items-start justify-between flex-row px-3 sm:px-4">
          <div className="flex flex-col gap-y-1 flex-1 min-w-0 pr-2 sm:pr-0">
            <h1 className="font-medium text-base sm:text-lg lg:text-xl truncate">{t('dashboard')}</h1>
            <span className="whitespace-normal text-muted-foreground text-xs sm:text-sm leading-relaxed">{t('dashboardDescription')}</span>
          </div>
          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            <Button onClick={handleOpenQuickActions} size="sm" variant="outline" className="hidden sm:flex text-xs sm:text-sm">
              <Bookmark className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden lg:inline">{t('quickActions.title')}</span>
            </Button>
            <Button onClick={handleOpenQuickActions} size="sm" variant="outline" className="sm:hidden p-2">
              <Bookmark className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <Separator />
      </div>

      <div className="w-full px-3 sm:px-4 pt-2">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}>
            <DashboardStatistics systemData={systemStatsData} />
          </div>
          <Separator className="my-4" />
          <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '250ms', animationFillMode: 'both' }}>
            {is_sudo ? (
              <>
                {/* Admin Switcher for Sudo */}
                <div className="relative w-full max-w-xs sm:max-w-sm lg:max-w-md mb-3 sm:mb-4" dir={dir}>
                  <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-between h-8 sm:h-9 px-2 sm:px-3 hover:bg-muted/50 transition-colors",
                          "text-xs sm:text-sm font-medium min-w-0"
                        )}
                      >
                        <div className={cn(
                          "flex items-center gap-1 sm:gap-2 min-w-0 flex-1",
                          dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'
                        )}>
                          <Avatar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                            <AvatarFallback className="bg-muted text-xs font-medium">
                              {selectedAdmin?.username === 'Total' ? <Sigma className="h-3 w-3" /> : selectedAdmin?.username?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs sm:text-sm">
                            {selectedAdmin?.username || t('selectAdmin')}
                          </span>
                          {selectedAdmin && selectedAdmin.username !== 'Total' && (
                            <div className="flex-shrink-0">
                              {selectedAdmin.is_sudo ? (
                                <UserCog className="h-3 w-3 text-primary" />
                              ) : (
                                <UserRound className="h-3 w-3 text-primary" />
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-1" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-64 sm:w-72 lg:w-80 p-1"
                      sideOffset={4}
                      align={dir === 'rtl' ? 'end' : 'start'}
                    >
                      <Command>
                        <CommandInput
                          placeholder={t('search')}
                          onValueChange={debouncedSearch}
                          className="h-7 sm:h-8 text-xs sm:text-sm mb-1"
                        />
                        <CommandList ref={listRef}>
                          <CommandEmpty>
                            <div className="py-3 sm:py-4 text-center text-xs sm:text-sm text-muted-foreground">
                              {t('noAdminsFound') || 'No admins found'}
                            </div>
                          </CommandEmpty>

                          <CommandItem
                              onSelect={() => {
                                setSelectedAdmin(totalAdmin)
                                setDropdownOpen(false)
                              }}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 min-w-0 text-xs sm:text-sm",
                                dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'
                              )}
                            >
                              <Avatar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                                <AvatarFallback className="bg-primary/10 text-xs font-medium">
                                  <Sigma className="h-3 w-3" />
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate flex-1">
                                Total
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {selectedAdmin?.username === 'Total' && (
                                  <Check className="h-3 w-3 text-primary" />
                                )}
                              </div>
                            </CommandItem>

                          {currentAdmin && (
                            <CommandItem
                              onSelect={() => {
                                setSelectedAdmin(currentAdmin)
                                setDropdownOpen(false)
                              }}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 min-w-0 text-xs sm:text-sm",
                                dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'
                              )}
                            >
                              <Avatar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                                <AvatarFallback className="bg-primary/10 text-xs font-medium">
                                  {currentAdmin.username.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate flex-1">
                                {currentAdmin.username}
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {currentAdmin.is_sudo ? (
                                  <UserCog className="h-3 w-3 text-primary" />
                                ) : (
                                  <UserRound className="h-3 w-3 text-primary" />
                                )}
                                {selectedAdmin?.username === currentAdmin.username && (
                                  <Check className="h-3 w-3 text-primary" />
                                )}
                              </div>
                            </CommandItem>
                          )}

                          {filteredAdmins.map((admin) => (
                            <CommandItem
                              key={admin.username}
                              onSelect={() => {
                                setSelectedAdmin(admin)
                                setDropdownOpen(false)
                              }}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 min-w-0 text-xs sm:text-sm",
                                dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'
                              )}
                            >
                              <Avatar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                                <AvatarFallback className="bg-muted text-xs font-medium">
                                  {admin.username.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate flex-1">
                                {admin.username}
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {admin.is_sudo ? (
                                  <UserCog className="h-3 w-3 text-primary" />
                                ) : (
                                  <UserRound className="h-3 w-3 text-primary" />
                                )}
                                {selectedAdmin?.username === admin.username && (
                                  <Check className="h-3 w-3 text-primary" />
                                )}
                              </div>
                            </CommandItem>
                          ))}

                          {isLoading && (
                            <div className="flex justify-center py-2">
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Show only the selected admin's card */}
                <div className="flex flex-col gap-3 sm:gap-4">
                  {selectedAdmin && (
                    <AdminStatisticsCard
                      key={selectedAdmin.username}
                      admin={selectedAdmin}
                      systemStats={systemStatsData}
                      currentAdmin={currentAdmin}
                    />
                  )}
                </div>
              </>
            ) : (
              <AdminStatisticsCard
                showAdminInfo={false}
                admin={currentAdmin}
                systemStats={systemStatsData}
                currentAdmin={currentAdmin}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <UserModal isDialogOpen={isUserModalOpen} onOpenChange={setUserModalOpen} form={userForm} editingUser={false} onSuccessCallback={refreshAllUserData} />
      <GroupModal isDialogOpen={isGroupModalOpen} onOpenChange={setGroupModalOpen} form={groupForm} editingGroup={false} />
      <HostModal isDialogOpen={isHostModalOpen} onOpenChange={setHostModalOpen} onSubmit={handleHostSubmit} form={hostForm} />
      {/* Only render NodeModal for sudo admins */}
      {is_sudo && (
        <NodeModal isDialogOpen={isNodeModalOpen} onOpenChange={setNodeModalOpen} form={nodeForm} editingNode={false} />
      )}
      {/* Only render AdminModal for sudo admins */}
      {is_sudo && (
        <AdminModal isDialogOpen={isAdminModalOpen} onOpenChange={setAdminModalOpen} form={adminForm} editingAdmin={false} editingAdminUserName="" />
      )}
      <UserTemplateModal isDialogOpen={isTemplateModalOpen} onOpenChange={setTemplateModalOpen} form={templateForm} editingUserTemplate={false} />
      {/* Only render CoreConfigModal for sudo admins */}
      {is_sudo && (
        <Suspense fallback={<div />}>
          <CoreConfigModal isDialogOpen={isCoreModalOpen} onOpenChange={setCoreModalOpen} form={coreForm} editingCore={false} />
        </Suspense>
      )}
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
        isSudo={is_sudo}
      />
    </div>
  )
}

export default Dashboard
