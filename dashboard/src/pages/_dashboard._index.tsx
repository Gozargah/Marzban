import PageHeader from '@/components/page-header'
import { Separator } from '@/components/ui/separator'
import UsersTable from '@/components/users-table/users-table'
import UsersStatistics from '@/components/UsersStatistics'
import { Plus } from 'lucide-react'

import UserModal from '@/components/dialogs/UserModal'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'

// --- Zod Schemas matching backend ---
export const userStatusEnum = z.enum(['active', 'disabled', 'limited', 'expired', 'on_hold']);
export const userDataLimitResetStrategyEnum = z.enum([
  'no_reset',
  'day',
  'week',
  'month',
  'year',
]);
export const xtlsFlowsEnum = z.enum(['', 'xtls-rprx-vision']);
export const shadowsocksMethodsEnum = z.enum([
  'aes-128-gcm',
  'aes-256-gcm',
  'chacha20-ietf-poly1305',
  'xchacha20-poly1305',
]);

export const vMessSettingsSchema = z.object({
  id: z.string().optional(),
});
export const vlessSettingsSchema = z.object({
  id: z.string().optional(),
  flow: xtlsFlowsEnum.optional(),
});
export const trojanSettingsSchema = z.object({
  password: z.string().optional(),
});
export const shadowsocksSettingsSchema = z.object({
  password: z.string().optional(),
  method: shadowsocksMethodsEnum.optional(),
});
export const proxyTableInputSchema = z.object({
  vmess: vMessSettingsSchema.optional(),
  vless: vlessSettingsSchema.optional(),
  trojan: trojanSettingsSchema.optional(),
  shadowsocks: shadowsocksSettingsSchema.optional(),
});

// For creation, only 'active' and 'on_hold' are valid
export const userStatusCreateEnum = z.enum(['active', 'on_hold']);

// Add NextPlanModel zod schema
export const nextPlanModelSchema = z.object({
  user_template_id: z.number().optional(),
  data_limit: z.number().min(0).optional(),
  expire: z.number().min(0).optional(),
  add_remaining_traffic: z.boolean().optional(),
  fire_on_either: z.boolean().optional(),
});

export const userCreateSchema = z.object({
  username: z.string().min(3).max(32),
  status: userStatusCreateEnum.optional(),
  group_ids: z.array(z.number()).min(1, { message: 'validation.required' }),
  data_limit: z.number().min(0),
  expire: z.union([z.string(), z.number(), z.null()]).optional(),
  note: z.string().optional(),
  proxy_settings: proxyTableInputSchema.optional(),
  data_limit_reset_strategy: userDataLimitResetStrategyEnum.optional(),
  on_hold_expire_duration: z.number().optional(),
  on_hold_timeout: z.union([z.string(), z.number(), z.null()]).optional(),
  auto_delete_in_days: z.number().optional(),
  next_plan: nextPlanModelSchema.optional(),
  template_id: z.number().optional(),
});

export type UseFormValues = z.infer<typeof userCreateSchema>;

const Dashboard = () => {
  const [isUserModalOpen, setUserModalOpen] = useState(false)
  const queryClient = useQueryClient()
  
  const userForm = useForm<UseFormValues>({
    defaultValues: {
      username: '',
      status: 'active',
      data_limit: 0,
      expire: '',
      note: '',
      group_ids: [],
    },
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
    <div className="flex flex-col gap-2 w-full items-start">
      <PageHeader 
        title="users" 
        description="manageAccounts" 
        buttonIcon={Plus} 
        buttonText="createUser" 
        onButtonClick={handleCreateUser} 
      />
      <Separator />
      <div className="px-4 w-full pt-2">
        <UsersStatistics />
        <UsersTable />
      </div>
      <UserModal
        isDialogOpen={isUserModalOpen}
        onOpenChange={setUserModalOpen}
        form={userForm}
        editingUser={false}
        onSuccessCallback={refreshAllUserData}
      />
    </div>
  )
}

export default Dashboard
