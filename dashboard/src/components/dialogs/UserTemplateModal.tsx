import { Button } from '@/components/ui/button.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form.tsx'
import { Input } from '@/components/ui/input.tsx'
import { LoaderButton } from '@/components/ui/loader-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx'
import GroupsSelector from '@/components/common/GroupsSelector'
import useDirDetection from '@/hooks/use-dir-detection.tsx'
import useDynamicErrorHandler from '@/hooks/use-dynamic-errors.ts'
import { cn } from '@/lib/utils.ts'
import { ShadowsocksMethods, useCreateUserTemplate, useModifyUserTemplate, UserDataLimitResetStrategy, UserStatusCreate, XTLSFlows } from '@/service/api'
import { queryClient } from '@/utils/query-client.ts'
import { useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

export const userTemplateFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum([UserStatusCreate.active, UserStatusCreate.on_hold]).default(UserStatusCreate.active),
  username_prefix: z.string().optional(),
  username_suffix: z.string().optional(),
  data_limit: z.number().min(0).optional(),
  expire_duration: z.number().min(0).optional(),
  on_hold_timeout: z.number().optional(),
  method: z.enum([ShadowsocksMethods['aes-128-gcm'], ShadowsocksMethods['aes-256-gcm'], ShadowsocksMethods['chacha20-ietf-poly1305'], ShadowsocksMethods['xchacha20-poly1305']]).optional(),
  flow: z.enum([XTLSFlows[''], XTLSFlows['xtls-rprx-vision']]).optional(),
  groups: z.array(z.number()).min(1, 'Groups is required'),
  data_limit_reset_strategy: z
    .enum([
      UserDataLimitResetStrategy['month'],
      UserDataLimitResetStrategy['day'],
      UserDataLimitResetStrategy['week'],
      UserDataLimitResetStrategy['no_reset'],
      UserDataLimitResetStrategy['week'],
      UserDataLimitResetStrategy['year'],
    ])
    .optional(),
})

export type UserTemplatesFromValue = z.infer<typeof userTemplateFormSchema>

interface UserTemplatesModalprops {
  isDialogOpen: boolean
  onOpenChange: (open: boolean) => void
  form: UseFormReturn<UserTemplatesFromValue>
  editingUserTemplate: boolean
  editingUserTemplateId?: number
}

export default function UserTemplateModal({ isDialogOpen, onOpenChange, form, editingUserTemplate, editingUserTemplateId }: UserTemplatesModalprops) {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const addUserTemplateMutation = useCreateUserTemplate()
  const handleError = useDynamicErrorHandler()
  const modifyUserTemplateMutation = useModifyUserTemplate()
  const [timeType, setTimeType] = useState<'seconds' | 'hours' | 'days'>('seconds')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (values: UserTemplatesFromValue) => {
    setLoading(true)
    try {
      // Build payload according to UserTemplateCreate interface
      const submitData = {
        name: values.name,
        data_limit: values.data_limit,
        expire_duration: values.expire_duration,
        username_prefix: values.username_prefix || undefined,
        username_suffix: values.username_suffix || undefined,
        group_ids: values.groups, // map groups to group_ids
        status: values.status,
        on_hold_timeout: values.status === UserStatusCreate.on_hold ? values.on_hold_timeout : undefined,
        data_limit_reset_strategy: values.data_limit ? values.data_limit_reset_strategy : undefined,
        extra_settings:
          values.method || values.flow
            ? {
                method: values.method,
                flow: values.flow,
              }
            : undefined,
      }

      if (editingUserTemplate && editingUserTemplateId) {
        await modifyUserTemplateMutation.mutateAsync({
          templateId: editingUserTemplateId,
          data: submitData,
        })
        toast.success(
          t('templates.editSuccess', {
            name: values.name,
            defaultValue: 'User Templates «{name}» has been updated successfully',
          }),
        )
      } else {
        await addUserTemplateMutation.mutateAsync({
          data: submitData,
        })
        toast.success(
          t('templates.createSuccess', {
            name: values.name,
            defaultValue: 'User Templates «{name}» has been created successfully',
          }),
        )
      }
      // Invalidate nodes queries after successful operation
      queryClient.invalidateQueries({ queryKey: ['/api/user_templates'] })
      onOpenChange(false)
      form.reset()
    } catch (error: any) {
      const fields = [
        'name',
        'data_limit',
        'expire_duration',
        'username_prefix',
        'username_suffix',
        'groups',
        'status',
        'on_hold_timeout',
        'data_limit_reset_strategy',
        'method',
        'flow',
      ]
      handleError({ error, fields, form, contextKey: 'groups' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] h-full sm:h-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className={cn('text-xl text-start font-semibold', dir === 'rtl' && 'sm:text-right')}>
            {editingUserTemplate ? t('editUserTemplateModal.title') : t('userTemplateModal.title')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
            <div className="max-h-[76dvh] overflow-y-auto pr-4 pb-6 -mr-4 sm:max-h-[75dvh] flex flex-col sm:flex-row items-start gap-4 px-2">
              <div className="flex-1 space-y-4 w-full">
                <div className="flex flex-row gap-2 w-full ">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('templates.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('templates.name')} isError={!!form.formState.errors.name} {...field} className="min-w-40 sm:w-72" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>{t('templates.status')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('status.active', { defaultValue: 'Active' })} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={UserStatusCreate.active}>{t('status.active')}</SelectItem>
                            <SelectItem value={UserStatusCreate.on_hold}>{t('status.on_hold')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="username_prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('templates.prefix')}</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder={t('templates.prefix')} {...field} onChange={e => field.onChange(e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username_suffix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('templates.suffix')}</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder={t('templates.suffix')} {...field} onChange={e => field.onChange(e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_limit"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('templates.dataLimit')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder={t('templates.dataLimit')}
                            {...field}
                            onChange={e => {
                              const value = parseInt(e.target.value)
                              // Convert GB to bytes (1 GB = 1024 * 1024 * 1024 bytes)
                              field.onChange(value ? value * 1024 * 1024 * 1024 : 0)
                            }}
                            value={field.value ? Math.round(field.value / (1024 * 1024 * 1024)) : ''}
                            className="pr-10"
                            min="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">{t('userDialog.gb', { defaultValue: 'GB' })}</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_limit_reset_strategy"
                  render={({ field }) => {
                    // Only show if data_limit is set
                    const datalimit = form.watch('data_limit')
                    if (!datalimit) {
                      return <></>
                    }
                    return (
                      <FormItem className="flex-1">
                        <FormLabel>{t('templates.userDataLimitStrategy')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('userDialog.resetStrategyNo', { defaultValue: 'No' })} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={UserDataLimitResetStrategy['no_reset']}>{t('userDialog.resetStrategyNo')}</SelectItem>
                            <SelectItem value={UserDataLimitResetStrategy['day']}>{t('userDialog.resetStrategyDaily')}</SelectItem>
                            <SelectItem value={UserDataLimitResetStrategy['week']}>{t('userDialog.resetStrategyWeekly')}</SelectItem>
                            <SelectItem value={UserDataLimitResetStrategy['month']}>{t('userDialog.resetStrategyMonthly')}</SelectItem>
                            <SelectItem value={UserDataLimitResetStrategy['year']}>{t('userDialog.resetStrategyAnnually')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
                <FormField
                  control={form.control}
                  name="expire_duration"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('templates.expire')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder={t('templates.expire')}
                            {...field}
                            onChange={e => {
                              const value = parseInt(e.target.value)
                              field.onChange(value ? value * 24 * 60 * 60 : 0)
                            }}
                            value={field.value ? Math.round(field.value / (24 * 60 * 60)) : ''}
                            className="pr-14"
                            min="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">{t('time.days', { defaultValue: 'Days' })}</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="on_hold_timeout"
                  render={({ field }) => {
                    const changeValue = (value: number | undefined) => {
                      if (!value) return value
                      switch (timeType) {
                        case 'seconds':
                          return value
                        case 'hours':
                          return Math.round(value / 60 / 60)
                        case 'days':
                          return Math.round(value / 60 / 60 / 24)
                        default:
                          return value
                      }
                    }
                    // Only show if status is on_hold
                    const status = form.watch('status')
                    if (status !== UserStatusCreate.on_hold) {
                      return <></>
                    }
                    return (
                      <FormItem className="flex-1">
                        <FormLabel>{t('templates.onHoldTimeout')}</FormLabel>
                        <FormControl>
                          <div className="rounded-md border border-border flex flex-row overflow-hidden">
                            <div className="flex-[3]">
                              <Input
                                type="number"
                                placeholder={t('templates.onHoldTimeout')}
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value))}
                                value={changeValue(field.value)}
                                className="flex-[3] rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div className="flex-[2]">
                              <Select value={timeType} onValueChange={v => setTimeType(v as any)}>
                                <SelectTrigger className="w-full rounded-none border-0 focus:ring-0 focus:ring-offset-0">
                                  <SelectValue placeholder={t('time.seconds', { defaultValue: 'Seconds' })} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="days">{t('time.days', { defaultValue: 'Days' })}</SelectItem>
                                  <SelectItem value="hours">{t('time.hours', { defaultValue: 'Hours' })}</SelectItem>
                                  <SelectItem value="seconds">{t('time.seconds', { defaultValue: 'Seconds' })}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              </div>
              <div className="flex-1 space-y-4 w-full">
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('templates.method')}</FormLabel>
                      <Select onValueChange={value => field.onChange(value === 'null' ? undefined : value)} value={field.value ?? 'null'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('userDialog.proxySettings.method', { defaultValue: 'Select Method' })} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="null">{t('userDialog.proxySettings.flow.none', { defaultValue: 'None' })}</SelectItem>
                          <SelectItem value={ShadowsocksMethods['aes-128-gcm']}>aes-128-gcm</SelectItem>
                          <SelectItem value={ShadowsocksMethods['aes-256-gcm']}>aes-256-gcm</SelectItem>
                          <SelectItem value={ShadowsocksMethods['chacha20-ietf-poly1305']}>chacha20-ietf-poly1305</SelectItem>
                          <SelectItem value={ShadowsocksMethods['xchacha20-poly1305']}>xchacha20-poly1305</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="flow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('templates.flow')}</FormLabel>
                      <Select onValueChange={value => field.onChange(value === 'null' ? undefined : value)} value={field.value ?? 'null'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('userDialog.proxySettings.flow', { defaultValue: 'Flow' })} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="null">{t('userDialog.proxySettings.flow.none', { defaultValue: 'None' })}</SelectItem>
                          <SelectItem value={XTLSFlows['xtls-rprx-vision']}>xtls-rprx-vision</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="groups"
                  render={({ field }) => (
                    <GroupsSelector
                      control={form.control}
                      name="groups"
                      onGroupsChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <LoaderButton 
                type="submit" 
                isLoading={loading}
                loadingText={editingUserTemplate ? t('modifying') : t('creating')}
              >
                {editingUserTemplate ? t('save') : t('create')}
              </LoaderButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
