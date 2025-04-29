import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { UseFormReturn } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import type { UseFormValues } from '@/pages/_dashboard._index';
import { RefreshCcw } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { relativeExpiryDate } from '@/utils/dateFormatter';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useGetInbounds, useGetUserTemplates, useGetAllGroups } from '@/service/api';
import { Network, Layers, Users } from 'lucide-react';

interface UserModalProps {
  isDialogOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<UseFormValues>;
  editingUser: boolean;
  editingUserId?: number;
}

const isDate = (v: unknown): v is Date =>
  typeof v === 'object' && v !== null && v instanceof Date;

export default function UserModal({ isDialogOpen, onOpenChange, form, editingUser, editingUserId }: UserModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const status = form.watch('status');
  const [activeTab, setActiveTab] = useState<'templates' | 'groups'>('templates');
  const tabs = [
    { id: 'templates', label: 'Templates', icon: Layers },
    { id: 'groups', label: 'Groups', icon: Users },
  ];

  useEffect(() => {
    if (status === 'on_hold') {
      form.setValue('expire', undefined);
    } else {
      form.setValue('on_hold_expire_duration', undefined);
    }
  }, [status, form]);

  // Helper to convert GB to bytes
  function gbToBytes(gb: string | number | undefined): number | undefined {
    if (gb === undefined || gb === null || gb === '') return undefined;
    const num = typeof gb === 'string' ? parseFloat(gb) : gb;
    if (isNaN(num)) return undefined;
    return Math.round(num * 1024 * 1024 * 1024);
  }

  // Helper to convert expire field to needed schema
  function normalizeExpire(expire: Date | string | number | null | undefined): string | number | null | undefined {
    if (expire === undefined || expire === null || expire === '') return undefined;
    if (typeof expire === 'number') return expire;
    if (expire instanceof Date) return expire.toISOString();
    if (typeof expire === 'string') {
      const asNum = Number(expire);
      if (!isNaN(asNum) && expire.trim() !== '') return asNum;
      const asDate = new Date(expire);
      if (!isNaN(asDate.getTime())) return asDate.toISOString();
      return expire;
    }
    return expire;
  }

  const onSubmit = async (values: UseFormValues) => {
    setLoading(true);
    try {
      // Convert data_limit from GB to bytes and normalize expire
      const sendValues = {
        ...values,
        data_limit: gbToBytes(values.data_limit as any),
        expire: normalizeExpire(values.expire),
      };
      if (editingUser && editingUserId) {
        toast({
          title: t('success', { defaultValue: 'Success' }),
          description: t('users.editSuccess', { name: values.username, defaultValue: 'User «{{name}}» has been updated successfully' })
        });
      } else {
        toast({
          title: t('success', { defaultValue: 'Success' }),
          description: t('users.createSuccess', { name: values.username, defaultValue: 'User «{{name}}» has been created successfully' })
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: t('error', { defaultValue: 'Error' }),
        description: t(editingUser ? 'users.editFailed' : 'users.createFailed', {
          name: values.username,
          error: error?.message || '',
          defaultValue: `Failed to ${editingUser ? 'update' : 'create'} user «{{name}}». {{error}}`
        }),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  function generateUsername() {
    // Example: random 8-char string
    return Math.random().toString(36).slice(2, 10);
  }

  // Fetch data for tabs
  const { data: templatesData, isLoading: templatesLoading } = useGetUserTemplates();
  const { data: groupsData, isLoading: groupsLoading } = useGetAllGroups();

  return (
    <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingUser ? t('users.editUser', { defaultValue: 'Edit User' }) : t('users.createUser', { defaultValue: 'Create User' })}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className='flex items-center justify-center w-full gap-4'>
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className='flex-1'>
                    <FormLabel>{t('users.username', { defaultValue: 'Username' })}</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('users.enterUsername', { defaultValue: 'Enter username' })}
                          {...field}
                          value={field.value ?? ''}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => field.onChange(generateUsername())}
                          title="Generate username"
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className='flex-1'>
                    <FormLabel>{t('users.status', { defaultValue: 'Status' })}</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('users.selectStatus', { defaultValue: 'Select status' })} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t('users.status.active', { defaultValue: 'Active' })}</SelectItem>
                          <SelectItem value="disabled">{t('users.status.disabled', { defaultValue: 'Disabled' })}</SelectItem>
                          <SelectItem value="on_hold">{t('users.status.on_hold', { defaultValue: 'On Hold' })}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className='flex items-start w-full gap-4'>
              <FormField
                control={form.control}
                name="data_limit"
                render={({ field }) => (
                  <FormItem className='flex-1'>
                    <FormLabel>{t('users.dataLimit', { defaultValue: 'Data Limit (GB)' })}</FormLabel>
                    <FormControl>
                      <div className="relative w-full">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder={t('users.dataLimitPlaceholder', { defaultValue: 'e.g. 1' })}
                          {...field}
                          value={field.value === null || field.value === undefined ? '' : field.value}
                          className="pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">GB</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {status === 'on_hold' ? (
                <FormField
                  control={form.control}
                  name="on_hold_expire_duration"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('users.onHoldExpireDuration', { defaultValue: 'On Hold Expire Duration (days)' })}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder={t('users.onHoldExpireDurationPlaceholder', { defaultValue: 'e.g. 7' })}
                          {...field}
                          value={field.value === null || field.value === undefined ? '' : field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="expire"
                  render={({ field }) => {
                    let expireUnix: number | null = null;
                    if (isDate(field.value)) {
                      expireUnix = Math.floor(field.value.getTime() / 1000);
                    } else if (typeof field.value === 'string' || typeof field.value === 'number') {
                      const date = new Date(field.value);
                      if (!isNaN(date.getTime())) {
                        expireUnix = Math.floor(date.getTime() / 1000);
                      } else if (!isNaN(Number(field.value))) {
                        expireUnix = Math.floor(Date.now() / 1000) + Number(field.value);
                      }
                    }
                    const expireInfo = expireUnix ? relativeExpiryDate(expireUnix) : null;
                    return (
                      <FormItem className="flex flex-col flex-1">
                        <FormLabel>{t('users.expire', { defaultValue: 'Expire date' })}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full h-fit !mt-3.5 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                type="button"
                              >
                                {field.value
                                  ? isDate(field.value)
                                    ? format(field.value, "yyyy/MM/dd")
                                    : !isNaN(Number(field.value))
                                      ? field.value
                                      : format(new Date(field.value), "yyyy/MM/dd")
                                  : <span>{t('users.expirePlaceholder', { defaultValue: 'Pick a date' })}</span>
                                }
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={isDate(field.value) ? field.value : undefined}
                              onSelect={date => field.onChange(date)}
                              fromDate={new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        {expireInfo?.time && (
                          <p className="text-xs text-muted-foreground mt-1">{expireInfo.time} later</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              )}
            </div>
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.note', { defaultValue: 'Note' })}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('users.notePlaceholder', { defaultValue: 'Optional note' })}
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="w-full">
              <div className="flex border-b px-4">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    type="button"
                  >
                    <div className="flex items-center gap-1.5">
                      <tab.icon className="h-4 w-4" />
                      <span>{t(tab.label, { defaultValue: tab.label })}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="px-4 py-2">
                {activeTab === 'templates' && (
                  templatesLoading ? <div>{t('Loading...', { defaultValue: 'Loading...' })}</div> :
                    <ul className="list-disc pl-5">
                      {(templatesData || []).map((template: any) => (
                        <li key={template.id}>{template.name}</li>
                      ))}
                    </ul>
                )}
                {activeTab === 'groups' && (
                  groupsLoading ? <div>{t('Loading...', { defaultValue: 'Loading...' })}</div> :
                    <ul className="list-disc pl-5">
                      {(groupsData?.groups || []).map((group: any) => (
                        <li key={group.id}>{group.name}</li>
                      ))}
                    </ul>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button type="submit" disabled={loading}>
                {editingUser ? t('save', { defaultValue: 'Save' }) : t('create', { defaultValue: 'Create' })}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
