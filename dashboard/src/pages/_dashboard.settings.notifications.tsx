import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { useSettingsContext } from './_dashboard.settings'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Shield, MessageSquare, FileText, Globe, RotateCcw, Bot, Webhook } from 'lucide-react'

// Validation schema
const notificationSettingsSchema = z.object({
  notification_enable: z.object({
    admin: z.boolean().optional(),
    core: z.boolean().optional(),
    group: z.boolean().optional(),
    host: z.boolean().optional(),
    login: z.boolean().optional(),
    node: z.boolean().optional(),
    user: z.boolean().optional(),
    user_template: z.boolean().optional(),
    days_left: z.boolean().optional(),
    percentage_reached: z.boolean().optional(),
  }).optional(),
  notification_settings: z.object({
    notify_telegram: z.boolean().optional(),
    notify_discord: z.boolean().optional(),
    telegram_api_token: z.string().optional(),
    telegram_admin_id: z.number().optional(),
    telegram_channel_id: z.number().optional(),
    telegram_topic_id: z.number().optional(),
    discord_webhook_url: z.string().optional(),
    proxy_url: z.string().optional(),
    max_retries: z.number().min(1).max(10),
  }).optional(),
})

type NotificationSettingsForm = z.infer<typeof notificationSettingsSchema>

export default function NotificationSettings() {
  const { t } = useTranslation()
  
  // Use settings context instead of direct API calls
  const { settings, isLoading, error, updateSettings, isSaving } = useSettingsContext()

  const form = useForm<NotificationSettingsForm>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      notification_enable: {
        admin: false,
        core: false,
        group: false,
        host: false,
        login: false,
        node: false,
        user: false,
        user_template: false,
        days_left: false,
        percentage_reached: false,
      },
      notification_settings: {
        notify_telegram: false,
        notify_discord: false,
        telegram_api_token: '',
        telegram_admin_id: undefined,
        telegram_channel_id: undefined,
        telegram_topic_id: undefined,
        discord_webhook_url: '',
        proxy_url: '',
        max_retries: 3,
      }
    }
  })

  // Watch the telegram and discord switches to conditionally show/hide sections
  const watchTelegramEnabled = form.watch('notification_settings.notify_telegram')
  const watchDiscordEnabled = form.watch('notification_settings.notify_discord')

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      form.reset({
        notification_enable: settings.notification_enable || {},
        notification_settings: {
          notify_telegram: settings.notification_settings?.notify_telegram || false,
          notify_discord: settings.notification_settings?.notify_discord || false,
          telegram_api_token: settings.notification_settings?.telegram_api_token || '',
          telegram_admin_id: settings.notification_settings?.telegram_admin_id || undefined,
          telegram_channel_id: settings.notification_settings?.telegram_channel_id || undefined,
          telegram_topic_id: settings.notification_settings?.telegram_topic_id || undefined,
          discord_webhook_url: settings.notification_settings?.discord_webhook_url || '',
          proxy_url: settings.notification_settings?.proxy_url || '',
          max_retries: settings.notification_settings?.max_retries || 3,
        }
      })
    }
  }, [settings, form])

  const onSubmit = (data: NotificationSettingsForm) => {
    // Filter the payload based on enabled switches
    const filteredData = {
      notification_enable: data.notification_enable,
      notification_settings: {
        notify_telegram: data.notification_settings?.notify_telegram || false,
        notify_discord: data.notification_settings?.notify_discord || false,
        max_retries: data.notification_settings?.max_retries || 3,
        // Only include Telegram settings if Telegram is enabled
        ...(data.notification_settings?.notify_telegram && {
          telegram_api_token: data.notification_settings?.telegram_api_token || '',
          telegram_admin_id: data.notification_settings?.telegram_admin_id,
          telegram_channel_id: data.notification_settings?.telegram_channel_id,
          telegram_topic_id: data.notification_settings?.telegram_topic_id,
        }),
        // Only include Discord settings if Discord is enabled
        ...(data.notification_settings?.notify_discord && {
          discord_webhook_url: data.notification_settings?.discord_webhook_url || '',
        }),
        // Only include proxy if either Telegram or Discord is enabled AND proxy URL is not empty
        ...((data.notification_settings?.notify_telegram || data.notification_settings?.notify_discord) && 
            data.notification_settings?.proxy_url && 
            data.notification_settings.proxy_url.trim() !== '' && {
          proxy_url: data.notification_settings.proxy_url.trim(),
        }),
      }
    }
    
    updateSettings(filteredData)
  }

  const handleCancel = () => {
    if (settings) {
      form.reset({
        notification_enable: settings.notification_enable || {},
        notification_settings: {
          notify_telegram: settings.notification_settings?.notify_telegram || false,
          notify_discord: settings.notification_settings?.notify_discord || false,
          telegram_api_token: settings.notification_settings?.telegram_api_token || '',
          telegram_admin_id: settings.notification_settings?.telegram_admin_id || undefined,
          telegram_channel_id: settings.notification_settings?.telegram_channel_id || undefined,
          telegram_topic_id: settings.notification_settings?.telegram_topic_id || undefined,
          discord_webhook_url: settings.notification_settings?.discord_webhook_url || '',
          proxy_url: settings.notification_settings?.proxy_url || '',
          max_retries: settings.notification_settings?.max_retries || 3,
        }
      })
      toast.success(t('settings.notifications.cancelSuccess'))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] p-4 sm:py-6 lg:py-8">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">{t('loading')}.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4 sm:py-6 lg:py-8">
        <div className="text-center space-y-3">
          <div className="text-red-500 text-lg">⚠️</div>
          <p className="text-sm text-red-500">Error loading settings</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8 lg:space-y-10 p-4 sm:py-6 lg:py-8">
          
          {/* Filter Notification */}
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">{t('settings.notifications.filterTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('settings.notifications.filterDescription')}</p>
            </div>
            
            {/* Mobile: 1 column, Tablet: 2 columns, Desktop: 3-5 columns */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
              <FormField
                control={form.control}
                name="notification_enable.admin"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.admin')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notification_enable.core"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm xl:text-base font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.core')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notification_enable.group"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm xl:text-base font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.group')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notification_enable.host"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm xl:text-base font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.host')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notification_enable.login"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm xl:text-base font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.login')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notification_enable.node"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm xl:text-base font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.node')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notification_enable.user_template"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm xl:text-base font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.userTemplate')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notification_enable.user"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm xl:text-base font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.user')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notification_enable.days_left"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm xl:text-base font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.daysLeft')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notification_enable.percentage_reached"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <FormLabel className="text-xs sm:text-sm xl:text-base font-medium cursor-pointer truncate pr-2">
                      {t('settings.notifications.types.percentageReached')}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Telegram */}
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight">
                  {t('settings.notifications.telegram.title')}
                </h3>
                <p className="text-sm text-muted-foreground">{t('settings.notifications.telegram.description')}</p>
              </div>
              <FormField
                control={form.control}
                name="notification_settings.notify_telegram"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-x-3 space-y-0 shrink-0">
                    <FormLabel className="text-sm font-medium">{t('settings.notifications.title')}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            {/* Only show Telegram settings when enabled */}
            {watchTelegramEnabled && (
              <div className="space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    {t('settings.notifications.telegram.apiToken')}
                  </Label>
                  <FormField
                    control={form.control}
                    name="notification_settings.telegram_api_token"
                    render={({ field }) => (
                      <FormControl>
                        <PasswordInput 
                          {...field} 
                          className="w-full font-mono" 
                          placeholder='1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
                        />
                      </FormControl>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t('settings.notifications.telegram.adminId')}
                    </Label>
                    <FormField
                      control={form.control}
                      name="notification_settings.telegram_admin_id"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-full"
                            placeholder="123456789"
                          />
                        </FormControl>
                      )}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {t('settings.notifications.telegram.channelId')}
                    </Label>
                    <FormField
                      control={form.control}
                      name="notification_settings.telegram_channel_id"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-full"
                            placeholder="-1001234567890"
                          />
                        </FormControl>
                      )}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t('settings.notifications.telegram.topicId')}
                    </Label>
                    <FormField
                      control={form.control}
                      name="notification_settings.telegram_topic_id"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-full"
                            placeholder="123"
                          />
                        </FormControl>
                      )}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Discord */}
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight">
                  {t('settings.notifications.discord.title')}
                </h3>
                <p className="text-sm text-muted-foreground">{t('settings.notifications.discord.description')}</p>
              </div>
              <FormField
                control={form.control}
                name="notification_settings.notify_discord"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-x-3 space-y-0 shrink-0">
                    <FormLabel className="text-sm font-medium">{t('settings.notifications.title')}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            {/* Only show Discord settings when enabled */}
            {watchDiscordEnabled && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  {t('settings.notifications.discord.webhookUrl')}
                </Label>
                <FormField
                  control={form.control}
                  name="notification_settings.discord_webhook_url"
                  render={({ field }) => (
                    <FormControl>
                      <PasswordInput 
                        {...field} 
                        className="w-full font-mono" 
                        placeholder='https://discord.com/api/webhooks/1234567890/ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
                      />
                    </FormControl>
                  )}
                />
              </div>
            )}
          </div>

          {/* Advanced Settings - Only show if either Telegram or Discord is enabled */}
          {(watchTelegramEnabled || watchDiscordEnabled) && (
            <div className="space-y-4 sm:space-y-6">
              <Separator className="my-4" />
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight">{t('settings.notifications.advanced.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.notifications.advanced.description')}</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t('settings.notifications.advanced.proxyUrl')}
                  </Label>
                  <FormField
                    control={form.control}
                    name="notification_settings.proxy_url"
                    render={({ field }) => (
                      <FormControl>
                        <Input 
                          {...field} 
                          className="w-full" 
                          placeholder="https://proxy.example.com:8080"
                        />
                      </FormControl>
                    )}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    {t('settings.notifications.advanced.maxRetries')}
                  </Label>
                  <FormField
                    control={form.control}
                    name="notification_settings.max_retries"
                    render={({ field }) => (
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="10"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          className="w-full"
                          placeholder="3"
                        />
                      </FormControl>
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
            <div className="flex-1"></div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:shrink-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
                className="w-full sm:w-auto min-w-[100px]"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving}
                className="w-full sm:w-auto min-w-[100px]"
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {t('saving')}
                  </div>
                ) : (
                  t('save')
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
} 