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
    },
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
        },
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
              {[...Array(2)].map((_, i) => (
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
                <h3 className="text-lg font-semibold tracking-tight">{t('settings.discord.general.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.discord.general.description')}</p>
              </div>

              {/* Enable Discord */}
              <FormField
                control={form.control}
                name="enable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-x-2 space-y-0 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50 sm:p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <MessageCircle className="h-4 w-4" />
                        {t('settings.discord.general.enable')}
                      </FormLabel>
                      <FormDescription className="text-sm text-muted-foreground">{t('settings.discord.general.enableDescription')}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Configuration Fields - Only show when Discord is enabled */}
              {enableDiscord && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="token"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="flex items-center gap-2 text-sm font-medium">
                          <Bot className="h-4 w-4" />
                          {t('settings.discord.general.token')}
                        </FormLabel>
                        <FormControl>
                          <PasswordInput placeholder={t('settings.discord.general.tokenPlaceholder')} {...field} className="font-mono" />
                        </FormControl>
                        <FormDescription className="text-sm text-muted-foreground">{t('settings.discord.general.tokenDescription')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="proxy_url"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="flex items-center gap-2 text-sm font-medium">
                          <Globe className="h-4 w-4" />
                          {t('settings.discord.general.proxyUrl')}
                        </FormLabel>
                        <FormControl>
                          <Input type="url" placeholder={t('settings.discord.general.proxyUrlPlaceholder')} {...field} className="font-mono" />
                        </FormControl>
                        <FormDescription className="text-sm text-muted-foreground">{t('settings.discord.general.proxyUrlDescription')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:gap-4">
            <div className="flex-1"></div>
            <div className="flex flex-col gap-3 sm:shrink-0 sm:flex-row sm:gap-4">
              <Button type="button" variant="outline" onClick={handleCancel} className="w-full min-w-[100px] sm:w-auto" disabled={isSaving}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSaveDisabled} className="w-full min-w-[100px] sm:w-auto">
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
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
