import { Button } from '@/components/ui/button'
import { useClipboard } from '@/hooks/use-clipboard'
import { Check, Copy, Edit, User, QrCode, RefreshCcw, PieChart, Trash2, EllipsisVertical } from 'lucide-react'
import { FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from './CopyButton'
import QRCodeModal from './dialogs/QRCodeModal'
import UserModal from './dialogs/UserModal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { UserResponse } from '@/service/api'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { useForm } from 'react-hook-form'
import { UseEditFormValues, UseFormValues } from '@/pages/_dashboard._index'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useRemoveUser, useResetUserDataUsage, useRevokeUserSubscription } from '@/service/api'
import { cn } from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'

type ActionButtonsProps = {
  user: UserResponse
}

export interface SubscribeLink {
  protocol: string
  link: string
  icon: string
}

const ActionButtons: FC<ActionButtonsProps> = ({ user }) => {
  const [subscribeUrl, setSubscribeUrl] = useState<string>('')
  const [subscribeLinks, setSubscribeLinks] = useState<SubscribeLink[]>([])
  const [showQRModal, setShowQRModal] = useState(false)
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isResetUsageDialogOpen, setResetUsageDialogOpen] = useState(false)
  const [isRevokeSubDialogOpen, setRevokeSubDialogOpen] = useState(false)
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const dir = useDirDetection()
  const removeUserMutation = useRemoveUser()
  const resetUserDataUsageMutation = useResetUserDataUsage()
  const revokeUserSubscriptionMutation = useRevokeUserSubscription()

  // Create form for user editing
  const userForm = useForm<UseEditFormValues>({
    defaultValues: {
      username: user.username,
      status: user.status === 'active' || user.status === 'on_hold' || user.status === 'disabled' ? user.status : 'active',
      data_limit: user.data_limit ? Math.round((Number(user.data_limit) / (1024 * 1024 * 1024)) * 100) / 100 : undefined, // Convert bytes to GB
      expire: user.expire,
      note: user.note || '',
      data_limit_reset_strategy: user.data_limit_reset_strategy || undefined,
      group_ids: user.group_ids || [], // Add group_ids
      on_hold_expire_duration: user.on_hold_expire_duration || undefined,
      next_plan: user.next_plan
        ? {
            user_template_id: user.next_plan.user_template_id ? Number(user.next_plan.user_template_id) : undefined,
            data_limit: user.next_plan.data_limit ? Number(user.next_plan.data_limit) : undefined,
            expire: user.next_plan.expire ? Number(user.next_plan.expire) : undefined,
            add_remaining_traffic: user.next_plan.add_remaining_traffic || false,
          }
        : undefined,
    },
  })

  // Update form when user data changes
  useEffect(() => {
    const values: UseFormValues = {
      username: user.username,
      status: user.status === 'active' || user.status === 'on_hold' ? user.status : 'active',
      data_limit: user.data_limit ? Math.round((Number(user.data_limit) / (1024 * 1024 * 1024)) * 100) / 100 : 0,
      expire: user.expire, // Pass raw expire value (timestamp)
      note: user.note || '',
      data_limit_reset_strategy: user.data_limit_reset_strategy || undefined,
      group_ids: user.group_ids || [],
      on_hold_expire_duration: user.on_hold_expire_duration || undefined,
      proxy_settings: user.proxy_settings || undefined,
      next_plan: user.next_plan
        ? {
            user_template_id: user.next_plan.user_template_id ? Number(user.next_plan.user_template_id) : undefined,
            data_limit: user.next_plan.data_limit ? Number(user.next_plan.data_limit) : undefined,
            expire: user.next_plan.expire ? Number(user.next_plan.expire) : undefined,
            add_remaining_traffic: user.next_plan.add_remaining_traffic || false,
          }
        : undefined,
    }

    // Update form with current values
    userForm.reset(values)
  }, [user, userForm])

  const onOpenQRModal = useCallback(() => {
    setSubscribeUrl(user.subscription_url ? user.subscription_url : '')
    setShowQRModal(true)
  }, [user.subscription_url])

  const onCloseQRModal = useCallback(() => {
    setSubscribeUrl('')
    setShowQRModal(false)
  }, [])

  useEffect(() => {
    if (user.subscription_url) {
      const subURL = user.subscription_url.startsWith('/') ? window.location.origin + user.subscription_url : user.subscription_url

      const links = [
        { protocol: 'links', link: `${subURL}/links`, icon: '🔗' },
        { protocol: 'links (base64)', link: `${subURL}/links_base64`, icon: '📝' },
        { protocol: 'xray', link: `${subURL}/xray`, icon: '⚡' },
        { protocol: 'clash', link: `${subURL}/clash`, icon: '⚔️' },
        { protocol: 'clash-meta', link: `${subURL}/clash_meta`, icon: '🛡️' },
        { protocol: 'outline', link: `${subURL}/outline`, icon: '🔒' },
        { protocol: 'sing-box', link: `${subURL}/sing_box`, icon: '📦' },
      ]
      setSubscribeLinks(links)
    }
  }, [user.subscription_url])

  const { copy, copied } = useClipboard({ timeout: 1500 })

  // Refresh user data function
  const refreshUserData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/users'] })
  }

  // Handlers for menu items
  const handleEdit = () => {
    // Only need to open modal since form values are already updated via useEffect
    setEditModalOpen(true)
  }

  const handleSetOwner = () => {
    // Implement set owner functionality
    toast({
      title: t('info'),
      description: t('setOwnerAction', { username: user.username }),
    })
  }

  const handleRevokeSubscription = () => {
    setRevokeSubDialogOpen(true)
  }

  const confirmRevokeSubscription = async () => {
    try {
      await revokeUserSubscriptionMutation.mutateAsync({ username: user.username })
      toast({
        title: t('success', { defaultValue: 'Success' }),
        description: t('userDialog.revokeSubSuccess', { name: user.username }),
      })
      setRevokeSubDialogOpen(false)
      refreshUserData()
    } catch (error: any) {
      toast({
        title: t('error', { defaultValue: 'Error' }),
        description: t('revokeUserSub.error', { name: user.username, error: error?.message || '' }),
        variant: 'destructive',
      })
    }
  }

  const handleResetUsage = () => {
    setResetUsageDialogOpen(true)
  }

  const confirmResetUsage = async () => {
    try {
      await resetUserDataUsageMutation.mutateAsync({ username: user.username })
      toast({
        title: t('success', { defaultValue: 'Success' }),
        description: t('usersTable.resetUsageSuccess', { name: user.username }),
      })
      setResetUsageDialogOpen(false)
      refreshUserData()
    } catch (error: any) {
      toast({
        title: t('error', { defaultValue: 'Error' }),
        description: t('usersTable.resetUsageFailed', { name: user.username, error: error?.message || '' }),
        variant: 'destructive',
      })
    }
  }

  const handleUsageState = () => {
    // Implement usage state functionality
    toast({
      title: t('info'),
      description: t('usageStateAction', { username: user.username }),
    })
  }

  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    try {
      await removeUserMutation.mutateAsync({ username: user.username })
      toast({
        title: t('success', { defaultValue: 'Success' }),
        description: t('usersTable.deleteSuccess', { name: user.username }),
      })
      setDeleteDialogOpen(false)
      refreshUserData()
    } catch (error: any) {
      toast({
        title: t('error', { defaultValue: 'Error' }),
        description: t('usersTable.deleteFailed', { name: user.username, error: error?.message || '' }),
        variant: 'destructive',
      })
    }
  }

  const handleCopyOrDownload = async (subLink: SubscribeLink) => {
    if (subLink.protocol === 'links' || subLink.protocol === 'links (base64)') {
      // For links protocols, fetch content and copy to clipboard
      try {
        const response = await fetch(subLink.link)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const content = await response.text()
        await copy(content)
        toast({
          title: t('success', { defaultValue: 'Success' }),
          description: t('usersTable.copied', { defaultValue: 'Copied to clipboard' }),
        })
      } catch (error) {
        console.error('Failed to fetch and copy content:', error)
        // Fallback: copy the URL instead
        try {
          await copy(subLink.link)
          toast({
            title: t('success', { defaultValue: 'Success' }),
            description: t('usersTable.copied', { defaultValue: 'URL copied to clipboard' }),
          })
        } catch (copyError) {
          toast({
            title: t('error', { defaultValue: 'Error' }),
            description: t('copyFailed', { defaultValue: 'Failed to copy content' }),
            variant: 'destructive',
          })
        }
      }
    } else {
      // For other protocols, trigger download
      try {
        const response = await fetch(subLink.link)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${user.username}-${subLink.protocol}.txt`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast({
          title: t('success', { defaultValue: 'Success' }),
          description: t('downloadSuccess', { defaultValue: 'Configuration downloaded successfully' }),
        })
      } catch (error) {
        console.error('Failed to download configuration:', error)
        toast({
          title: t('error', { defaultValue: 'Error' }),
          description: t('downloadFailed', { defaultValue: 'Failed to download configuration' }),
          variant: 'destructive',
        })
      }
    }
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <div className="flex justify-end items-center">
        <Button size="icon" variant="ghost" onClick={handleEdit} className="md:hidden">
          <Edit className="h-4 w-4" />
        </Button>
        <TooltipProvider>
          <CopyButton
            value={user.subscription_url ? (user.subscription_url.startsWith('/') ? window.location.origin + user.subscription_url : user.subscription_url) : ''}
            copiedMessage="usersTable.copied"
            defaultMessage="usersTable.copyLink"
            icon="link"
          />
          <Tooltip open={copied ? true : undefined}>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <TooltipTrigger>
                  <Button size="icon" variant="ghost">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {subscribeLinks.map(subLink => (
                  <DropdownMenuItem className="p-0 justify-start" key={subLink.link}>
                    <Button
                      variant="ghost"
                      className="w-full h-full px-2 justify-start"
                      aria-label={subLink.protocol.includes('links') ? 'Copy' : 'Download'}
                      onClick={() => handleCopyOrDownload(subLink)}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm">{subLink.icon}</span>
                        <span>{subLink.protocol}</span>
                      </span>
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>{copied ? t('usersTable.copied') : t('usersTable.copyConfigs')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Edit */}
            <DropdownMenuItem className="hidden md:flex" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              <span>{t('edit')}</span>
            </DropdownMenuItem>

            {/* QR Code */}
            <DropdownMenuItem onClick={onOpenQRModal}>
              <QrCode className="h-4 w-4 mr-2" />
              <span>Qr Code</span>
            </DropdownMenuItem>

            {/* Set Owner */}
            <DropdownMenuItem onClick={handleSetOwner}>
              <User className="h-4 w-4 mr-2" />
              <span>{t('setOwner')}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Revoke Sub */}
            <DropdownMenuItem onClick={handleRevokeSubscription}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              <span>{t('userDialog.revokeSubscription')}</span>
            </DropdownMenuItem>

            {/* Reset Usage */}
            <DropdownMenuItem onClick={handleResetUsage}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              <span>{t('userDialog.resetUsage')}</span>
            </DropdownMenuItem>

            {/* Usage State */}
            <DropdownMenuItem onClick={handleUsageState}>
              <PieChart className="h-4 w-4 mr-2" />
              <span>{t('userDialog.usage')}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Trash */}
            <DropdownMenuItem onClick={handleDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              <span>{t('remove')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* QR Code Modal */}
      {showQRModal && subscribeUrl && <QRCodeModal subscribeLinks={subscribeLinks} subscribeUrl={subscribeUrl} onCloseModal={onCloseQRModal} />}

      {/* Delete User Confirm Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(dir === 'rtl' && 'text-right')}>{t('usersTable.deleteUserTitle')}</AlertDialogTitle>
            <AlertDialogDescription className={cn(dir === 'rtl' && 'text-right')}>{t('usersTable.deleteUserPrompt', { name: user.username })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center gap-2">
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>{t('usersTable.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={removeUserMutation.isPending}>
              {t('usersTable.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Usage Confirm Dialog */}
      <AlertDialog open={isResetUsageDialogOpen} onOpenChange={setResetUsageDialogOpen}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(dir === 'rtl' && 'text-right')}>{t('usersTable.resetUsageTitle')}</AlertDialogTitle>
            <AlertDialogDescription className={cn(dir === 'rtl' && 'text-right')}>{t('usersTable.resetUsagePrompt', { name: user.username })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center gap-2">
            <AlertDialogCancel onClick={() => setResetUsageDialogOpen(false)}>{t('usersTable.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetUsage} disabled={resetUserDataUsageMutation.isPending}>
              {t('usersTable.resetUsageSubmit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Subscription Confirm Dialog */}
      <AlertDialog open={isRevokeSubDialogOpen} onOpenChange={setRevokeSubDialogOpen}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(dir === 'rtl' && 'text-right')}>{t('revokeUserSub.title')}</AlertDialogTitle>
            <AlertDialogDescription className={cn(dir === 'rtl' && 'text-right')}>{t('revokeUserSub.prompt', { username: user.username })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center gap-2">
            <AlertDialogCancel onClick={() => setRevokeSubDialogOpen(false)}>{t('usersTable.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevokeSubscription} disabled={revokeUserSubscriptionMutation.isPending}>
              {t('revokeUserSub.title')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Modal */}
      <UserModal isDialogOpen={isEditModalOpen} onOpenChange={setEditModalOpen} form={userForm} editingUser={true} editingUserId={user.id} onSuccessCallback={refreshUserData} />
    </div>
  )
}

export default ActionButtons
