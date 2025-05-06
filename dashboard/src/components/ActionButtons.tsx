import { Button } from '@/components/ui/button'
import { useClipboard } from '@/hooks/use-clipboard'
import {
  Check, Copy, Edit, User, QrCode, RefreshCcw, PieChart, Trash2,
  EllipsisVertical
} from 'lucide-react'
import { FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from './CopyButton'
import QRCodeModal from './dialogs/QRCodeModal'
import UserModal from './dialogs/UserModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { UserResponse } from '@/service/api'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { useForm } from 'react-hook-form'
import { UseFormValues } from '@/pages/_dashboard._index'

type ActionButtonsProps = {
  user: UserResponse
}

export interface SubscribeLink {
  protocol: string
  link: string
}

const ActionButtons: FC<ActionButtonsProps> = ({ user }) => {
  const [subscribeUrl, setSubscribeUrl] = useState<string>('')
  const [subscribeLinks, setSubscribeLinks] = useState<SubscribeLink[]>([])
  const [showQRModal, setShowQRModal] = useState(false)
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  
  // Helper function to safely convert expire timestamp to ISO string or format for the form
  const formatExpireForForm = (expireTimestamp: any) => {
    if (!expireTimestamp) return '';
    
    try {
      // Convert to number and ensure it's a valid timestamp
      const timestamp = Number(expireTimestamp);
      if (isNaN(timestamp) || timestamp <= 0) return '';
      
      // Return as number (timestamp in seconds)
      return timestamp;
    } catch (e) {
      return '';
    }
  };

  // Create form for user editing
  const userForm = useForm<UseFormValues>({
    defaultValues: {
      username: user.username,
      status: user.status === 'active' || user.status === 'on_hold' ? user.status : 'active',
      data_limit: user.data_limit ? Math.round(Number(user.data_limit) / (1024 * 1024 * 1024) * 100) / 100 : undefined, // Convert bytes to GB
      expire: user.expire,
      note: user.note || '',
      data_limit_reset_strategy: user.data_limit_reset_strategy || undefined,
      group_ids: user.group_ids || [], // Add group_ids
      on_hold_expire_duration: user.on_hold_expire_duration || undefined,
      next_plan: user.next_plan ? {
        user_template_id: user.next_plan.user_template_id ? Number(user.next_plan.user_template_id) : undefined,
        data_limit: user.next_plan.data_limit ? Number(user.next_plan.data_limit) : undefined,
        expire: user.next_plan.expire ? Number(user.next_plan.expire) : undefined,
        add_remaining_traffic: user.next_plan.add_remaining_traffic || false,
        fire_on_either: user.next_plan.fire_on_either || false,
      } : undefined,
    }
  })

  // Update form when user data changes
  useEffect(() => {
    const values: UseFormValues = {
      username: user.username,
      status: user.status === 'active' || user.status === 'on_hold' ? user.status : 'active',
      data_limit: user.data_limit ? Math.round(Number(user.data_limit) / (1024 * 1024 * 1024) * 100) / 100 : 0,
      expire: user.expire, // Pass raw expire value (timestamp)
      note: user.note || '',
      data_limit_reset_strategy: user.data_limit_reset_strategy || undefined,
      group_ids: user.group_ids || [],
      on_hold_expire_duration: user.on_hold_expire_duration || undefined,
      next_plan: user.next_plan ? {
        user_template_id: user.next_plan.user_template_id ? Number(user.next_plan.user_template_id) : undefined,
        data_limit: user.next_plan.data_limit ? Number(user.next_plan.data_limit) : undefined,
        expire: user.next_plan.expire ? Number(user.next_plan.expire) : undefined,
        add_remaining_traffic: user.next_plan.add_remaining_traffic || false,
        fire_on_either: user.next_plan.fire_on_either || false,
      } : undefined,
    };
    
    // Update form with current values
    userForm.reset(values);
  }, [user, userForm]);

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
        { protocol: 'links', link: `${subURL}/links` },
        { protocol: 'links (base64)', link: `${subURL}/links-base64` },
        { protocol: 'xray', link: `${subURL}/xray` },
        { protocol: 'clash', link: `${subURL}/clash` },
        { protocol: 'clash-meta', link: `${subURL}/clash-meta` },
        { protocol: 'outline', link: `${subURL}/outline` },
        { protocol: 'sing-box', link: `${subURL}/sing-box` },
      ]
      setSubscribeLinks(links)
    }
  }, [user.subscription_url])

  const { copy, copied } = useClipboard({ timeout: 1500 })
  const handleCopy = useCallback(
    (text: string) => {
      return copy.bind(null, text)
    },
    [copy],
  )

  // Refresh user data function
  const refreshUserData = () => {
    queryClient.invalidateQueries({ queryKey: ['getUsers'] })
    queryClient.invalidateQueries({ queryKey: ['getUsersUsage'] })
  }

  // Handlers for menu items
  const handleEdit = () => {
    // Only need to open modal since form values are already updated via useEffect
    setEditModalOpen(true);
  }

  const handleSetOwner = () => {
    // Implement set owner functionality
    toast({
      title: t('info'),
      description: t('setOwnerAction', { username: user.username }),
    })
  }

  const handleRevokeSubscription = () => {
    // Implement revoke subscription functionality
    toast({
      title: t('info'),
      description: t('revokeSubscriptionAction', { username: user.username }),
    })
  }

  const handleResetUsage = () => {
    // Implement reset usage functionality
    toast({
      title: t('info'),
      description: t('resetUsageAction', { username: user.username }),
    })
  }

  const handleUsageState = () => {
    // Implement usage state functionality
    toast({
      title: t('info'),
      description: t('usageStateAction', { username: user.username }),
    })
  }

  const handleDelete = () => {
    // Implement delete functionality
    toast({
      title: t('warning'),
      description: t('deleteUserAction', { username: user.username }),
      variant: 'destructive',
    })
  }

  return (
    <div>
      <div className="flex justify-end items-center">
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
                    <Button variant="ghost" className="w-full h-full px-2 justify-start" aria-label="Copy" onClick={handleCopy(subLink.link)}>
                      <span>{subLink.protocol}</span>
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
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              <span>{t('edit')}</span>
            </DropdownMenuItem>

            {/* Set Owner */}
            <DropdownMenuItem onClick={handleSetOwner}>
              <User className="h-4 w-4 mr-2" />
              <span>{t('setOwner')}</span>
            </DropdownMenuItem>

            {/* QR Code */}
            <DropdownMenuItem onClick={onOpenQRModal}>
              <QrCode className="h-4 w-4 mr-2" />
              <span>{t('qrCode')}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Revoke Sub */}
            <DropdownMenuItem onClick={handleRevokeSubscription}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              <span>{t('revokeSub')}</span>
            </DropdownMenuItem>

            {/* Reset Usage */}
            <DropdownMenuItem onClick={handleResetUsage}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              <span>{t('resetUsage')}</span>
            </DropdownMenuItem>

            {/* Usage State */}
            <DropdownMenuItem onClick={handleUsageState}>
              <PieChart className="h-4 w-4 mr-2" />
              <span>{t('usageState')}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Trash */}
            <DropdownMenuItem onClick={handleDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              <span>{t('trash')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* QR Code Modal */}
      {showQRModal && subscribeUrl &&
        <QRCodeModal
          subscribeLinks={subscribeLinks}
          subscribeUrl={subscribeUrl}
          onCloseModal={onCloseQRModal}
        />
      }
      
      {/* Edit User Modal */}
      <UserModal
        isDialogOpen={isEditModalOpen}
        onOpenChange={setEditModalOpen}
        form={userForm}
        editingUser={true}
        editingUserId={user.id}
        onSuccessCallback={refreshUserData}
      />
    </div>
  )
}

export default ActionButtons
