import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Webhook, Globe, Plus, Trash2, Clock, RotateCw, Target } from 'lucide-react'
import { useSettingsContext } from './_dashboard.settings'
import { toast } from 'sonner'

// Webhook settings validation schema
const webhookSettingsSchema = z.object({
  enable: z.boolean().default(false),
  webhooks: z
    .array(
      z.object({
        url: z.string().url('Please enter a valid URL'),
        secret: z.string().min(1, 'Secret is required'),
      }),
    )
    .default([]),
  days_left: z.array(z.number().min(1).max(365)).default([]),
  usage_percent: z.array(z.number().min(1).max(100)).default([]),
  timeout: z.number().min(1).max(300).default(30),
  recurrent: z.number().min(1).max(24).default(3),
  proxy_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
})

type WebhookSettingsForm = z.infer<typeof webhookSettingsSchema>

export default function WebhookSettings() {
  const { t } = useTranslation()
  const { settings, isLoading, error, updateSettings, isSaving } = useSettingsContext()

  const form = useForm<WebhookSettingsForm>({
    resolver: zodResolver(webhookSettingsSchema),
    defaultValues: {
      enable: false,
      webhooks: [],
      days_left: [],
      usage_percent: [],
      timeout: 30,
      recurrent: 3,
      proxy_url: '',
    },
  })

  const {
    fields: webhookFields,
    append: appendWebhook,
    remove: removeWebhook,
  } = useFieldArray({
    control: form.control,
    name: 'webhooks' as any,
  })

  const {
    fields: daysLeftFields,
    append: appendDaysLeft,
    remove: removeDaysLeft,
  } = useFieldArray({
    control: form.control,
    name: 'days_left' as any,
  })

  const {
    fields: usagePercentFields,
    append: appendUsagePercent,
    remove: removeUsagePercent,
  } = useFieldArray({
    control: form.control,
    name: 'usage_percent' as any,
  })

  // Watch the enable field for conditional rendering
  const enableWebhook = form.watch('enable')

  // Update form when settings are loaded
  useEffect(() => {
    if (settings?.webhook) {
      const webhookData = settings.webhook
      form.reset({
        enable: webhookData.enable || false,
        webhooks: webhookData.webhooks || [],
        days_left: webhookData.days_left || [],
        usage_percent: webhookData.usage_percent || [],
        timeout: webhookData.timeout || 30,
        recurrent: webhookData.recurrent || 3,
        proxy_url: webhookData.proxy_url || '',
      })
    }
  }, [settings, form])

  const onSubmit = async (data: WebhookSettingsForm) => {
    try {
      // Filter out empty values and prepare the payload
      const filteredData: any = {
        webhook: {
          ...data,
          // Convert empty strings to undefined
          proxy_url: data.proxy_url?.trim() || undefined,
          // Ensure arrays are properly formatted
          webhooks: data.webhooks.map(webhook => ({
            url: webhook.url.trim(),
            secret: webhook.secret.trim(),
          })),
        },
      }

      await updateSettings(filteredData)
    } catch (error) {
      // Error handling is done in the parent context
    }
  }

  const handleCancel = () => {
    if (settings?.webhook) {
      const webhookData = settings.webhook
      form.reset({
        enable: webhookData.enable || false,
        webhooks: webhookData.webhooks || [],
        days_left: webhookData.days_left || [],
        usage_percent: webhookData.usage_percent || [],
        timeout: webhookData.timeout || 30,
        recurrent: webhookData.recurrent || 3,
        proxy_url: webhookData.proxy_url || '',
      })
      toast.success(t('settings.webhook.cancelSuccess'))
    }
  }

  const addWebhook = () => {
    appendWebhook({ url: '', secret: '' })
  }

  const addDaysLeft = () => {
    appendDaysLeft(7 as any)
  }

  const addUsagePercent = () => {
    appendUsagePercent(80 as any)
  }

  // Check if save button should be disabled
  const isSaveDisabled = isSaving

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 sm:py-6 lg:py-8">
        <div className="space-y-6 sm:space-y-8 lg:space-y-10">
          {/* General Settings Skeleton */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-6 w-48 animate-pulse rounded bg-muted"></div>
              <div className="h-4 w-96 animate-pulse rounded bg-muted"></div>
            </div>
            <div className="h-16 animate-pulse rounded bg-muted"></div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted"></div>
                  <div className="h-10 animate-pulse rounded bg-muted"></div>
                  <div className="h-3 w-64 animate-pulse rounded bg-muted"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons Skeleton */}
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:gap-4">
            <div className="flex-1"></div>
            <div className="flex flex-col gap-3 sm:shrink-0 sm:flex-row sm:gap-4">
              <div className="h-10 w-24 animate-pulse rounded bg-muted"></div>
              <div className="h-10 w-20 animate-pulse rounded bg-muted"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4 sm:py-6 lg:py-8">
        <div className="space-y-3 text-center">
          <div className="text-lg text-red-500">⚠️</div>
          <p className="text-sm text-red-500">Error loading settings</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-7xl flex-col">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col p-4 sm:py-6 lg:py-8">
          <div className="flex-1 space-y-6 sm:space-y-8 lg:space-y-10">
            {/* General Settings */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold tracking-tight">{t('settings.webhook.general.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.webhook.general.description')}</p>
              </div>

              {/* Enable Webhook */}
              <FormField
                control={form.control}
                name="enable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-x-2 space-y-0 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50 sm:p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <Webhook className="h-4 w-4" />
                        {t('settings.webhook.general.enable')}
                      </FormLabel>
                      <FormDescription className="text-sm text-muted-foreground">{t('settings.webhook.general.enableDescription')}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Configuration Fields - Only show when Webhook is enabled */}
              {enableWebhook && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="timeout"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-4 w-4" />
                          {t('settings.webhook.general.timeout')}
                        </FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="300" placeholder="30" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 30)} />
                        </FormControl>
                        <FormDescription className="text-sm text-muted-foreground">{t('settings.webhook.general.timeoutDescription')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recurrent"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="flex items-center gap-2 text-sm font-medium">
                          <RotateCw className="h-4 w-4" />
                          {t('settings.webhook.general.recurrent')}
                        </FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="24" placeholder="3" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 3)} />
                        </FormControl>
                        <FormDescription className="text-sm text-muted-foreground">{t('settings.webhook.general.recurrentDescription')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="proxy_url"
                    render={({ field }) => (
                      <FormItem className="space-y-2 lg:col-span-2">
                        <FormLabel className="flex items-center gap-2 text-sm font-medium">
                          <Globe className="h-4 w-4" />
                          {t('settings.webhook.general.proxyUrl')}
                        </FormLabel>
                        <FormControl>
                          <Input type="url" placeholder={t('settings.webhook.general.proxyUrlPlaceholder')} {...field} />
                        </FormControl>
                        <FormDescription className="text-sm text-muted-foreground">{t('settings.webhook.general.proxyUrlDescription')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Webhook URLs */}
            {enableWebhook && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold tracking-tight">{t('settings.webhook.webhooks.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('settings.webhook.webhooks.description')}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addWebhook} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {t('settings.webhook.webhooks.add')}
                  </Button>
                </div>

                <div className="space-y-4">
                  {webhookFields.map((field, index) => (
                    <Card key={field.id} className="p-4">
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {t('settings.webhook.webhooks.webhook')} #{index + 1}
                          </span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeWebhook(index)} className="text-red-500 hover:bg-red-50 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`webhooks.${index}.url`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">{t('settings.webhook.webhooks.url')} *</FormLabel>
                              <FormControl>
                                <Input type="url" placeholder="https://example.com/webhook" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`webhooks.${index}.secret`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">{t('settings.webhook.webhooks.secret')} *</FormLabel>
                              <FormControl>
                                <PasswordInput placeholder={t('settings.webhook.webhooks.secretPlaceholder')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </Card>
                  ))}

                  {webhookFields.length === 0 && (
                    <Card className="border-dashed p-6 text-center">
                      <Target className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="mb-4 text-sm text-muted-foreground">{t('settings.webhook.webhooks.empty')}</p>
                      <Button type="button" variant="outline" size="sm" onClick={addWebhook} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        {t('settings.webhook.webhooks.addFirst')}
                      </Button>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Notification Triggers */}
            {enableWebhook && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Days Left Notifications */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">{t('settings.webhook.triggers.daysLeft.title')}</h4>
                      <p className="text-xs text-muted-foreground">{t('settings.webhook.triggers.daysLeft.description')}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addDaysLeft}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {daysLeftFields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-1">
                        <FormField
                          control={form.control}
                          name={`days_left.${index}`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" min="1" max="365" className="h-8 w-16 text-xs" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeDaysLeft(index)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {daysLeftFields.length === 0 && (
                      <Badge variant="outline" className="text-xs">
                        {t('settings.webhook.triggers.daysLeft.empty')}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Usage Percent Notifications */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">{t('settings.webhook.triggers.usagePercent.title')}</h4>
                      <p className="text-xs text-muted-foreground">{t('settings.webhook.triggers.usagePercent.description')}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addUsagePercent}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {usagePercentFields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-1">
                        <FormField
                          control={form.control}
                          name={`usage_percent.${index}`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" min="1" max="100" className="h-8 w-16 text-xs" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeUsagePercent(index)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {usagePercentFields.length === 0 && (
                      <Badge variant="outline" className="text-xs">
                        {t('settings.webhook.triggers.usagePercent.empty')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:gap-4">
            <div className="flex-1"></div>
            <div className="flex flex-col gap-3 sm:shrink-0 sm:flex-row sm:gap-4">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving} className="sm:w-auto">
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSaveDisabled} className="sm:w-auto">
                {isSaving ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}
