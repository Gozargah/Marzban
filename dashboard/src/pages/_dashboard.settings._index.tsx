import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Separator} from '@/components/ui/separator'
import {useTranslation} from 'react-i18next'
import {useGetSettings, useModifySettings} from '@/service/api'
import {useState, useEffect} from 'react'
import {Skeleton} from '@/components/ui/skeleton'
import {useForm} from 'react-hook-form'
import {z} from 'zod'
import {zodResolver} from '@hookform/resolvers/zod'
import {useForm as useTelegramForm} from 'react-hook-form'
import {useForm as useDiscordForm} from 'react-hook-form'
import {useForm as useWebhookForm, useFieldArray as useWebhookFieldArray} from 'react-hook-form'
import {Construction, Loader2} from 'lucide-react'
import {toast} from '@/hooks/use-toast'

const subscriptionSchema = z.object({
    url_prefix: z.string().optional().or(z.literal('')),
    update_interval: z.coerce.number().optional().or(z.literal(1)),
    support_url: z.string().url('Invalid URL').optional().or(z.literal('')),
    profile_title: z.string().optional().or(z.literal('')),
})

export default function GeneralSettings() {
    const {i18n, t} = useTranslation()
    const {data: settings, isLoading} = useGetSettings()
    const {mutate: modifySettings} = useModifySettings()

    const {register, handleSubmit, reset, formState: {errors}} = useForm({
        resolver: zodResolver(subscriptionSchema),
        defaultValues: {
            url_prefix: '',
            update_interval: 1,
            support_url: '',
            profile_title: '',
        }
    })

    const telegramForm = useTelegramForm({
        defaultValues: {
            enable: false,
            token: '',
            webhook_url: '',
            webhook_secret: '',
            proxy_url: '',
        },
    })

    const discordForm = useDiscordForm({
        defaultValues: {
            enable: false,
        },
    })

    const webhookForm = useWebhookForm({
        defaultValues: {
            webhooks: [{url: '', secret: ''}],
            days_left: [],
            usage_percent: [],
            timeout: 180,
            recurrent: 3,
            proxy_url: '',
        },
    })

    const webhooksFieldArray = useWebhookFieldArray({
        control: webhookForm.control,
        name: 'webhooks',
    })

    const [daysLeft, setDaysLeft] = useState<number[]>([])
    const [usagePercent, setUsagePercent] = useState<number[]>([])
    const [telegramLoading, setTelegramLoading] = useState(false)
    const [discordLoading, setDiscordLoading] = useState(false)
    const [webhookLoading, setWebhookLoading] = useState(false)
    const [subscriptionLoading, setSubscriptionLoading] = useState(false)

    useEffect(() => {
        if (settings?.subscription) {
            reset({
                url_prefix: settings.subscription.url_prefix || '',
                update_interval: settings.subscription.update_interval || 1,
                support_url: settings.subscription.support_url || '',
                profile_title: settings.subscription.profile_title || '',
            })
        }
        if (settings?.telegram) {
            telegramForm.reset({
                enable: settings.telegram.enable ?? false,
                token: settings.telegram.token ?? '',
                webhook_url: settings.telegram.webhook_url ?? '',
                webhook_secret: settings.telegram.webhook_secret ?? '',
                proxy_url: settings.telegram.proxy_url ?? '',
            })
        }
        if (settings?.discord) {
            discordForm.reset({
                enable: settings.discord.enable ?? false,
            })
        }
        if (settings?.webhook) {
            webhookForm.reset({
                webhooks: settings.webhook.webhooks?.length ? settings.webhook.webhooks : [{url: '', secret: ''}],
                timeout: settings.webhook.timeout ?? 180,
                recurrent: settings.webhook.recurrent ?? 3,
                proxy_url: settings.webhook.proxy_url ?? '',
            })
            setDaysLeft(settings.webhook.days_left || [])
            setUsagePercent(settings.webhook.usage_percent || [])
        }
    }, [settings, reset, telegramForm, discordForm, webhookForm])

    const onSubscriptionSubmit = async (data: any) => {
        setSubscriptionLoading(true)
        modifySettings(
            {data: {subscription: data}},
            {
                onSuccess: () => toast({title: t('settings.saveSuccess')}),
                onError: () => toast({title: t('settings.saveError'), variant: 'destructive'}),
                onSettled: () => setSubscriptionLoading(false),
            }
        )
    }

    const onTelegramSubmit = async (data: any) => {
        setTelegramLoading(true)
        const enable = Boolean(data.token || data.webhook_url || data.webhook_secret || data.proxy_url)
        modifySettings(
            {data: {telegram: {...data, enable}}},
            {
                onSuccess: () => toast({title: t('settings.saveSuccess')}),
                onError: () => toast({title: t('settings.saveError'), variant: 'destructive'}),
                onSettled: () => setTelegramLoading(false),
            }
        )
    }

    const onDiscordSubmit = async (data: any) => {
        setDiscordLoading(true)
        const enable = Object.values(data).some(v => v && v !== false)
        modifySettings(
            {data: {discord: {...data, enable}}},
            {
                onSuccess: () => toast({title: t('settings.saveSuccess')}),
                onError: () => toast({title: t('settings.saveError'), variant: 'destructive'}),
                onSettled: () => setDiscordLoading(false),
            }
        )
    }

    const onWebhookSubmit = async (data: any) => {
        setWebhookLoading(true)
        const enable = Boolean(
            (data.webhooks && data.webhooks.some((w: any) => w.url || w.secret)) ||
            (daysLeft && daysLeft.length) ||
            (usagePercent && usagePercent.length) ||
            data.timeout ||
            data.recurrent ||
            data.proxy_url
        )
        modifySettings(
            {data: {webhook: {...data, days_left: daysLeft, usage_percent: usagePercent, enable}}},
            {
                onSuccess: () => toast({title: t('settings.saveSuccess')}),
                onError: () => toast({title: t('settings.saveError'), variant: 'destructive'}),
                onSettled: () => setWebhookLoading(false),
            }
        )
    }

    const changeLanguage = async (lang: string) => {
        await i18n.changeLanguage(lang)
        document.documentElement.lang = lang
        document.documentElement.setAttribute('dir', i18n.dir())
    }

    return (
        <div>
            {/* Under Development Overlay */}
            <div className="absolute inset-0 top-12 bg-black/20 backdrop-blur-[2px] flex flex-col items-center z-10">
                <div className="bg-background/90 border-2 border-amber-400 dark:border-amber-600 shadow-md rounded-md p-4 max-w-md sm:max-w-lg md:max-w-xl mt-6 mx-auto flex flex-col items-center gap-3">
                    <Construction className="h-16 w-16 sm:h-20 sm:w-20 text-amber-500" />
                    <div>
                        <h2 className="text-lg font-bold text-foreground">{t("underDevelopment.title")}</h2>
                        <p className="text-sm text-muted-foreground">{t("underDevelopment.description")}</p>
                    </div>
                </div>
            </div>
            {
                isLoading ? (
                    <div className="flex flex-col gap-y-6 mt-10">
                        <div className="flex items-start flex-col gap-y-6 md:flex-row">
                            <div className="flex-1">
                                <Skeleton className="h-6 w-32 mb-2"/>
                                <Skeleton className="h-4 w-48 mb-2"/>
                            </div>
                            <div className="flex-1 w-full">
                                <Skeleton className="h-40 w-full mb-4 rounded-lg"/>
                            </div>
                        </div>
                        <div className="flex items-start flex-col gap-y-6 md:flex-row">
                            <div className="flex-1">
                                <Skeleton className="h-6 w-32 mb-2"/>
                                <Skeleton className="h-4 w-48 mb-2"/>
                            </div>
                            <div className="flex-1 w-full">
                                <Skeleton className="h-64 w-full mb-4 rounded-lg"/>
                            </div>
                        </div>
                        <div className="flex items-start flex-col gap-y-6 md:flex-row">
                            <div className="flex-1">
                                <Skeleton className="h-6 w-32 mb-2"/>
                                <Skeleton className="h-4 w-48 mb-2"/>
                            </div>
                            <div className="flex-1 w-full">
                                <Skeleton className="h-96 w-full mb-4 rounded-lg"/>
                            </div>
                        </div>
                        <div className="flex items-start flex-col gap-y-6 md:flex-row">
                            <div className="flex-1">
                                <Skeleton className="h-6 w-32 mb-2 bg-red-700"/>
                                <Skeleton className="h-4 w-48 mb-2"/>
                            </div>
                            <div className="flex-1 w-full">
                                <Skeleton className="h-64 w-full mb-4 rounded-lg"/>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-y-6 mt-10">
                        <div>
                            <div className="flex items-start flex-col gap-y-6 md:flex-row">
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-2 text-lg">Dashboard</h3>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <Card className="flex-1 pt-6 w-full">
                                    <CardContent className="space-y-6">
                                        <div className="flex items-center w-full justify-between">
                                            <div className="space-y-2 flex-1">
                                                <Label className="text-base" htmlFor="path">Path</Label>
                                                <p className="text-sm text-muted-foreground">Control your server
                                                    details</p>
                                            </div>
                                            <div className="flex-1">
                                                <Input id="path" placeholder="/"/>
                                            </div>
                                        </div>
                                        <Separator/>
                                        <div className="flex items-center w-full justify-between">
                                            <div className="space-y-2 flex-1">
                                                <Label htmlFor="language">Default Language</Label>
                                                <p className="text-sm text-muted-foreground">Control your server
                                                    details</p>
                                            </div>
                                            <div className="flex-1">
                                                <Select defaultValue={i18n.language} onValueChange={changeLanguage}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select language"/>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="en">English</SelectItem>
                                                        <SelectItem value="fa">فارسی</SelectItem>
                                                        <SelectItem value="zh">简体中文</SelectItem>
                                                        <SelectItem value="ru">Русский</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="flex items-center justify-end my-4">
                                <Button>Save Changes</Button>
                            </div>
                        </div>
                        <Separator/>
                        <div>
                            <div className="flex items-start flex-col gap-y-6 md:flex-row">
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-2 text-lg">Subscription</h3>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <Card className="flex-1 pt-6 w-full">
                                    <CardContent className="space-y-6">
                                        <form onSubmit={handleSubmit(onSubscriptionSubmit)} className="space-y-4">
                                            <div>
                                                <Label htmlFor="url_prefix">Subscription prefix</Label>
                                                <Input id="url_prefix" {...register('url_prefix')} placeholder="/sub/"/>
                                                {errors.url_prefix && <span
                                                    className="text-red-500 text-xs">{errors.url_prefix.message}</span>}
                                            </div>
                                            <div>
                                                <Label htmlFor="update_interval">Automatic update interval</Label>
                                                <Input id="update_interval"
                                                       type="number" {...register('update_interval', {valueAsNumber: true})}
                                                       placeholder="1"/>
                                                {errors.update_interval && <span
                                                    className="text-red-500 text-xs">{errors.update_interval.message}</span>}
                                            </div>
                                            <div>
                                                <Label htmlFor="profile_title">Page Title</Label>
                                                <Input id="profile_title" {...register('profile_title')}
                                                       placeholder="Marzban"/>
                                                {errors.profile_title && <span
                                                    className="text-red-500 text-xs">{errors.profile_title.message}</span>}
                                            </div>
                                            <div>
                                                <Label htmlFor="support_url">Support URL</Label>
                                                <Input id="support_url" {...register('support_url')}
                                                       placeholder="https://..."/>
                                                {errors.support_url && <span
                                                    className="text-red-500 text-xs">{errors.support_url.message}</span>}
                                            </div>
                                            <div className="flex items-center justify-end my-4">
                                                <Button type="submit" disabled={subscriptionLoading}>
                                                    {subscriptionLoading &&
                                                        <Loader2 className="animate-spin w-4 h-4 mr-2 inline"/>}
                                                    {subscriptionLoading ? t('settings.saving') : t('save', 'Save Changes')}
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                        <Separator/>
                        <div>
                            <div className="flex items-start flex-col gap-y-6 md:flex-row">
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-2 text-lg">Notifications</h3>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <Card className="flex-1 pt-6 w-full">
                                    <CardHeader className="pt-2 mb-2">
                                        <CardTitle className="mb-2">Telegram Bot</CardTitle>
                                        <p className="text-sm text-muted-foreground">Control your server details</p>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <form onSubmit={telegramForm.handleSubmit(onTelegramSubmit)}
                                              className="space-y-4">
                                            <div className="flex items-center w-full justify-between">
                                                <div className="space-y-2 flex-1">
                                                    <Label className="text-base" htmlFor="telegram-token">API
                                                        Token</Label>
                                                </div>
                                                <div className="flex-1">
                                                    <Input id="telegram-token" {...telegramForm.register('token')}
                                                           placeholder=""/>
                                                </div>
                                            </div>
                                            <div className="flex items-center w-full justify-between">
                                                <div className="space-y-2 flex-1">
                                                    <Label className="text-base" htmlFor="telegram-webhook-url">Webhook
                                                        URL</Label>
                                                </div>
                                                <div className="flex-1">
                                                    <Input
                                                        id="telegram-webhook-url" {...telegramForm.register('webhook_url')}
                                                        placeholder=""/>
                                                </div>
                                            </div>
                                            <div className="flex items-center w-full justify-between">
                                                <div className="space-y-2 flex-1">
                                                    <Label className="text-base" htmlFor="telegram-webhook-secret">Webhook
                                                        Secret</Label>
                                                </div>
                                                <div className="flex-1">
                                                    <Input
                                                        id="telegram-webhook-secret" {...telegramForm.register('webhook_secret')}
                                                        placeholder=""/>
                                                </div>
                                            </div>
                                            <div className="flex items-center w-full justify-between">
                                                <div className="space-y-2 flex-1">
                                                    <Label className="text-base" htmlFor="telegram-proxy-url">Proxy
                                                        URL</Label>
                                                </div>
                                                <div className="flex-1">
                                                    <Input
                                                        id="telegram-proxy-url" {...telegramForm.register('proxy_url')}
                                                        placeholder=""/>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end my-4">
                                                <Button type="submit" disabled={telegramLoading}>
                                                    {telegramLoading &&
                                                        <Loader2 className="animate-spin w-4 h-4 mr-2 inline"/>}
                                                    {telegramLoading ? t('settings.saving') : t('save', 'Save Changes')}
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>
                            <Separator/>
                        </div>
                        <Separator/>
                        <div>
                            <div className="flex items-start flex-col gap-y-6 md:flex-row">
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-2 text-lg">Discord</h3>
                                    <p className="text-sm text-muted-foreground">Configure Discord integration</p>
                                </div>
                                <Card className="flex-1 pt-6 w-full">
                                    <CardHeader className="pt-2 mb-2">
                                        <CardTitle className="mb-2">Discord</CardTitle>
                                        <p className="text-sm text-muted-foreground">Configure Discord integration</p>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <form onSubmit={discordForm.handleSubmit(onDiscordSubmit)}
                                              className="space-y-4">
                                            <div className="flex items-center justify-end my-4">
                                                <Button type="submit" disabled={discordLoading}>
                                                    {discordLoading &&
                                                        <Loader2 className="animate-spin w-4 h-4 mr-2 inline"/>}
                                                    {discordLoading ? t('settings.saving') : t('save', 'Save Changes')}
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>
                            <Separator/>
                        </div>
                        <Separator/>
                        <div>
                            <div className="flex items-start flex-col gap-y-6 md:flex-row">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-red-700 mb-2 text-lg">Danger Zone</h3>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <Card className="flex-1 pt-6 w-full border-red-700">
                                    <CardContent className="space-y-6">
                                        <div className="flex items-center w-full justify-between">
                                            <div className="space-y-2 flex-1">
                                                <div className="text-base">Restart Core</div>
                                                <p className="text-sm text-muted-foreground">Control your server
                                                    details</p>
                                            </div>
                                            <div className="flex-1 flex items-center justify-end">
                                                <Button variant="destructive">Restart Core</Button>
                                            </div>
                                        </div>
                                        <Separator/>
                                        <div className="flex items-center w-full justify-between">
                                            <div className="space-y-2 flex-1">
                                                <div className="text-base">Automatic delete limited users</div>
                                                <p className="text-sm text-muted-foreground">Control your server
                                                    details</p>
                                            </div>
                                            <div className="flex-1">
                                                <Select defaultValue="never">
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select language"/>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="never">Never</SelectItem>
                                                        <SelectItem value="10 Days">10 Days</SelectItem>
                                                        <SelectItem value="30 Days">30 Days</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <Separator/>
                                        <div className="flex items-center w-full justify-between">
                                            <div className="space-y-2 flex-1">
                                                <div className="text-base">Automatic delete expired users</div>
                                                <p className="text-sm text-muted-foreground">Control your server
                                                    details</p>
                                            </div>
                                            <div className="flex-1">
                                                <Select defaultValue="never">
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select language"/>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="never">Never</SelectItem>
                                                        <SelectItem value="10 Days">10 Days</SelectItem>
                                                        <SelectItem value="30 Days">30 Days</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <Separator/>
                                        <div className="flex items-center w-full justify-between">
                                            <div className="space-y-2 flex-1">
                                                <div className="text-base">Reset all usage</div>
                                                <p className="text-sm text-muted-foreground">Control your server
                                                    details</p>
                                            </div>
                                            <div className="flex-1 flex items-center justify-end">
                                                <Button variant="destructive">Clear all usage</Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="flex items-center justify-end my-4">
                                <Button>Save Changes</Button>
                            </div>
                        </div>
                        <Separator/>
                        <div>
                            <div className="flex items-start flex-col gap-y-6 md:flex-row">
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-2 text-lg">Webhook</h3>
                                    <p className="text-sm text-muted-foreground">Configure Webhook integration</p>
                                </div>
                                <Card className="flex-1 pt-6 w-full">
                                    <CardHeader className="pt-2 mb-2">
                                        <CardTitle className="mb-2">Webhook</CardTitle>
                                        <p className="text-sm text-muted-foreground">Configure Webhook integration</p>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <form onSubmit={webhookForm.handleSubmit(onWebhookSubmit)}
                                              className="space-y-4">
                                            <div>
                                                <Label className="text-base">Webhooks</Label>
                                                {webhooksFieldArray.fields.map((field, idx) => (
                                                    <div key={field.id} className="flex gap-2 mb-2">
                                                        <Input
                                                            placeholder="URL" {...webhookForm.register(`webhooks.${idx}.url`)} />
                                                        <Input
                                                            placeholder="Secret" {...webhookForm.register(`webhooks.${idx}.secret`)} />
                                                        <Button type="button" variant="destructive"
                                                                onClick={() => webhooksFieldArray.remove(idx)}>-</Button>
                                                    </div>
                                                ))}
                                                <Button type="button" onClick={() => webhooksFieldArray.append({
                                                    url: '',
                                                    secret: ''
                                                })}>Add Webhook</Button>
                                            </div>
                                            <div>
                                                <Label className="text-base" htmlFor="webhook-timeout">Timeout</Label>
                                                <Input id="webhook-timeout"
                                                       type="number" {...webhookForm.register('timeout')}
                                                       placeholder="180"/>
                                            </div>
                                            <div>
                                                <Label className="text-base"
                                                       htmlFor="webhook-recurrent">Recurrent</Label>
                                                <Input id="webhook-recurrent"
                                                       type="number" {...webhookForm.register('recurrent')}
                                                       placeholder="3"/>
                                            </div>
                                            <div>
                                                <Label className="text-base" htmlFor="webhook-proxy-url">Proxy
                                                    URL</Label>
                                                <Input id="webhook-proxy-url" {...webhookForm.register('proxy_url')}
                                                       placeholder=""/>
                                            </div>
                                            <div className="flex items-center justify-end my-4">
                                                <Button type="submit" disabled={webhookLoading}>
                                                    {webhookLoading &&
                                                        <Loader2 className="animate-spin w-4 h-4 mr-2 inline"/>}
                                                    {webhookLoading ? t('settings.saving') : t('save', 'Save Changes')}
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>
                            <Separator/>
                        </div>
                    </div>
                )}
        </div>
    )
}
