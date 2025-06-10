import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { LoaderButton } from '@/components/ui/loader-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { UseEditFormValues, UseFormValues, userCreateSchema, userEditSchema } from '@/pages/_dashboard._index'
import { useCreateUser, useCreateUserFromTemplate, useGetAllGroups, useGetUsers, useGetUserTemplates, useModifyUser, useModifyUserWithTemplate } from '@/service/api'
import { useRelativeExpiryDate } from '@/utils/dateFormatter'
import { formatBytes } from '@/utils/formatByte'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarIcon, Layers, ListStart, Lock, RefreshCcw, Search, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { v4 as uuidv4, v5 as uuidv5, v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import useDynamicErrorHandler from "@/hooks/use-dynamic-errors.ts";
import { Calendar as PersianCalendar } from '@/components/ui/persian-calendar'
import React from 'react'

interface UserModalProps {
  isDialogOpen: boolean
  onOpenChange: (open: boolean) => void
  form: UseFormReturn<UseFormValues | UseEditFormValues>
  editingUser: boolean
  editingUserId?: number
  onSuccessCallback?: () => void
}

const isDate = (v: unknown): v is Date => typeof v === 'object' && v !== null && v instanceof Date

// Add template validation schema
const templateUserSchema = z.object({
  username: z.string().min(3).max(32),
  note: z.string().optional(),
})

// Add template modification schema
const templateModifySchema = z.object({
  note: z.string().optional(),
  user_template_id: z.number(),
})

// Helper for UUID namespace (for v5)
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

// Add this new component before the UserModal component
const ExpiryDateField = ({ field, displayDate, usePersianCalendar, calendarOpen, setCalendarOpen, handleFieldChange }: {
  field: any
  displayDate: Date | null
  usePersianCalendar: boolean
  calendarOpen: boolean
  setCalendarOpen: (open: boolean) => void
  handleFieldChange: (field: string, value: any) => void
}) => {
  const { t } = useTranslation()
  const expireInfo = useRelativeExpiryDate(displayDate ? Math.floor(displayDate.getTime() / 1000) : null)

  const handleDateSelect = React.useCallback((date: Date | undefined) => {
    if (date) {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      
      if (selectedDate < today) {
        date = now
      }
      
      if (selectedDate.getTime() === today.getTime()) {
        // Convert to UTC and set to end of day
        const utcDate = new Date(Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          23, 59, 59
        ))
        date = utcDate
      } else {
        // Convert to UTC and set current time
        const utcDate = new Date(Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          now.getUTCHours(),
          now.getUTCMinutes()
        ))
        date = utcDate
      }
      
      const timestamp = Math.floor(date.getTime() / 1000)
      field.onChange(timestamp)
      handleFieldChange('expire', timestamp)
    } else {
      field.onChange('')
      handleFieldChange('expire', undefined)
    }
    setCalendarOpen(false)
  }, [field, handleFieldChange, setCalendarOpen])

  // Get current date for comparison
  const now = new Date()

  // Function to check if a date should be disabled
  const isDateDisabled = React.useCallback((date: Date) => {
    // Create a new date object for today at midnight for accurate comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    // Disable if the date is before today
    if (compareDate < today) {
      return true
    }

    // For future dates, allow all
    return false
  }, [now])

  return (
    <FormItem className="flex-1 flex flex-col">
      <FormLabel>{t('userDialog.expiryDate', { defaultValue: 'Expire date' })}</FormLabel>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <div className="relative w-full">
              <Button
                dir={"ltr"}
                variant={'outline'}
                className={cn(
                  'w-full h-fit !mt-3.5 text-left font-normal',
                  !field.value && 'text-muted-foreground'
                )}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCalendarOpen(true)
                }}
              >
                {displayDate ? (
                  usePersianCalendar ? (
                    // Persian format
                    new Intl.DateTimeFormat('fa-IR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    }).format(displayDate)
                  ) : (
                    // Gregorian format
                    format(displayDate, 'yyyy/MM/dd HH:mm')
                  )
                ) : field.value && !isNaN(Number(field.value)) ? (
                  String(field.value)
                ) : (
                  <span>{t('userDialog.expireDate', { defaultValue: 'Expire date' })}</span>
                )}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </div>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" onInteractOutside={(e) => {
          e.preventDefault()
          setCalendarOpen(false)
        }}>
          {usePersianCalendar ? (
            <PersianCalendar
              mode="single"
              selected={displayDate || undefined}
              onSelect={handleDateSelect}
              disabled={isDateDisabled}
              captionLayout="dropdown"
              startMonth={now}
              endMonth={new Date(now.getFullYear() + 10, now.getMonth(), now.getDate())}
              formatters={{
                formatMonthDropdown: (date) => date.toLocaleString("fa-IR", { month: "short" }),
              }}
            />
          ) : (
            <Calendar
              mode="single"
              selected={displayDate || undefined}
              onSelect={handleDateSelect}
              disabled={isDateDisabled}
              captionLayout="dropdown"
              startMonth={now}
              endMonth={new Date(now.getFullYear() + 10, now.getMonth(), now.getDate())}
              formatters={{
                formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
              }}
            />
          )}
          <div className="flex items-center gap-4 p-3 border-t">
            <FormControl>
              <Input
                type="time"
                value={displayDate ? format(displayDate, 'HH:mm') : format(now, 'HH:mm')}
                min={displayDate && displayDate.toDateString() === now.toDateString() ? format(now, 'HH:mm') : undefined}
                onChange={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (displayDate && e.target.value) {
                    const [hours, minutes] = e.target.value.split(':')
                    const newDate = new Date(displayDate)
                    newDate.setHours(parseInt(hours), parseInt(minutes))

                    if (newDate.toDateString() === now.toDateString() && newDate < now) {
                      newDate.setTime(now.getTime())
                    }

                    // Convert to UTC
                    const utcDate = new Date(Date.UTC(
                      newDate.getFullYear(),
                      newDate.getMonth(),
                      newDate.getDate(),
                      newDate.getHours(),
                      newDate.getMinutes()
                    ))

                    const timestamp = Math.floor(utcDate.getTime() / 1000)
                    field.onChange(timestamp)
                    handleFieldChange('expire', timestamp)
                  }
                }}
              />
            </FormControl>
            {displayDate && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  field.onChange('')
                  handleFieldChange('expire', undefined)
                  setCalendarOpen(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {expireInfo && (
        <p className={cn(!expireInfo.time && "hidden", "text-xs text-muted-foreground")}>
          {expireInfo.time !== '0' && expireInfo.time !== '0s'
            ? t('expires', { time: expireInfo.time, defaultValue: 'Expires in {{time}}' })
            : t('expired', { time: expireInfo.time, defaultValue: 'Expired in {{time}}' })}
        </p>
      )}
      <FormMessage />
    </FormItem>
  )
}

export default function UserModal({ isDialogOpen, onOpenChange, form, editingUser, editingUserId, onSuccessCallback }: UserModalProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const handleError = useDynamicErrorHandler();
  const [loading, setLoading] = useState(false)
  const status = form.watch('status')
  const [activeTab, setActiveTab] = useState<'groups' | 'templates'>('groups')
  const tabs = [
    { id: 'groups', label: 'groups', icon: Users },
    { id: 'templates', label: 'templates.title', icon: Layers },
  ]
  const [nextPlanEnabled, setNextPlanEnabled] = useState(!!form.watch('next_plan'))
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const navigate = useNavigate()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const { i18n } = useTranslation()
  const isPersianLocale = i18n.language === 'fa'
  const [usePersianCalendar, setUsePersianCalendar] = useState(isPersianLocale)
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const [isFormValid, setIsFormValid] = useState(false)

  const handleModalOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      form.reset()
      setTouchedFields({})
      setIsFormValid(false)
    }
    onOpenChange(open)
  }, [form, onOpenChange])

  const handleFieldChange = React.useCallback((fieldName: string, value: any) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
    const currentValues = {
      ...form.getValues(),
      [fieldName]: value,
    }
    const isValid = validateAllFields(currentValues, { ...touchedFields, [fieldName]: true })
    setIsFormValid(isValid)
  }, [form, touchedFields])

  // Add handleFieldBlur function
  const handleFieldBlur = React.useCallback((fieldName: string) => {
    if (!touchedFields[fieldName]) {
      setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
      const currentValues = form.getValues()
      const isValid = validateAllFields(currentValues, { ...touchedFields, [fieldName]: true })
      setIsFormValid(isValid)
    }
  }, [form, touchedFields])

  // Get the expire value from the form
  const expireValue = form.watch('expire')
  let displayDate: Date | null = null

  // Handle various formats of expire value
  if (isDate(expireValue)) {
    displayDate = expireValue
  } else if (typeof expireValue === 'string') {
    if (expireValue === '') {
      displayDate = null
    } else {
      const asNum = Number(expireValue)
      if (!isNaN(asNum)) {
        const timestamp = asNum * 1000
        const date = new Date(timestamp)
        if (date.getFullYear() > 1970) {
          displayDate = date
        }
      } else {
        const date = new Date(expireValue)
        if (!isNaN(date.getTime()) && date.getFullYear() > 1970) {
          displayDate = date
        }
      }
    }
  } else if (typeof expireValue === 'number') {
    const date = new Date(expireValue * 1000)
    if (date.getFullYear() > 1970) {
      displayDate = date
    }
  }

  // Query client for data refetching
  const queryClient = useQueryClient()

  // Get refetch function for users
  const { refetch: refetchUsers } = useGetUsers(
    {},
    {
      query: { enabled: false },
    },
  )

  // Fetch data for tabs with proper caching and refetch on page view
  const { data: templatesData, isLoading: templatesLoading } = useGetUserTemplates(undefined, {
    query: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  })

  const { data: groupsData, isLoading: groupsLoading } = useGetAllGroups(undefined, {
    query: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  })

  // Function to refresh all user-related data
  const refreshUserData = () => {
    // Invalidate relevant queries to trigger fresh fetches
    queryClient.invalidateQueries({ queryKey: ['/api/users'] })
    queryClient.invalidateQueries({ queryKey: ['getUsersUsage'] })
    queryClient.invalidateQueries({ queryKey: ['getUserStats'] })
    queryClient.invalidateQueries({ queryKey: ['getInboundStats'] })
    queryClient.invalidateQueries({ queryKey: ['getUserOnlineStats'] })

    // Force immediate refetch
    refetchUsers()

    // Call the success callback if provided
    if (onSuccessCallback) {
      onSuccessCallback()
    }
  }

  const createUserMutation = useCreateUser({
    mutation: {
      onSuccess: () => refreshUserData(),
    },
  })
  const modifyUserMutation = useModifyUser({
    mutation: {
      onSuccess: () => refreshUserData(),
    },
  })
  const createUserFromTemplateMutation = useCreateUserFromTemplate({
    mutation: {
      onSuccess: () => refreshUserData(),
    },
  })

  // Add the mutation hook at the top with other mutations
  const modifyUserWithTemplateMutation = useModifyUserWithTemplate({
    mutation: {
      onSuccess: () => refreshUserData(),
    },
  })

  useEffect(() => {
    // When the dialog closes, reset errors
    if (!isDialogOpen) {
      form.clearErrors()
    }
  }, [isDialogOpen, form])

  useEffect(() => {
    // Set form validation schema
    form.clearErrors()
    if (!editingUser && !selectedTemplateId) {
      form.setError('username', {
        type: 'manual',
        message: t('validation.required', { field: t('username', { defaultValue: 'Username' }) }),
      })
    }
  }, [form, editingUser, t, selectedTemplateId])

  // Add new effect to update form validity when template is selected
  useEffect(() => {
    if (selectedTemplateId) {
      // If template is selected, only username is required
      const username = form.getValues('username')
      if (username && username.length >= 3) {
        // Clear all errors and set form as valid
        form.clearErrors()
        setIsFormValid(true)
        setTouchedFields({ username: true })
      } else {
        // Set username error only
        form.clearErrors()
        form.setError('username', {
          type: 'manual',
          message: t('validation.required', { field: t('username', { defaultValue: 'Username' }) }),
        })
        setIsFormValid(false)
      }
    }
  }, [selectedTemplateId, form, t])

  useEffect(() => {
    if (status === 'on_hold') {
      // Clear expire field and its errors
      form.setValue('expire', undefined)
      form.clearErrors('expire')

      // Set default on_hold_expire_duration if not set
      const duration = form.getValues('on_hold_expire_duration')
      if (!duration || duration < 1) {
        const defaultDuration = 7 * 24 * 60 * 60 // 7 days in seconds
        form.setValue('on_hold_expire_duration', defaultDuration)
        handleFieldChange('on_hold_expire_duration', defaultDuration)
      }
    } else {
      // Clear on_hold_expire_duration field and its errors
      form.setValue('on_hold_expire_duration', undefined)
      form.clearErrors('on_hold_expire_duration')
    }
  }, [status, form, t, handleFieldChange])

  useEffect(() => {
    if (!nextPlanEnabled) {
      form.setValue('next_plan', undefined)
    } else if (!form.watch('next_plan')) {
      form.setValue('next_plan', {})
    }
    // eslint-disable-next-line
  }, [nextPlanEnabled])

  // Helper to convert GB to bytes
  function gbToBytes(gb: string | number | undefined): number | undefined {
    if (gb === undefined || gb === null || gb === '') return undefined
    const num = typeof gb === 'string' ? parseFloat(gb) : gb
    if (isNaN(num)) return undefined
    return Math.round(num * 1024 * 1024 * 1024)
  }

  // Helper to convert expire field to needed schema
  function normalizeExpire(expire: Date | string | number | null | undefined): string | number | null | undefined {
    if (expire === undefined || expire === null || expire === '') return 0

    // For number values, return directly (already a timestamp)
    if (typeof expire === 'number') return expire

    // For Date objects, convert to Unix timestamp (seconds) in UTC
    if (expire instanceof Date) {
      return Math.floor(expire.getTime() / 1000)
    }

    // For strings
    if (typeof expire === 'string') {
      // Try as number first
      const asNum = Number(expire)
      if (!isNaN(asNum) && expire.trim() !== '') {
        return asNum // Return as number if it's a valid numeric string
      }

      // Try as date string - convert to UTC
      const asDate = new Date(expire + 'Z')
      if (!isNaN(asDate.getTime())) {
        return Math.floor(asDate.getTime() / 1000)
      }
    }

    // Return 0 for any other case
    return 0
  }

  // Helper to clear group selection
  const clearGroups = () => form.setValue('group_ids', [])
  // Helper to clear template selection
  const clearTemplate = () => setSelectedTemplateId(null)

  // Helper to check if a template is selected in next plan
  const nextPlanTemplateSelected = !!form.watch('next_plan.user_template_id')

  // Update validateAllFields function
  const validateAllFields = (currentValues: any, touchedFields: any) => {
    try {
      // Special case for template mode
      if (selectedTemplateId) {
        // In template mode, only validate username
        form.clearErrors()
        if (!currentValues.username || currentValues.username.length < 3) {
          form.setError('username', {
            type: 'manual',
            message: t('validation.required', { field: t('username', { defaultValue: 'Username' }) }),
          })
          return false
        }
        return true
      }

      // Only validate fields that have been touched
      const touchedValues = Object.keys(touchedFields).reduce((acc, key) => {
        if (touchedFields[key]) {
          acc[key] = currentValues[key]
        }
        return acc
      }, {} as any)

      // If no fields are touched, clear errors and return true
      if (Object.keys(touchedValues).length === 0) {
        form.clearErrors()
        return true
      }

      // Clear all previous errors before setting new ones
      form.clearErrors()

      // Select the appropriate schema based on template selection
      const schema = selectedTemplateId ? (editingUser ? templateModifySchema : templateUserSchema) : editingUser ? userEditSchema : userCreateSchema

      // Validate only touched fields using the selected schema
      schema.partial().parse(touchedValues)

      return true
    } catch (error: any) {
      // Handle validation errors from schema.partial().parse
      if (error?.errors) {
        // Clear all previous errors again just in case
        form.clearErrors()

        // Set new errors only for touched fields
        error.errors.forEach((err: any) => {
          const fieldName = err.path[0]
          if (fieldName && touchedFields[fieldName]) {
            let message = err.message
            if (fieldName === 'group_ids' && message.includes('Required')) {
              // Check for required message for groups
              message = t('validation.required', { field: t('groups', { defaultValue: 'Groups' }) })
            } else if (fieldName === 'username' && message.includes('too short')) {
              message = t('validation.required', { field: t('username', { defaultValue: 'Username' }) })
            }
            if (fieldName === 'group_ids') {
              message = t('validation.required', { field: t('groups', { defaultValue: 'Groups' }) })
            }
            form.setError(fieldName as any, {
              type: 'manual',
              message,
            })
          }
        })
      }
      return false
    }
  }

  // Update template selection handlers to use number type
  const handleTemplateSelect = React.useCallback((val: string) => {
    const currentValues = form.getValues()
    if (val === 'none' || (selectedTemplateId && String(selectedTemplateId) === val)) {
      setSelectedTemplateId(null)
      clearGroups()
    } else {
      setSelectedTemplateId(Number(val))
      clearGroups()
      // Clear group selection when template is selected
      form.setValue('group_ids', [])
      handleFieldChange('group_ids', [])
    }
    // Trigger validation after template selection changes
    const isValid = validateAllFields(currentValues, touchedFields)
    setIsFormValid(isValid)
  }, [form, selectedTemplateId, touchedFields, handleFieldChange])

  // Update the template mutation calls
  const handleTemplateMutation = React.useCallback(async (values: UseFormValues | UseEditFormValues) => {
    if (!selectedTemplateId) return

    setLoading(true)
    try {
      if (editingUser) {
        await modifyUserWithTemplateMutation.mutateAsync({
          username: values.username,
          data: {
            user_template_id: selectedTemplateId,
            note: values.note,
          },
        })
        toast.success(
          t('userDialog.userEdited', {
            username: values.username,
            defaultValue: 'User «{{name}}» has been updated successfully',
          }),
        )
      } else {
        await createUserFromTemplateMutation.mutateAsync({
          data: {
            user_template_id: selectedTemplateId,
            username: values.username,
            note: values.note || undefined,
          },
        })
        toast.success(
          t('userDialog.userCreated', {
            username: values.username,
            defaultValue: 'User «{{name}}» has been created successfully',
          }),
        )
      }
      onOpenChange(false)
      form.reset()
      setSelectedTemplateId(null)
    } catch (error: any) {
      toast.error(
        error?.response?._data?.detail ||
        t(editingUser ? 'users.editError' : 'users.createError', {
          name: values.username,
          defaultValue: `Failed to ${editingUser ? 'update' : 'create'} user «{{name}}»`,
        }),
      )
    } finally {
      setLoading(false)
    }
  }, [editingUser, selectedTemplateId, form, onOpenChange, t])

  const onSubmit = React.useCallback(async (values: UseFormValues | UseEditFormValues) => {
    try {
      form.clearErrors()

      // Handle template-based operations
      if (selectedTemplateId) {
        await handleTemplateMutation(values)
        return
      }

      // Regular create/edit flow
      if (!validateAllFields(values, touchedFields)) {
        return
      }

      // Convert data to the right format before validation
      const preparedValues = {
        ...values,
        data_limit: typeof values.data_limit === 'string' ? parseFloat(values.data_limit) : values.data_limit,
        on_hold_expire_duration: values.on_hold_expire_duration
          ? typeof values.on_hold_expire_duration === 'string'
            ? parseInt(values.on_hold_expire_duration, 10)
            : values.on_hold_expire_duration
          : undefined,
        expire: status === 'on_hold' ? undefined : normalizeExpire(values.expire),
        group_ids: Array.isArray(values.group_ids) ? values.group_ids : [],
        status: values.status,
      }

      // Remove next_plan.data_limit and next_plan.expire if next_plan.user_template_id is set
      if (preparedValues.next_plan && preparedValues.next_plan.user_template_id) {
        delete preparedValues.next_plan.data_limit
        delete preparedValues.next_plan.expire
      }

      // Check if proxy settings are filled
      const hasProxySettings = values.proxy_settings && Object.values(values.proxy_settings).some(settings => settings && Object.values(settings).some(value => value !== undefined && value !== ''))

      setLoading(true)
      // Convert data_limit from GB to bytes
      const sendValues = {
        ...preparedValues,
        data_limit: gbToBytes(preparedValues.data_limit as any),
        expire: normalizeExpire(preparedValues.expire),
        // Only include proxy_settings if they are filled
        ...(hasProxySettings ? { proxy_settings: values.proxy_settings } : {}),
      }

      // Remove proxy_settings from the payload if it's empty or undefined
      if (!hasProxySettings) {
        delete sendValues.proxy_settings
      }

      // Make API calls to the backend
      if (editingUser && editingUserId) {
        try {
          await modifyUserMutation.mutateAsync({
            username: sendValues.username,
            data: sendValues,
          })
          toast.success(
            t('userDialog.userEdited', {
              username: values.username,
              defaultValue: 'User «{{name}}» has been updated successfully',
            }),
          )
        } catch (error) {
          console.error('Modify user error:', error)
          throw error
        }
      } else {
        try {
          const createData = {
            ...sendValues,
            status: (sendValues.status === 'active' ? 'active' : sendValues.status) as 'active' | 'on_hold',
          }
          await createUserMutation.mutateAsync({
            data: createData,
          })
          toast.success(
            t('userDialog.userCreated', {
              username: values.username,
              defaultValue: 'User «{{name}}» has been created successfully',
            }),
          )
        } catch (error) {
          console.error('Create user error:', error)
          throw error
        }
      }

      onOpenChange(false)
      form.reset()
      setTouchedFields({})
    } catch (error: any) {
      const fields = ['username', 'data_limit', 'expire', 'note', 'data_limit_reset_strategy', 'on_hold_expire_duration', 'on_hold_timeout', 'group_ids']
      handleError({ error, fields, form, contextKey: "users" })
    } finally {
      setLoading(false)
    }
  }, [editingUser, editingUserId, form, handleTemplateMutation, onOpenChange, selectedTemplateId, status, t, touchedFields])

  function generateUsername() {
    // Example: random 8-char string
    return Math.random().toString(36).slice(2, 10)
  }

  // Add this function after the generateUsername function
  function generatePassword(length: number = 24): string {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const special = '_'
    let password = ''

    // Ensure at least one underscore
    password += special

    // Fill the rest with letters and numbers
    for (let i = 1; i < length; i++) {
      const charSet = Math.random() < 0.7 ? letters : numbers
      const randomIndex = Math.floor(Math.random() * charSet.length)
      password += charSet[randomIndex]
    }

    // Shuffle the password to make it more random
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('')
  }

  // Add this function after the generatePassword function
  function generateProxySettings() {
    return {
      vmess: {
        id: uuidv4(),
      },
      vless: {
        id: uuidv4(),
        flow: '' as '' | 'xtls-rprx-vision' | undefined,
      },
      trojan: {
        password: generatePassword(),
      },
      shadowsocks: {
        password: generatePassword(),
      },
    }
  }

  // Add this button component after the username generate button
  const GenerateProxySettingsButton = () => (
    <Button
      size="icon"
      type="button"
      variant="ghost"
      onClick={() => {
        const newSettings = generateProxySettings()
        form.setValue('proxy_settings', newSettings)
        handleFieldChange('proxy_settings', newSettings)
      }}
      title="Generate proxy settings"
    >
      <RefreshCcw className="w-3 h-3" />
    </Button>
  )

  useEffect(() => {
    // Log form state when dialog opens
    if (isDialogOpen) {
      // Initialize on_hold_expire_duration if status is on_hold
      if (status === 'on_hold' && editingUser) {
        const currentDuration = form.getValues('on_hold_expire_duration')
        if (currentDuration === undefined || currentDuration === null || Number(currentDuration) === 0) {
          // Only set default if there's no value at all
          form.setValue('on_hold_expire_duration', 0)
        }
      }
    }
  }, [isDialogOpen, form, editingUser, status])

  // Add new effect for initial validation on modal open
  useEffect(() => {
    if (isDialogOpen) {
      const currentValues = form.getValues()
      // For edit mode, only validate fields that have been changed
      const allFieldsTouched = editingUser
        ? {}
        : Object.keys(currentValues).reduce(
          (acc, key) => {
            acc[key] = true
            return acc
          },
          {} as Record<string, boolean>,
        )
      const isValid = validateAllFields(currentValues, allFieldsTouched)
      setIsFormValid(isValid)
      setTouchedFields(allFieldsTouched)
    }
  }, [isDialogOpen, form, editingUser])

  // State for UUID version per field
  const [uuidVersions, setUuidVersions] = useState({
    vmess: 'v4',
    vless: 'v4',
    trojan: 'v4',
    shadowsocks: 'v4',
  })

  // Helper to generate UUID by version
  function generateUUID(version: string, value: string = ''): string {
    switch (version) {
      case 'v4':
        return uuidv4()
      case 'v5':
        return uuidv5(value || 'default', UUID_NAMESPACE)
      case 'v7':
        return uuidv7()
      default:
        return uuidv4()
    }
  }

  // On first load (create user), auto-generate UUIDs for all fields
  useEffect(() => {
    if (isDialogOpen && !editingUser) {
      // Remove auto-fill of proxy settings
      form.setValue('proxy_settings', undefined)
    }
    // eslint-disable-next-line
  }, [isDialogOpen, editingUser])

  // Add effect to handle locale changes
  useEffect(() => {
    setUsePersianCalendar(i18n.language === 'fa')
  }, [i18n.language])

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleModalOpenChange}>
      <DialogContent className={`lg:min-w-[900px]  ${editingUser ? 'sm:h-auto h-full' : 'h-auto'}`}>
        <DialogHeader>
          <DialogTitle className={`${dir === 'rtl' ? 'text-right' : ''}`}>
            {editingUser ? t('userDialog.editUser', { defaultValue: 'Edit User' }) : t('createUser', { defaultValue: 'Create User' })}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="max-h-[80dvh] overflow-y-auto pr-4 -mr-4 sm:max-h-[75dvh] px-2">
              <div className="flex flex-col gap-6 lg:flex-row items-center lg:items-start justify-between w-full lg:pb-8">
                <div className="space-y-6 flex-[2] w-full">
                  <div className="flex items-center justify-center w-full gap-4">
                    {/* Hide these fields if a template is selected */}
                    {!selectedTemplateId && (
                      <div className={'flex w-full gap-4'}>
                        <FormField
                          control={form.control}
                          name="username"
                          render={({ field }) => {
                            const hasError = !!form.formState.errors.username
                            return (
                              <FormItem className="flex-1">
                                <FormLabel>{t('username', { defaultValue: 'Username' })}</FormLabel>
                                <FormControl>
                                  <div className="flex gap-2 items-center">
                                    <div className="w-full">
                                      <Input
                                        placeholder={t('admins.enterUsername', { defaultValue: 'Enter username' })}
                                        {...field}
                                        value={field.value ?? ''}
                                        disabled={editingUser}
                                        isError={hasError}
                                        onChange={e => {
                                          field.onChange(e)
                                          handleFieldChange('username', e.target.value)
                                        }}
                                        onBlur={() => handleFieldBlur('username')}
                                      />
                                    </div>
                                    {!editingUser && (
                                      <Button
                                        size="icon"
                                        type="button"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          const newUsername = generateUsername()
                                          field.onChange(newUsername)
                                          handleFieldChange('username', newUsername)
                                        }}
                                        title="Generate username"
                                      >
                                        <RefreshCcw className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )
                          }}
                        />
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem className="w-1/3">
                              <FormLabel>{t('status', { defaultValue: 'Status' })}</FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={value => {
                                    field.onChange(value)
                                    handleFieldChange('status', value)
                                    handleFieldBlur('status')
                                  }}
                                  value={field.value || ''}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('users.selectStatus', { defaultValue: 'Select status' })} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">{t('status.active', { defaultValue: 'Active' })}</SelectItem>
                                    {editingUser && <SelectItem value="disabled">{t('status.disabled', { defaultValue: 'Disabled' })}</SelectItem>}
                                    <SelectItem value="on_hold">{t('status.on_hold', { defaultValue: 'On Hold' })}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                    {/* If template is selected, only show username field */}
                    {selectedTemplateId && (
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => {
                          const hasError = !!form.formState.errors.username
                          return (
                            <FormItem className="flex-1 w-full">
                              <FormLabel>{t('username', { defaultValue: 'Username' })}</FormLabel>
                              <FormControl>
                                <div className="flex flex-row justify-between gap-4 w-full items-center">
                                  <div className="w-full">
                                    <Input
                                      placeholder={t('admins.enterUsername', { defaultValue: 'Enter username' })}
                                      {...field}
                                      value={field.value ?? ''}
                                      disabled={editingUser}
                                      isError={hasError}
                                      onChange={e => {
                                        field.onChange(e)
                                        handleFieldChange('username', e.target.value)
                                      }}
                                      onBlur={() => handleFieldBlur('username')}
                                    />
                                  </div>
                                  {!editingUser && (
                                    <Button
                                      size="icon"
                                      type="button"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        const newUsername = generateUsername()
                                        field.onChange(newUsername)
                                        handleFieldChange('username', newUsername)
                                      }}
                                      title="Generate username"
                                    >
                                      <RefreshCcw className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )
                        }}
                      />
                    )}
                  </div>
                  {/* Hide data_limit and expire if template is selected */}
                  {!selectedTemplateId && (
                    <div className="flex flex-col w-full gap-4 lg:flex-row lg:items-start">
                      <FormField
                        control={form.control}
                        name="data_limit"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>{t('userDialog.dataLimit', { defaultValue: 'Data Limit (GB)' })}</FormLabel>
                            <FormControl>
                              <div className="relative w-full">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder={t('userDialog.dataLimit', { defaultValue: 'e.g. 1' })}
                                  onChange={e => {
                                    const value = e.target.value
                                    // Allow empty string
                                    if (value === '') {
                                      field.onChange(undefined)
                                      handleFieldChange('data_limit', undefined)
                                      return
                                    }
                                    // Allow only numbers and decimal point
                                    if (/^\d*\.?\d*$/.test(value)) {
                                      const numValue = parseFloat(value)
                                      if (!isNaN(numValue)) {
                                        field.onChange(numValue)
                                        handleFieldChange('data_limit', numValue)
                                      }
                                    }
                                  }}
                                  onKeyDown={e => {
                                    const currentValue = field.value === undefined ? 0 : field.value
                                    if (e.key === 'ArrowUp') {
                                      e.preventDefault()
                                      const newValue = currentValue + 1
                                      field.onChange(newValue)
                                      handleFieldChange('data_limit', newValue)
                                    } else if (e.key === 'ArrowDown') {
                                      e.preventDefault()
                                      const newValue = Math.max(0, currentValue - 1)
                                      field.onChange(newValue)
                                      handleFieldChange('data_limit', newValue)
                                    }
                                  }}
                                  onBlur={() => {
                                    handleFieldChange('data_limit', field.value)
                                  }}
                                  value={field.value === undefined ? '' : field.value}
                                  className="pr-20"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                  <div className="flex flex-col border-l border-input">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 rounded-none border-b border-input hover:bg-accent hover:text-accent-foreground"
                                      onClick={() => {
                                        const currentValue = field.value === undefined ? 0 : field.value
                                        const newValue = currentValue + 1
                                        field.onChange(newValue)
                                        handleFieldChange('data_limit', newValue)
                                      }}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-3 w-3"
                                      >
                                        <path d="m5 15 7-7 7 7" />
                                      </svg>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 rounded-none hover:bg-accent hover:text-accent-foreground"
                                      onClick={() => {
                                        const currentValue = field.value === undefined ? 0 : field.value
                                        const newValue = Math.max(0, currentValue - 1)
                                        field.onChange(newValue)
                                        handleFieldChange('data_limit', newValue)
                                      }}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-3 w-3"
                                      >
                                        <path d="m19 9-7 7-7-7" />
                                      </svg>
                                    </Button>
                                  </div>
                                  <span className="text-muted-foreground pointer-events-none ml-1">GB</span>
                                </div>
                              </div>
                            </FormControl>
                            {field.value !== null && field.value !== undefined && field.value > 0 && field.value < 1 && (
                              <p className="text-xs text-muted-foreground mt-1">{formatBytes(Math.round(field.value * 1024 * 1024 * 1024))}</p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {form.watch('data_limit') !== undefined && form.watch('data_limit') !== null && Number(form.watch('data_limit')) > 0 && (
                        <FormField
                          control={form.control}
                          name="data_limit_reset_strategy"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>{t('userDialog.periodicUsageReset', { defaultValue: 'Periodic Usage Reset' })}</FormLabel>
                              <Select
                                onValueChange={value => {
                                  field.onChange(value)
                                  handleFieldChange('data_limit_reset_strategy', value)
                                }}
                                value={field.value || ''}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('userDialog.resetStrategyNo', { defaultValue: 'No' })} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="no_reset">{t('userDialog.resetStrategyNo', { defaultValue: 'No' })}</SelectItem>
                                  <SelectItem value="day">{t('userDialog.resetStrategyDaily', { defaultValue: 'Daily' })}</SelectItem>
                                  <SelectItem value="week">{t('userDialog.resetStrategyWeekly', { defaultValue: 'Weekly' })}</SelectItem>
                                  <SelectItem value="month">{t('userDialog.resetStrategyMonthly', { defaultValue: 'Monthly' })}</SelectItem>
                                  <SelectItem value="year">{t('userDialog.resetStrategyAnnually', { defaultValue: 'Annually' })}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <div className="flex items-start lg:w-52 gap-4">
                        {status === 'on_hold' ? (
                          <FormField
                            control={form.control}
                            name="on_hold_expire_duration"
                            render={({ field }) => {
                              const hasError = !!form.formState.errors.on_hold_expire_duration
                              return (
                                <FormItem className="flex-1">
                                  <FormLabel>{t('userDialog.onHoldExpireDuration', { defaultValue: 'On Hold Expire Duration (days)' })}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      isError={hasError}
                                      placeholder={t('userDialog.onHoldExpireDurationPlaceholder', { defaultValue: 'e.g. 7' })}
                                      {...field}
                                      value={field.value === null || field.value === undefined ? '' : Math.round(field.value / (24 * 60 * 60))}
                                      onChange={e => {
                                        const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                                        field.onChange(value ? value * (24 * 60 * 60) : 1)
                                        handleFieldChange('on_hold_expire_duration', value)
                                      }}
                                      onBlur={() => handleFieldBlur('on_hold_expire_duration')}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )
                            }}
                          />
                        ) : (
                          <FormField
                            control={form.control}
                            name="expire"
                            render={({ field }) => (
                              <ExpiryDateField
                                field={field}
                                displayDate={displayDate}
                                usePersianCalendar={usePersianCalendar}
                                calendarOpen={calendarOpen}
                                setCalendarOpen={setCalendarOpen}
                                handleFieldChange={handleFieldChange}
                              />
                            )}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userDialog.note', { defaultValue: 'Note' })}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('userDialog.note', { defaultValue: 'Optional note' }) + '...'}
                            {...field}
                            rows={3}
                            onChange={e => {
                              field.onChange(e)
                              handleFieldChange('note', e.target.value)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Proxy Settings Accordion */}
                  <Accordion type="single" collapsible className="w-full my-4">
                    <AccordionItem className="border px-4 rounded-sm [&_[data-state=open]]:no-underline [&_[data-state=closed]]:no-underline" value="proxySettings">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          <span>{t('userDialog.proxySettingsAccordion')}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-muted-foreground text-xs">{t('userDialog.proxySettings.desc')}</div>
                          <GenerateProxySettingsButton />
                        </div>
                        {/* VMess */}
                        <FormField
                          control={form.control}
                          name="proxy_settings.vmess.id"
                          render={({ field, formState }) => {
                            const error = formState.errors.proxy_settings?.vmess?.id
                            return (
                              <FormItem className="mb-2">
                                <FormLabel>
                                  {t('userDialog.proxySettings.vmess')} {t('userDialog.proxySettings.id')}
                                </FormLabel>
                                <FormControl>
                                  <div dir="ltr" className="flex gap-2 items-center">
                                    <Input
                                      {...field}
                                      placeholder={t('userDialog.proxySettings.id')}
                                      onChange={e => {
                                        field.onChange(e)
                                        form.trigger('proxy_settings.vmess.id')
                                        handleFieldChange('proxy_settings.vmess.id', e.target.value)
                                      }}
                                    />
                                    <Select value={uuidVersions.vmess} onValueChange={val => setUuidVersions(v => ({ ...v, vmess: val }))}>
                                      <SelectTrigger className="w-[60px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="v4">v4</SelectItem>
                                        <SelectItem value="v5">v5</SelectItem>
                                        <SelectItem value="v7">v7</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="icon"
                                      type="button"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        const newVal = generateUUID(uuidVersions.vmess, field.value)
                                        field.onChange(newVal)
                                        form.trigger('proxy_settings.vmess.id')
                                        handleFieldChange('proxy_settings.vmess.id', newVal)
                                      }}
                                      title="Generate UUID"
                                    >
                                      <RefreshCcw className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage>{error?.message === 'Invalid uuid' && t('validation.invalidUuid', { defaultValue: 'Invalid UUID format' })}</FormMessage>
                              </FormItem>
                            )
                          }}
                        />
                        {/* VLESS */}
                        <FormField
                          control={form.control}
                          name="proxy_settings.vless.id"
                          render={({ field, formState }) => {
                            const error = formState.errors.proxy_settings?.vless?.id
                            return (
                              <FormItem className="mb-2">
                                <FormLabel>
                                  {t('userDialog.proxySettings.vless')} {t('userDialog.proxySettings.id')}
                                </FormLabel>
                                <FormControl>
                                  <div dir="ltr" className="flex gap-2 items-center">
                                    <Input
                                      {...field}
                                      placeholder={t('userDialog.proxySettings.id')}
                                      onChange={e => {
                                        field.onChange(e)
                                        form.trigger('proxy_settings.vless.id')
                                        handleFieldChange('proxy_settings.vless.id', e.target.value)
                                      }}
                                    />
                                    <Select value={uuidVersions.vless} onValueChange={val => setUuidVersions(v => ({ ...v, vless: val }))}>
                                      <SelectTrigger className="w-[60px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="v4">v4</SelectItem>
                                        <SelectItem value="v5">v5</SelectItem>
                                        <SelectItem value="v7">v7</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="icon"
                                      type="button"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        const newVal = generateUUID(uuidVersions.vless, field.value)
                                        field.onChange(newVal)
                                        form.trigger('proxy_settings.vless.id')
                                        handleFieldChange('proxy_settings.vless.id', newVal)
                                      }}
                                      title="Generate UUID"
                                    >
                                      <RefreshCcw className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage>{error?.message === 'Invalid uuid' && t('validation.invalidUuid', { defaultValue: 'Invalid UUID format' })}</FormMessage>
                              </FormItem>
                            )
                          }}
                        />
                        <FormField
                          control={form.control}
                          name="proxy_settings.vless.flow"
                          render={({ field }) => (
                            <FormItem className="mb-2">
                              <FormLabel>
                                {t('userDialog.proxySettings.vless')} {t('userDialog.proxySettings.flow')}
                              </FormLabel>
                              <FormControl>
                                <Select
                                  value={field.value ?? ''}
                                  onValueChange={val => {
                                    field.onChange(val === 'none' ? undefined : val)
                                    handleFieldChange('proxy_settings.vless.flow', val === 'none' ? undefined : val)
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('userDialog.proxySettings.flow')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">{t('userDialog.proxySettings.flow.none', { defaultValue: 'None' })}</SelectItem>
                                    <SelectItem value="xtls-rprx-vision">xtls-rprx-vision</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {/* Trojan */}
                        <FormField
                          control={form.control}
                          name="proxy_settings.trojan.password"
                          render={({ field }) => (
                            <FormItem className="mb-2">
                              <FormLabel>
                                {t('userDialog.proxySettings.trojan')} {t('userDialog.proxySettings.password')}
                              </FormLabel>
                              <FormControl>
                                <div dir="ltr" className="flex gap-2 items-center">
                                  <Input
                                    {...field}
                                    placeholder={t('userDialog.proxySettings.password')}
                                    onChange={e => {
                                      field.onChange(e)
                                      form.trigger('proxy_settings.trojan.password')
                                      handleFieldChange('proxy_settings.trojan.password', e.target.value)
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const newVal = generatePassword()
                                      field.onChange(newVal)
                                      form.trigger('proxy_settings.trojan.password')
                                      handleFieldChange('proxy_settings.trojan.password', newVal)
                                    }}
                                    title="Generate password"
                                  >
                                    <RefreshCcw className="w-3 h-3" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {/* Shadowsocks */}
                        <FormField
                          control={form.control}
                          name="proxy_settings.shadowsocks.password"
                          render={({ field }) => (
                            <FormItem className="mb-2 w-full">
                              <FormLabel>
                                {t('userDialog.proxySettings.shadowsocks')} {t('userDialog.proxySettings.password')}
                              </FormLabel>
                              <FormControl>
                                <div dir="ltr" className="flex gap-2 items-center">
                                  <Input
                                    {...field}
                                    placeholder={t('userDialog.proxySettings.password')}
                                    onChange={e => {
                                      field.onChange(e)
                                      form.trigger('proxy_settings.shadowsocks.password')
                                      handleFieldChange('proxy_settings.shadowsocks.password', e.target.value)
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const newVal = generatePassword()
                                      field.onChange(newVal)
                                      form.trigger('proxy_settings.shadowsocks.password')
                                      handleFieldChange('proxy_settings.shadowsocks.password', newVal)
                                    }}
                                    title="Generate password"
                                  >
                                    <RefreshCcw className="w-3 h-3" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="proxy_settings.shadowsocks.method"
                          render={({ field }) => (
                            <FormItem className="mb-2">
                              <FormLabel>
                                {t('userDialog.proxySettings.shadowsocks')} {t('userDialog.proxySettings.method')}
                              </FormLabel>
                              <FormControl>
                                <Select
                                  value={field.value ?? ''}
                                  onValueChange={val => {
                                    field.onChange(val)
                                    handleFieldChange('proxy_settings.shadowsocks.method', val)
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('userDialog.proxySettings.method')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="aes-128-gcm">aes-128-gcm</SelectItem>
                                    <SelectItem value="aes-256-gcm">aes-256-gcm</SelectItem>
                                    <SelectItem value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</SelectItem>
                                    <SelectItem value="xchacha20-poly1305">xchacha20-poly1305</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  {/* Next Plan Section (toggleable) */}
                  {editingUser && (
                    <div className="border border-border rounded-[--radius] p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ListStart className="w-4 h-4" />
                          <div>{t('userDialog.nextPlanTitle', { defaultValue: 'Next Plan' })}</div>
                        </div>
                        <Switch checked={nextPlanEnabled} onCheckedChange={setNextPlanEnabled} />
                      </div>
                      {nextPlanEnabled && (
                        <div className="flex flex-col gap-4 py-4">
                          <FormField
                            control={form.control}
                            name="next_plan.user_template_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('userDialog.nextPlanTemplateId', { defaultValue: 'Template ID' })}</FormLabel>
                                <FormControl>
                                  <Select
                                    value={field.value ? String(field.value) : 'none'}
                                    onValueChange={val => {
                                      if (val === 'none' || (field.value && String(field.value) === val)) {
                                        field.onChange(undefined)
                                      } else {
                                        field.onChange(Number(val))
                                      }
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={t('userDialog.selectTemplatePlaceholder', { defaultValue: 'Choose a template' })} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">---</SelectItem>
                                      {(templatesData || []).map((tpl: any) => (
                                        <SelectItem key={tpl.id} value={String(tpl.id)}>
                                          {tpl.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {/* Only show expire and data_limit if no template is selected */}
                          {!nextPlanTemplateSelected && (
                            <div className="flex gap-4">
                              <FormField
                                control={form.control}
                                name="next_plan.expire"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('userDialog.nextPlanExpire', { defaultValue: 'Expire' })}</FormLabel>
                                    <FormControl>
                                      <Input type="number" min="0" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <span className="text-xs text-muted-foreground">{t('userDialog.days', { defaultValue: 'Days' })}</span>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="next_plan.data_limit"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('userDialog.nextPlanDataLimit', { defaultValue: 'Data Limit' })}</FormLabel>
                                    <FormControl>
                                      <Input type="number" min="0" step="any" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <span className="text-xs text-muted-foreground">GB</span>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                          <div className="flex gap-8">
                            <FormField
                              control={form.control}
                              name="next_plan.add_remaining_traffic"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center gap-2">
                                  <FormLabel>{t('userDialog.nextPlanAddRemainingTraffic', { defaultValue: 'Add Remaining Traffic' })}</FormLabel>
                                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-6 w-full h-full flex-1">
                  <div className="w-full">
                    <div className="flex border-b items-center">
                      {tabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as typeof activeTab)}
                          className={`relative flex-1 px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          type="button"
                        >
                          <div className="flex items-center gap-1.5 justify-center">
                            <tab.icon className="h-4 w-4" />
                            <span>{t(tab.label)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="py-2">
                      {activeTab === 'templates' &&
                        (templatesLoading ? (
                          <div>{t('Loading...', { defaultValue: 'Loading...' })}</div>
                        ) : (
                          <div className="space-y-4 pt-4">
                            <FormLabel>{t('userDialog.selectTemplate', { defaultValue: 'Select Template' })}</FormLabel>
                            <Select
                              value={selectedTemplateId ? String(selectedTemplateId) : 'none'}
                              onValueChange={handleTemplateSelect}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('userDialog.selectTemplatePlaceholder', { defaultValue: 'Choose a template' })} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">---</SelectItem>
                                {(templatesData || []).map((template: any) => (
                                  <SelectItem key={template.id} value={String(template.id)}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedTemplateId && (
                              <div className="text-sm text-muted-foreground">
                                {t('users.selectedTemplates', {
                                  count: 1,
                                  defaultValue: '1 template selected',
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      {activeTab === 'groups' &&
                        (groupsLoading ? (
                          <div>{t('Loading...', { defaultValue: 'Loading...' })}</div>
                        ) : (
                          <FormField
                            control={form.control}
                            name="group_ids"
                            render={({ field }) => {
                              const [searchQuery, setSearchQuery] = useState('')
                              const selectedGroups = field.value || []
                              const filteredGroups = (groupsData?.groups || []).filter((group: any) => group.name.toLowerCase().includes(searchQuery.toLowerCase()))

                              const handleSelectAll = (checked: boolean) => {
                                const newGroups = checked ? filteredGroups.map((group: any) => group.id) : []

                                field.onChange(newGroups)
                                handleFieldChange('group_ids', newGroups)

                                // Clear template selection when groups are selected
                                if (checked && selectedTemplateId) {
                                  setSelectedTemplateId(null)
                                  clearTemplate()
                                }

                                // Trigger validation after group selection changes
                                const isValid = validateAllFields({ ...form.getValues(), group_ids: newGroups }, touchedFields)
                                setIsFormValid(isValid)
                              }

                              const handleGroupChange = (checked: boolean, groupId: number) => {
                                const newGroups = checked ? [...selectedGroups, groupId] : selectedGroups.filter(id => id !== groupId)

                                field.onChange(newGroups)
                                handleFieldChange('group_ids', newGroups)

                                // Clear template selection when groups are selected
                                if (checked && selectedTemplateId) {
                                  setSelectedTemplateId(null)
                                  clearTemplate()
                                }

                                // Trigger validation after group selection changes
                                const isValid = validateAllFields({ ...form.getValues(), group_ids: newGroups }, touchedFields)
                                setIsFormValid(isValid)
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
                                      <Checkbox
                                        checked={filteredGroups.length > 0 && selectedGroups.length === filteredGroups.length}
                                        onCheckedChange={handleSelectAll}
                                      />
                                      <span className="text-sm font-medium">{t('selectAll', { defaultValue: 'Select All' })}</span>
                                    </label>
                                    <div className="max-h-[200px] overflow-y-auto space-y-2 p-2 border rounded-md">
                                      {filteredGroups.length === 0 ? (
                                        <div className="flex flex-col gap-4 w-full border-yellow-500 border p-4 rounded-md">
                                          <span className="text-sm font-bold text-yellow-500">{t('warning')}</span>
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
                                            />
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
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Cancel/Create buttons - always visible */}
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onOpenChange(false)
              }}>
                {t('cancel', { defaultValue: 'Cancel' })}
              </Button>
              <LoaderButton
                type="submit"
                isLoading={loading}
                disabled={(!isFormValid && !selectedTemplateId) || (!selectedTemplateId && groupsData?.groups?.length === 0)}
                loadingText={editingUser ? t('modifying') : t('creating')}
              >
                {editingUser ? t('modify', { defaultValue: 'Modify' }) : t('create', { defaultValue: 'Create' })}
              </LoaderButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
