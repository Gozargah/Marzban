import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEFAULT_SHADOWSOCKS_METHOD } from '@/constants/Proxies'
import { ShadowsocksMethods, XTLSFlows } from '@/service/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { XIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useSettingsContext } from './_dashboard.settings'

// general settings validation schema
const generalSettingsSchema = z.object({
  default_flow: z.string().default(''),
  default_method: z.string().default(''),
})

type GeneralSettingsForm = z.infer<typeof generalSettingsSchema>

export default function General() {
  const { t } = useTranslation()
  const { settings, isLoading, error, updateSettings, isSaving } = useSettingsContext()

  const form = useForm<GeneralSettingsForm>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      default_flow: '',
      default_method: '',
    },
  })

  useEffect(() => {
    form.reset({
      default_flow: settings?.general?.default_flow || '',
      default_method: settings?.general?.default_method || DEFAULT_SHADOWSOCKS_METHOD,
    })
  }, [settings])

  const onSubmit = async (data: GeneralSettingsForm) => {
    try {
      // Filter out empty values and prepare the payload
      const filteredData: any = {
        general: {
          ...data,
          default_flow: data.default_flow || undefined,
          default_method: data.default_method || DEFAULT_SHADOWSOCKS_METHOD,
        },
      }

      await updateSettings(filteredData)
    } catch (error) {
      // Error handling is done in the parent context
    }
  }

  const handleCancel = () => {
    if (settings?.general) {
      form.reset({
        default_flow: '',
        default_method: DEFAULT_SHADOWSOCKS_METHOD,
      })
      toast.success(t('settings.general.cancelSuccess'))
    }
  }

  // Check if save button should be disabled
  const isSaveDisabled = isSaving

  // TODO: skeleton needs to be improved
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
            <div className="h-16 animate-pulse rounded bg-muted"></div>
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

  const clearField = (field: keyof GeneralSettingsForm) => {
    return (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      form.setValue(field, '')
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-7xl flex-col">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col p-4 sm:py-6 lg:py-8">
          <div className="flex-1 space-y-6 sm:space-y-8 lg:space-y-10">
            {/* General Settings */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <FormField
                control={form.control}
                name="default_flow"
                render={({ field }) => (
                  <FormItem className="relative space-y-2">
                    <FormLabel className="flex items-center gap-2 text-sm font-medium">{t('settings.general.defaultFlow.title')}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        {field.value && (
                          <Button size="icon" variant="ghost" className="absolute right-8 top-6" onClick={clearField('default_flow')}>
                            <XIcon />
                          </Button>
                        )}
                        <SelectContent>
                          {Object.values(XTLSFlows)
                            .filter(Boolean)
                            .map(flow => {
                              return (
                                <SelectItem value={flow} key={flow}>
                                  {flow}
                                </SelectItem>
                              )
                            })}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription className="text-sm text-muted-foreground">{t('settings.general.defaultFlow.description')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="default_method"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="flex items-center gap-2 text-sm font-medium">{t('settings.general.defaultMethod.title')}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(ShadowsocksMethods)
                            .filter(Boolean)
                            .map(flow => {
                              return (
                                <SelectItem value={flow} key={flow}>
                                  {flow}
                                </SelectItem>
                              )
                            })}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription className="text-sm text-muted-foreground">{t('settings.general.defaultMethod.description')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:gap-4">
            <div className="flex-1"></div>
            <div className="flex flex-col gap-3 sm:shrink-0 sm:flex-row sm:gap-4">
              <Button type="button" variant="outline" onClick={handleCancel} className="w-full min-w-[100px] sm:w-auto" disabled={isSaving}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSaveDisabled} isLoading={isSaving} loadingText={t('saving')} className="w-full min-w-[100px] sm:w-auto">
                {t('save')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}
