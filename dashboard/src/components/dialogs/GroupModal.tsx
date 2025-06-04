import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { UseFormReturn } from 'react-hook-form'
import { useCreateGroup, useModifyGroup, useGetInbounds } from '@/service/api'
import { toast } from 'sonner'
import { z } from 'zod'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { queryClient } from '@/utils/query-client'
import useDirDetection from '@/hooks/use-dir-detection'
import { isEmptyObject } from '@/utils/isEmptyObject'
export const groupFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  inbound_tags: z.array(z.string()),
  is_disabled: z.boolean().optional(),
})

export type GroupFormValues = z.infer<typeof groupFormSchema>

interface GroupModalProps {
  isDialogOpen: boolean
  onOpenChange: (open: boolean) => void
  form: UseFormReturn<GroupFormValues>
  editingGroup: boolean
  editingGroupId?: number
}

export default function GroupModal({ isDialogOpen, onOpenChange, form, editingGroup, editingGroupId }: GroupModalProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const addGroupMutation = useCreateGroup()
  const modifyGroupMutation = useModifyGroup()
  const { data: inbounds } = useGetInbounds()

  const onSubmit = async (values: GroupFormValues) => {
    try {
      if (editingGroup && editingGroupId) {
        await modifyGroupMutation.mutateAsync({
          groupId: editingGroupId,
          data: values,
        })
        toast.success(
            t('group.editSuccess', {
              name: values.name,
            }),
        )
      } else {
        await addGroupMutation.mutateAsync({
          data: values,
        })
        toast.success(
            t('group.createSuccess', {
              name: values.name,
            }),
        )
      }
      // Invalidate groups queries after successful action
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] })
      onOpenChange(false)
      form.reset()
    } catch (error: any) {
      console.error('Group operation failed:', error)
      console.error('Error response:', error?.response)
      console.log('Error data:', error?.response?._data?.detail)

      // Reset all previous errors first
      form.clearErrors()

      // Handle validation errors
      if (error?.response?._data && !isEmptyObject(error?.response?._data)) {
        // For zod validation errors
        const fields = ['name', 'inbound_tags']

        // Show first error in a toast
        if (error?.response?._data?.detail) {
          const detail = error?.response?._data?.detail

          // If detail is an object with field errors (e.g., { status: "some error" })
          if (typeof detail === 'object' && detail !== null && !Array.isArray(detail)) {
            // Set errors for all fields in the object
            const firstField = Object.keys(detail)[0]
            const firstMessage = detail[firstField]

            Object.entries(detail).forEach(([field, message]) => {
              if (fields.includes(field)) {
                form.setError(field as any, {
                  type: 'manual',
                  message:
                      typeof message === 'string'
                          ? message
                          : t('validation.invalid', {
                            field: t(`groupDialog.${field}`, { defaultValue: field }),
                            defaultValue: `${field} is invalid`,
                          }),
                })
              }
            })

            toast.error(
                firstMessage ||
                t('validation.invalid', {
                  field: t(`groupDialog.${firstField}`, { defaultValue: firstField }),
                  defaultValue: `${firstField} is invalid`,
                }),
            )
          }
          else if (typeof detail === 'string' && !Array.isArray(detail)) {
            toast.error(detail)
          }
        }
      } else if (error?.response?.data) {
        // Handle API errors
        const apiError = error.response?.data
        let errorMessage = ''

        if (typeof apiError === 'string') {
          errorMessage = apiError
        } else if (apiError?.detail) {
          if (Array.isArray(apiError.detail)) {
            // Handle array of field errors
            apiError.detail.forEach((err: any) => {
              if (err.loc && err.loc[1]) {
                const fieldName = err.loc[1]
                form.setError(fieldName as any, {
                  type: 'manual',
                  message: err.msg,
                })
              }
            })
            errorMessage = apiError.detail[0]?.msg || 'Validation error'
          } else if (typeof apiError.detail === 'string') {
            errorMessage = apiError.detail
          } else {
            errorMessage = 'Validation error'
          }
        } else if (apiError?.message) {
          errorMessage = apiError.message
        } else {
          errorMessage = 'An unexpected error occurred'
        }

        toast.error(errorMessage)
      } else {
        // Generic error handling
        toast.error(error?.message || t('groups.genericError', { defaultValue: 'An error occurred' }))
      }
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className={cn(dir === 'rtl' && 'text-right')}>{editingGroup ? t('editGroup', { defaultValue: 'Edit Group' }) : t('createGroup')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input isError={!!form.formState.errors.name} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="inbound_tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('inboundTags')}</FormLabel>
                  <div className="space-y-2">
                    <Command className="border rounded-md">
                      <CommandInput placeholder={t('searchInbounds')} />
                      <CommandEmpty>{t('noInboundsFound')}</CommandEmpty>
                      <CommandGroup className="max-h-40 overflow-auto">
                        {inbounds?.map(inbound => (
                          <CommandItem
                            key={inbound}
                            onSelect={() => {
                              const currentTags = field.value || []
                              const newTags = currentTags.includes(inbound) ? currentTags.filter(tag => tag !== inbound) : [...currentTags, inbound]
                              field.onChange(newTags)
                            }}
                          >
                            <div className={cn('mr-2 h-4 w-4 border rounded-sm', field.value?.includes(inbound) ? 'bg-primary border-primary' : 'border-muted')} />
                            {inbound}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                    <div className="flex flex-wrap gap-2">
                      {field.value?.map(tag => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => {
                              field.onChange(field.value?.filter(t => t !== tag))
                            }}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={addGroupMutation.isPending || modifyGroupMutation.isPending} className="bg-primary hover:bg-primary/90">
                {editingGroup ? t('edit') : t('create')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
