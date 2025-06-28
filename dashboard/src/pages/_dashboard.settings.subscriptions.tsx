import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Filter, FileText, Link, Clock, HelpCircle, User, Settings, Code, FileCode2, Sword, Shield, Lock, GripVertical } from 'lucide-react'
import { useSettingsContext } from './_dashboard.settings'
import { ConfigFormat } from '@/service/api'
import { toast } from 'sonner'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Enhanced validation schema for subscription settings
const subscriptionSchema = z.object({
  url_prefix: z.string().optional(),
  update_interval: z.number().min(1, 'Update interval must be at least 1 hour').max(168, 'Update interval cannot exceed 168 hours (1 week)').optional(),
  support_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  profile_title: z.string().optional(),
  host_status_filter: z.boolean(),
  rules: z.array(z.object({
    pattern: z.string().min(1, 'Pattern is required'),
    target: z.enum(['links', 'links_base64', 'xray', 'sing_box', 'clash', 'clash_meta', 'outline', 'block'])
  })),
  manual_sub_request: z.object({
    links: z.boolean().optional(),
    links_base64: z.boolean().optional(),
    xray: z.boolean().optional(),
    sing_box: z.boolean().optional(),
    clash: z.boolean().optional(),
    clash_meta: z.boolean().optional(),
    outline: z.boolean().optional(),
  }).optional()
})

type SubscriptionFormData = z.infer<typeof subscriptionSchema>

const configFormatOptions = [
  { value: 'links', label: 'settings.subscriptions.configFormats.links', icon: '🔗' },
  { value: 'links_base64', label: 'settings.subscriptions.configFormats.links_base64', icon: '📝' },
  { value: 'xray', label: 'settings.subscriptions.configFormats.xray', icon: '⚡' },
  { value: 'sing_box', label: 'settings.subscriptions.configFormats.sing_box', icon: '📦' },
  { value: 'clash', label: 'settings.subscriptions.configFormats.clash', icon: '⚔️' },
  { value: 'clash_meta', label: 'settings.subscriptions.configFormats.clash_meta', icon: '🛡️' },
  { value: 'outline', label: 'settings.subscriptions.configFormats.outline', icon: '🔒' },
  { value: 'block', label: 'settings.subscriptions.configFormats.block', icon: '🚫' },
]

// Sortable Rule Component
interface SortableRuleProps {
  rule: { pattern: string; target: ConfigFormat }
  index: number
  onRemove: (index: number) => void
  form: any
  id: string
}

function SortableRule({ index, onRemove, form, id }: SortableRuleProps) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
    opacity: isDragging ? 0.8 : 1,
  }
  const cursor = isDragging ? 'grabbing' : 'grab'

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="cursor-default"
    >
      <div className="p-4 relative group h-full hover:bg-accent/20 transition-colors border rounded-md bg-card">
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          <button 
            type="button"
            style={{ cursor: cursor }} 
            className="touch-none opacity-50 group-hover:opacity-100 transition-opacity" 
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
            <span className="sr-only">Drag to reorder</span>
          </button>

          {/* Rule content */}
          <div className="flex-1 min-w-0 space-y-2">
            <FormField
              control={form.control}
              name={`rules.${index}.pattern`}
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs text-muted-foreground/80">
                    {t('settings.subscriptions.rules.pattern')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('settings.subscriptions.rules.patternPlaceholder')}
                      {...field}
                      className="font-mono text-xs h-7 bg-background/60 border-muted focus:bg-background text-foreground/90"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`rules.${index}.target`}
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs text-muted-foreground/80">
                    {t('settings.subscriptions.rules.target')}
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-7 text-xs bg-background/60 border-muted focus:bg-background">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="scrollbar-thin z-[1001]">
                      {configFormatOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{option.icon}</span>
                            <span className="text-xs">{t(option.label)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Delete button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRemove(index)
            }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 h-8 w-8 p-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/5 border border-primary/20 rounded-md pointer-events-none"></div>
        )}
      </div>
    </div>
  )
}

export default function SubscriptionSettings() {
  const { t } = useTranslation()
  const { settings, isLoading, error, updateSettings, isSaving } = useSettingsContext()

  const form = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      url_prefix: '',
      update_interval: 24,
      support_url: '',
      profile_title: '',
      host_status_filter: false,
      rules: [],
      manual_sub_request: {
        links: true,
        links_base64: true,
        xray: true,
        sing_box: true,
        clash: true,
        clash_meta: true,
        outline: true,
      }
    }
  })

  const { fields: ruleFields, append: appendRule, remove: removeRule, move: moveRule } = useFieldArray({
    control: form.control,
    name: 'rules'
  })

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for rules reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = ruleFields.findIndex((field) => field.id === active.id)
      const newIndex = ruleFields.findIndex((field) => field.id === over.id)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Only update local form state, don't trigger any API calls
        moveRule(oldIndex, newIndex)
        // The changes will only be saved when the user clicks the Save button
      }
    }
  }

  // Update form when settings are loaded
  useEffect(() => {
    if (settings?.subscription) {
      const subscriptionData = settings.subscription
      form.reset({
        url_prefix: subscriptionData.url_prefix || '',
        update_interval: subscriptionData.update_interval || 24,
        support_url: subscriptionData.support_url || '',
        profile_title: subscriptionData.profile_title || '',
        host_status_filter: subscriptionData.host_status_filter || false,
        rules: subscriptionData.rules || [],
        manual_sub_request: {
          links: subscriptionData.manual_sub_request?.links ?? true,
          links_base64: subscriptionData.manual_sub_request?.links_base64 ?? true,
          xray: subscriptionData.manual_sub_request?.xray ?? true,
          sing_box: subscriptionData.manual_sub_request?.sing_box ?? true,
          clash: subscriptionData.manual_sub_request?.clash ?? true,
          clash_meta: subscriptionData.manual_sub_request?.clash_meta ?? true,
          outline: subscriptionData.manual_sub_request?.outline ?? true,
        }
      })
    }
  }, [settings, form])

  const onSubmit = async (data: SubscriptionFormData) => {
    try {
      // Filter out empty values and prepare the payload
      const filteredData: any = {
        subscription: {
          ...data,
          // Convert empty strings to undefined
          url_prefix: data.url_prefix?.trim() || undefined,
          support_url: data.support_url?.trim() || undefined,
          profile_title: data.profile_title?.trim() || undefined,
        }
      }

      await updateSettings(filteredData)
    } catch (error) {
      // Error handling is done in the parent context
    }
  }

  const handleCancel = () => {
    if (settings?.subscription) {
      const subscriptionData = settings.subscription
      form.reset({
        url_prefix: subscriptionData.url_prefix || '',
        update_interval: subscriptionData.update_interval || 24,
        support_url: subscriptionData.support_url || '',
        profile_title: subscriptionData.profile_title || '',
        host_status_filter: subscriptionData.host_status_filter || false,
        rules: subscriptionData.rules || [],
        manual_sub_request: {
          links: subscriptionData.manual_sub_request?.links ?? true,
          links_base64: subscriptionData.manual_sub_request?.links_base64 ?? true,
          xray: subscriptionData.manual_sub_request?.xray ?? true,
          sing_box: subscriptionData.manual_sub_request?.sing_box ?? true,
          clash: subscriptionData.manual_sub_request?.clash ?? true,
          clash_meta: subscriptionData.manual_sub_request?.clash_meta ?? true,
          outline: subscriptionData.manual_sub_request?.outline ?? true,
        }
      })
      toast.success(t('settings.subscriptions.cancelSuccess'))
    }
  }

  const addRule = () => {
    appendRule({ pattern: '', target: 'links' as ConfigFormat })
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 sm:py-6 lg:py-8">
        <div className="space-y-6 sm:space-y-8 lg:space-y-10">
          {/* General Settings Skeleton */}
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-96 animate-pulse"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                  <div className="h-10 bg-muted rounded animate-pulse"></div>
                  <div className="h-3 bg-muted rounded w-64 animate-pulse"></div>
                </div>
              ))}
            </div>
            <div className="h-16 bg-muted rounded animate-pulse"></div>
          </div>
          
          {/* Rules Section Skeleton */}
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="space-y-1">
                <div className="h-6 bg-muted rounded w-32 animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-80 animate-pulse"></div>
              </div>
              <div className="h-9 bg-muted rounded w-24 animate-pulse"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="p-3 border rounded-md bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 bg-muted rounded w-4 animate-pulse"></div>
                    <div className="h-6 w-6 bg-muted rounded animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="h-3 bg-muted rounded w-16 animate-pulse"></div>
                      <div className="h-8 bg-muted rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 bg-muted rounded w-12 animate-pulse"></div>
                      <div className="h-8 bg-muted rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Formats Section Skeleton */}
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-1">
              <div className="h-6 bg-muted rounded w-40 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-72 animate-pulse"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          </div>
          
          {/* Action Buttons Skeleton */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
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
    <div className="w-full max-w-7xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8 lg:space-y-10 p-4 sm:py-6 lg:py-8">
          
          {/* General Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">
                {t('settings.subscriptions.general.title')}
              </h3>
              <p className="text-sm text-muted-foreground">{t('settings.subscriptions.general.description')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="url_prefix"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-sm font-medium flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      {t('settings.subscriptions.general.urlPrefix')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('settings.subscriptions.general.urlPrefixPlaceholder')}
                        {...field}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription className="text-sm text-muted-foreground">
                      {t('settings.subscriptions.general.urlPrefixDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="update_interval"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {t('settings.subscriptions.general.updateInterval')}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          max="168"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 24)}
                          className="pr-16"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <span className="text-sm text-muted-foreground">hours</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription className="text-sm text-muted-foreground">
                      {t('settings.subscriptions.general.updateIntervalDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="support_url"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-sm font-medium flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      {t('settings.subscriptions.general.supportUrl')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder={t('settings.subscriptions.general.supportUrlPlaceholder')}
                        {...field}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription className="text-sm text-muted-foreground">
                      {t('settings.subscriptions.general.supportUrlDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="profile_title"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t('settings.subscriptions.general.profileTitle')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('settings.subscriptions.general.profileTitlePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-sm text-muted-foreground">
                      {t('settings.subscriptions.general.profileTitleDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="host_status_filter"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <Filter className="h-4 w-4" />
                      {t('settings.subscriptions.general.hostStatusFilter')}
                    </FormLabel>
                    <FormDescription className="text-sm text-muted-foreground">
                      {t('settings.subscriptions.general.hostStatusFilterDescription')}
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
          </div>

          <Separator className="my-4" />

          {/* Subscription Rules with Drag & Drop */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  {t('settings.subscriptions.rules.title')}
                  {ruleFields.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {ruleFields.length}
                    </Badge>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">{t('settings.subscriptions.rules.description')}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRule}
                className="flex items-center gap-2 shrink-0"
              >
                <Plus className="h-4 w-4" />
                {t('settings.subscriptions.rules.addRule')}
              </Button>
            </div>

            {ruleFields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium mb-1">No rules configured</p>
                <p className="text-xs">{t('settings.subscriptions.rules.noRules')}</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={ruleFields.map(field => field.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto scrollbar-thin p-1 touch-pan-y">
                    {ruleFields.map((field, index) => (
                      <SortableRule
                        key={field.id}
                        id={field.id}
                        rule={field}
                        index={index}
                        onRemove={removeRule}
                        form={form}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <Separator className="my-4" />

          {/* Manual Subscription Formats */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                {t('settings.subscriptions.formats.title')}
              </h3>
              <p className="text-sm text-muted-foreground">{t('settings.subscriptions.formats.description')}</p>
            </div>

            {/* Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              <FormField
                control={form.control}
                name="manual_sub_request.links"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium cursor-pointer flex items-center gap-2">
                        <Link className="h-4 w-4" />
                        {t('settings.subscriptions.formats.links')}
                      </FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        {t('settings.subscriptions.formats.linksDescription')}
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

              <FormField
                control={form.control}
                name="manual_sub_request.links_base64"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium cursor-pointer flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        {t('settings.subscriptions.formats.linksBase64')}
                      </FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        {t('settings.subscriptions.formats.linksBase64Description')}
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

              <FormField
                control={form.control}
                name="manual_sub_request.xray"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium cursor-pointer flex items-center gap-2">
                        <FileCode2 className="h-4 w-4" />
                        {t('settings.subscriptions.formats.xray')}
                      </FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        {t('settings.subscriptions.formats.xrayDescription')}
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

              <FormField
                control={form.control}
                name="manual_sub_request.sing_box"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium cursor-pointer flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        {t('settings.subscriptions.formats.singBox')}
                      </FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        {t('settings.subscriptions.formats.singBoxDescription')}
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

              <FormField
                control={form.control}
                name="manual_sub_request.clash"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium cursor-pointer flex items-center gap-2">
                        <Sword className="h-4 w-4" />
                        {t('settings.subscriptions.formats.clash')}
                      </FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        {t('settings.subscriptions.formats.clashDescription')}
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

              <FormField
                control={form.control}
                name="manual_sub_request.clash_meta"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium cursor-pointer flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {t('settings.subscriptions.formats.clashMeta')}
                      </FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        {t('settings.subscriptions.formats.clashMetaDescription')}
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

              <FormField
                control={form.control}
                name="manual_sub_request.outline"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium cursor-pointer flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        {t('settings.subscriptions.formats.outline')}
                      </FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        {t('settings.subscriptions.formats.outlineDescription')}
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
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
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
