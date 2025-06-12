import { Button } from '@/components/ui/button.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx'
import { Switch } from '@/components/ui/switch.tsx'
import useDirDetection from '@/hooks/use-dir-detection.tsx'
import useDynamicErrorHandler from '@/hooks/use-dynamic-errors.ts'
import { cn } from '@/lib/utils.ts'
import { ShadowsocksMethods, useCreateUserTemplate, useGetAllGroups, useModifyUserTemplate, UserDataLimitResetStrategy, UserStatusCreate, XTLSFlows } from '@/service/api'
import { queryClient } from '@/utils/query-client.ts'
import { Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
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
  resetUsages: z.boolean().optional().default(false),
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
  const { data } = useGetAllGroups({})
  const [checkGroups, setCheckGroups] = useState(false)
  const [timeType, setTimeType] = useState<'seconds' | 'hours' | 'days'>('seconds')
  const navigate = useNavigate()
  const { data: groupsData, isLoading: groupsLoading } = useGetAllGroups()
  const checkGroupsExist = useCallback(() => {
    if (!data?.groups || data.groups.length === 0) {
      setCheckGroups(false)
      return
    }
    setCheckGroups(true)
  }, [data])

  useEffect(() => {
    if (isDialogOpen) {
      checkGroupsExist()
    }
  }, [isDialogOpen, checkGroupsExist])

  const onSubmit = async (values: UserTemplatesFromValue) => {
    try {
      // Build payload according to UserTemplateCreate interface
      const submitData = {
        name: values.name,
        data_limit: values.data_limit,
        expire_duration: values.expire_duration,
        username_prefix: values.username_prefix ? values.username_prefix : '',
        username_suffix: values.username_suffix ? values.username_suffix : '',
        group_ids: values.groups, // map groups to group_ids
        status: values.status,
        reset_usages: values.resetUsages,
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
        'resetUsages',
        'on_hold_timeout',
        'data_limit_reset_strategy',
        'method',
        'flow',
      ]
      handleError({ error, fields, form, contextKey: 'groups' })
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] h-full sm:h-auto">
        <DialogHeader>
          <DialogTitle className={cn('text-xl text-start font-semibold', dir === 'rtl' && 'sm:text-right')}>
            {editingUserTemplate ? t('editUserTemplateModal.title') : t('userTemplateModal.title')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
            <div className="max-h-[80dvh] overflow-y-auto pr-4 -mr-4 sm:max-h-[75dvh] flex flex-col sm:flex-row items-start gap-4 px-2">
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
                              <SelectValue placeholder="Active" />
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
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">GB</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="resetUsages"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <div className="flex-row justify-between items-center flex">
                        <FormLabel>{t('templates.resetUsage')}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="data_limit_reset_strategy"
                  render={({ field }) => {
                    // Only show if resetUsages is enabled
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
                              <SelectValue placeholder="" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={UserDataLimitResetStrategy['no_reset']}>No Reset</SelectItem>
                            <SelectItem value={UserDataLimitResetStrategy['day']}>Day</SelectItem>
                            <SelectItem value={UserDataLimitResetStrategy['week']}>Week</SelectItem>
                            <SelectItem value={UserDataLimitResetStrategy['month']}>Month</SelectItem>
                            <SelectItem value={UserDataLimitResetStrategy['year']}>Year</SelectItem>
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
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">Days</span>
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
                                  <SelectValue placeholder="Second" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="days">Days</SelectItem>
                                  <SelectItem value="hours">Hours</SelectItem>
                                  <SelectItem value="seconds">Seconds</SelectItem>
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
                            <SelectValue placeholder="Select Method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="null">None</SelectItem>
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
                            <SelectValue placeholder="" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="null">None</SelectItem>
                          <SelectItem value={XTLSFlows['xtls-rprx-vision']}>xtls-rprx-vision</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {groupsLoading ? (
                  <div>{t('Loading...', { defaultValue: 'Loading...' })}</div>
                ) : (
                  <FormField
                    control={form.control}
                    name="groups"
                    render={({ field }) => {
                      const [searchQuery, setSearchQuery] = useState('')
                      const selectedGroups = field.value || []
                      const filteredGroups = (groupsData?.groups || []).filter((group: any) => group.name.toLowerCase().includes(searchQuery.toLowerCase()))

                      const handleSelectAll = (checked: boolean) => {
                        if (checked) {
                          field.onChange(filteredGroups.map((group: any) => group.id))
                        } else {
                          field.onChange([])
                        }
                      }

                      // If a group is selected, clear template selection
                      const handleGroupChange = (checked: boolean, groupId: number) => {
                        if (checked) {
                          field.onChange([...selectedGroups, groupId])
                        } else {
                          field.onChange(selectedGroups.filter((id: number) => id !== groupId))
                        }
                      }

                      return (
                        <FormItem>
                          <div className="space-y-4 pt-4">
                            <div className="relative">
                              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder={t('search', { defaultValue: 'Search' }) + ' ' + t('groups', { defaultValue: 'groups' })}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-8"
                              />
                            </div>
                            <label className="flex items-center border border-border gap-2 p-3 rounded-md hover:bg-accent cursor-pointer">
                              <Checkbox checked={filteredGroups.length > 0 && selectedGroups.length === filteredGroups.length} onCheckedChange={handleSelectAll} />
                              <span className="text-sm font-medium">{t('selectAll', { defaultValue: 'Select All' })}</span>
                            </label>
                            <div className="max-h-[200px] overflow-y-auto space-y-2 p-2 border rounded-md">
                              {filteredGroups.length === 0 ? (
                                <div className="flex flex-col gap-4 w-full border-yellow-500 border p-4 rounded-md">
                                  <span className="text-sm ftext-foreground font-bold text-yellow-500">{t('warning')}</span>
                                  <span className="text-sm font-medium text-foreground">
                                    <Trans
                                      i18nKey={'templates.groupsExistingWarning'}
                                      components={{
                                        a: (
                                          <a
                                            href="/groups"
                                            className="font-bold text-primary hover:underline"
                                            onClick={e => {
                                              e.preventDefault()
                                              navigate('/groups')
                                            }}
                                          />
                                        ),
                                      }}
                                    ></Trans>
                                  </span>
                                </div>
                              ) : (
                                filteredGroups.map((group: any) => (
                                  <label key={group.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                                    <Checkbox checked={selectedGroups.includes(group.id)} onCheckedChange={checked => handleGroupChange(!!checked, group.id)} />
                                    <span className="text-sm">{group.name}</span>
                                  </label>
                                ))
                              )}
                            </div>
                            {selectedGroups.length > 0 && (
                              <div className="text-sm text-muted-foreground">
                                {t('users.selectedGroups', {
                                  count: selectedGroups.length,
                                  defaultValue: '{{count}} groups selected',
                                })}
                              </div>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={!checkGroups}>
                {editingUserTemplate ? t('save') : t('create')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
