import PageHeader from '@/components/page-header'
import { Separator } from '@/components/ui/separator'
import UsersTable from '@/components/users/users-table'
import UsersStatistics from '@/components/UsersStatistics'
import { Plus } from 'lucide-react'

import UserModal from '@/components/dialogs/UserModal'
import { DEFAULT_SHADOWSOCKS_METHOD } from '@/constants/Proxies'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

// --- Zod Schemas matching backend ---
export const userStatusEnum = z.enum(['active', 'disabled', 'limited', 'expired', 'on_hold'])
export const userDataLimitResetStrategyEnum = z.enum(['no_reset', 'day', 'week', 'month', 'year'])
export const xtlsFlowsEnum = z.enum(['', 'xtls-rprx-vision'])
export const shadowsocksMethodsEnum = z.enum(['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305', 'xchacha20-poly1305'])

export const vMessSettingsSchema = z.object({
  id: z.string().uuid().optional(),
})
export const vlessSettingsSchema = z.object({
  id: z.string().uuid().optional(),
  flow: xtlsFlowsEnum.optional(),
})
export const trojanSettingsSchema = z.object({
  password: z.string().min(2).max(32).optional(),
})
export const shadowsocksSettingsSchema = z.object({
  password: z.string().min(2).max(32).optional(),
  method: shadowsocksMethodsEnum.optional(),
})
export const proxyTableInputSchema = z.object({
  vmess: vMessSettingsSchema.optional(),
  vless: vlessSettingsSchema.optional(),
  trojan: trojanSettingsSchema.optional(),
  shadowsocks: shadowsocksSettingsSchema.optional(),
})

// For creation, only 'active' and 'on_hold' are valid
export const userStatusCreateEnum = z.enum(['active', 'on_hold'])
export const userStatusEditEnum = z.enum(['active', 'on_hold', 'disabled'])

// Add NextPlanModel zod schema
export const nextPlanModelSchema = z.object({
  user_template_id: z.number().optional(),
  data_limit: z.number().min(0).optional(),
  expire: z.number().min(0).optional(),
  add_remaining_traffic: z.boolean().optional(),
})

export const userCreateSchema = z.object({
  username: z.string().min(3).max(32),
  status: userStatusCreateEnum.optional(),
  group_ids: z.array(z.number()).min(1, { message: 'validation.required' }),
  data_limit: z.number().min(0),
  expire: z.union([z.string(), z.number(), z.null()]).optional(),
  note: z.string().optional(),
  proxy_settings: proxyTableInputSchema.optional(),
  data_limit_reset_strategy: userDataLimitResetStrategyEnum.optional(),
  on_hold_expire_duration: z
    .number()
    .nullable()
    .optional()
    .superRefine((val, ctx) => {
      const status = (ctx.path.length > 0 ? ctx.path[0] : 'status') as string
      if (status === 'on_hold' && (!val || val < 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'validation.required',
        })
      }
    }),
  on_hold_timeout: z.union([z.string(), z.number(), z.null()]).optional(),
  auto_delete_in_days: z.number().optional(),
  next_plan: nextPlanModelSchema.optional(),
  template_id: z.number().optional(),
})

export const userEditSchema = z.object({
  username: z.string().min(3).max(32),
  status: userStatusEditEnum.optional(),
  group_ids: z.array(z.number()).min(1, { message: 'validation.required' }),
  data_limit: z.number().min(0),
  expire: z.union([z.string(), z.number(), z.null()]).optional(),
  note: z.string().optional(),
  proxy_settings: proxyTableInputSchema.optional(),
  data_limit_reset_strategy: userDataLimitResetStrategyEnum.optional(),
  on_hold_expire_duration: z
    .number()
    .nullable()
    .optional()
    .superRefine((val, ctx) => {
      const status = (ctx.path.length > 0 ? ctx.path[0] : 'status') as string
      if (status === 'on_hold' && (!val || val < 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'validation.required',
        })
      }
    }),
  on_hold_timeout: z.union([z.string(), z.number(), z.null()]).optional(),
  auto_delete_in_days: z.number().optional(),
  next_plan: nextPlanModelSchema.optional(),
  template_id: z.number().optional(),
})

export type UseEditFormValues = z.infer<typeof userEditSchema>

export type UseFormValues = z.infer<typeof userCreateSchema>

export const getDefaultUserForm = async () => {
  return {
    username: '',
    status: 'active',
    data_limit: 0,
    expire: '',
    note: '',
    group_ids: [],
    proxy_settings: {
      vmess: {
        id: undefined,
      },
      vless: {
        id: undefined,
        flow: '',
      },
      trojan: {
        password: undefined,
      },
      shadowsocks: {
        password: undefined,
        method: DEFAULT_SHADOWSOCKS_METHOD,
      },
    },
  } satisfies UseFormValues
}

const Users = () => {
  const [isUserModalOpen, setUserModalOpen] = useState(false)
  const queryClient = useQueryClient()
  const userForm = useForm<UseFormValues | UseEditFormValues>({
    defaultValues: getDefaultUserForm,
  })

  // Configure global refetch for all user data
  const refreshAllUserData = () => {
    // Invalidate all relevant queries
    queryClient.invalidateQueries({ queryKey: ['getUsers'] })
    queryClient.invalidateQueries({ queryKey: ['getUsersUsage'] })
    queryClient.invalidateQueries({ queryKey: ['/api/users/'] })
  }

  const handleCreateUser = () => {
    userForm.reset()
    setUserModalOpen(true)
  }

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="w-full transform-gpu animate-fade-in" style={{ animationDuration: '400ms' }}>
        <PageHeader title="users" description="manageAccounts" buttonIcon={Plus} buttonText="createUser" onButtonClick={handleCreateUser} />
        <Separator />
      </div>

      <div className="w-full px-4 pt-2">
        <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}>
          <UsersStatistics />
        </div>

        <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '250ms', animationFillMode: 'both' }}>
          <UsersTable />
        </div>
      </div>

      <UserModal isDialogOpen={isUserModalOpen} onOpenChange={setUserModalOpen} form={userForm} editingUser={false} onSuccessCallback={() => refreshAllUserData()} />
    </div>
  )
}

export default Users
