import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Switch } from '@/components/ui/switch'
import { Bot, Globe, MessageCircle } from 'lucide-react'
import { useSettingsContext } from './_dashboard.settings'
import { toast } from 'sonner'

// Discord settings validation schema
const discordSettingsSchema = z.object({
  enable: z.boolean().default(false),
  token: z.string().optional(),
  proxy_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
})

type DiscordSettingsForm = z.infer<typeof discordSettingsSchema>

export default function DiscordSettings() {
  const { t } = useTranslation()
  const { settings, isLoading, error, updateSettings, isSaving } = useSettingsContext()

  const form = useForm<DiscordSettingsForm>({
    resolver: zodResolver(discordSettingsSchema),
    defaultValues: {
      enable: false,
      token: '',
      proxy_url: '',
    }
  })

  // Watch the enable field for conditional rendering
  const enableDiscord = form.watch('enable')

  // Update form when settings are loaded
  useEffect(() => {
    if (settings?.discord) {
      const discordData = settings.discord
      form.reset({
        enable: discordData.enable || false,
        token: discordData.token || '',
        proxy_url: discordData.proxy_url || '',
      })
    }
  }, [settings, form])

  const onSubmit = async (data: DiscordSettingsForm) => {
    try {
      // Filter out empty values and prepare the payload
      const filteredData: any = {
        discord: {
          ...data,
          // Convert empty strings to undefined
          token: data.token?.trim() || undefined,
          proxy_url: data.proxy_url?.trim() || undefined,
        }
      }

      await updateSettings(filteredData)
    } catch (error) {
      // Error handling is done in the parent context
    }
  }

  const handleCancel = () => {
    if (settings?.discord) {
      const discordData = settings.discord
      form.reset({
        enable: discordData.enable || false,
        token: discordData.token || '',
        proxy_url: discordData.proxy_url || '',
      })
      toast.success(t('settings.discord.cancelSuccess'))
    }
  }

  // Check if save button should be disabled
  const isSaveDisabled = isSaving

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 sm:py-6 lg:py-8">
        <div className="space-y-6 sm:space-y-8 lg:space-y-10">
          {/* General Settings Skeleton */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-96 animate-pulse"></div>
            </div>
            <div className="h-16 bg-muted rounded animate-pulse"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                  <div className="h-10 bg-muted rounded animate-pulse"></div>
                  <div className="h-3 bg-muted rounded w-64 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Action Buttons Skeleton */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
            <div className="flex-1"></div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:shrink-0">
              <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
              <div className="h-10 bg-muted rounded w-20 animate-pulse"></div>
            </div>
          </div>
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
    <div className="w-full max-w-7xl mx-auto min-h-[calc(100vh-200px)] flex flex-col">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 p-4 sm:py-6 lg:py-8">
          <div className="flex-1 space-y-6 sm:space-y-8 lg:space-y-10">
          
          {/* General Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">
                {t('settings.discord.general.title')}
              </h3>
              <p className="text-sm text-muted-foreground">{t('settings.discord.general.description')}</p>
            </div>

            {/* Enable Discord */}
            <FormField
              control={form.control}
              name="enable"
              render={({ field }) => (
                <FormItem className="flex items-center gap-x-2 justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <MessageCircle className="h-4 w-4" />
                      {t('settings.discord.general.enable')}
                    </FormLabel>
                    <FormDescription className="text-sm text-muted-foreground">
                      {t('settings.discord.general.enableDescription')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Configuration Fields - Only show when Discord is enabled */}
            {enableDiscord && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        {t('settings.discord.general.token')}
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder={t('settings.discord.general.tokenPlaceholder')}
                          {...field}
                          className="font-mono"
                        />
                      </FormControl>
                      <FormDescription className="text-sm text-muted-foreground">
                        {t('settings.discord.general.tokenDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proxy_url"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {t('settings.discord.general.proxyUrl')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder={t('settings.discord.general.proxyUrlPlaceholder')}
                          {...field}
                          className="font-mono"
                        />
                      </FormControl>
                      <FormDescription className="text-sm text-muted-foreground">
                        {t('settings.discord.general.proxyUrlDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-6 border-t mt-6">
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
                disabled={isSaveDisabled}
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
