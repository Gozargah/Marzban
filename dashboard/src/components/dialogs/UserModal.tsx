import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { UseFormReturn } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { UseFormValues, userCreateSchema, nextPlanModelSchema } from '@/pages/_dashboard._index';
import { PieChart, RefreshCcw, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { relativeExpiryDate } from '@/utils/dateFormatter';
import { Textarea } from '@/components/ui/textarea';
import { useGetUserTemplates, useGetAllGroups, useRemoveUser, useResetUserDataUsage, useRevokeUserSubscription, useActiveNextPlan, useGetUsers } from '@/service/api';
import { Layers, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import useDirDetection from '@/hooks/use-dir-detection';
import { Dialog as ConfirmDialog, DialogContent as ConfirmDialogContent, DialogHeader as ConfirmDialogHeader, DialogTitle as ConfirmDialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';

interface UserModalProps {
  isDialogOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<UseFormValues>;
  editingUser: boolean;
  editingUserId?: number;
  onSuccessCallback?: () => void;
}

const isDate = (v: unknown): v is Date =>
  typeof v === 'object' && v !== null && v instanceof Date;

export default function UserModal({ isDialogOpen, onOpenChange, form, editingUser, editingUserId, onSuccessCallback }: UserModalProps) {
  const { t } = useTranslation();
  const dir = useDirDetection();
  const [loading, setLoading] = useState(false);
  const status = form.watch('status');
  const [activeTab, setActiveTab] = useState<'groups' | 'templates'>('groups');
  const tabs = [
    { id: 'groups', label: 'groups', icon: Users },
    { id: 'templates', label: 'templates.title', icon: Layers },
  ];
  const username = form.watch('username');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [nextPlanEnabled, setNextPlanEnabled] = useState(!!form.watch('next_plan'));
  
  // Add query client for manual invalidation
  const queryClient = useQueryClient();

  // Get refetch function for users
  const { refetch: refetchUsers } = useGetUsers({}, {
    query: { enabled: false }
  });

  // Function to refresh all user-related data
  const refreshUserData = () => {
    // Invalidate all user queries to trigger a fresh fetch
    queryClient.invalidateQueries({ queryKey: ['getUsers'] });
    queryClient.invalidateQueries({ queryKey: ['getUsersUsage'] });
    // Manually trigger a refetch as well
    refetchUsers();
    
    // Call the success callback if provided
    if (onSuccessCallback) {
      onSuccessCallback();
    }
  };

  // Hooks for backend actions
  const removeUserMutation = useRemoveUser();
  const resetUsageMutation = useResetUserDataUsage();
  const revokeSubMutation = useRevokeUserSubscription();
  const activeNextPlanMutation = useActiveNextPlan();

  useEffect(() => {
    // Set form validation schema
    form.clearErrors();
    if (!editingUser) {
      form.setError('username', {
        type: 'manual',
        message: t('validation.required', { field: t('username') })
      });
    }
  }, [form, editingUser, t]);

  useEffect(() => {
    if (status === 'on_hold') {
      form.setValue('expire', undefined);
      form.clearErrors('expire');

      // Validate on_hold_expire_duration
      const duration = form.getValues('on_hold_expire_duration');
      if (!duration || duration < 1) {
        form.setError('on_hold_expire_duration', {
          type: 'manual',
          message: t('validation.required', { field: t('userDialog.onHoldExpireDuration') })
        });
      }
    } else {
      form.setValue('on_hold_expire_duration', undefined);
      form.clearErrors('on_hold_expire_duration');
    }
  }, [status, form, t]);

  useEffect(() => {
    if (!nextPlanEnabled) {
      form.setValue('next_plan', undefined);
    } else if (!form.watch('next_plan')) {
      form.setValue('next_plan', {});
    }
    // eslint-disable-next-line
  }, [nextPlanEnabled]);

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
    try {
      // Validate against schema before submitting
      const validatedData = userCreateSchema.parse(values);

      setLoading(true);
      // Convert data_limit from GB to bytes and normalize expire
      const sendValues = {
        ...validatedData,
        data_limit: gbToBytes(validatedData.data_limit as any),
        expire: normalizeExpire(validatedData.expire),
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
      // Refresh data after successful submission
      refreshUserData();
    } catch (error: any) {
      if (error?.errors) {
        const errorMessages: string[] = [];
        error.errors.forEach((err: any) => {
          // Try to get a user-friendly field name
          const fieldKey = `fields.${err.path[0]}`;
          const fieldName = t(fieldKey, { defaultValue: t(`userDialog.${err.path[0]}`, { defaultValue: err.path[0] }) });

          // Try to get a specific translation for the error code, fallback to generic
          let message = t(`validation.${err.code}`, {
            field: fieldName,
            min: err.minimum,
            max: err.maximum,
            defaultValue: ''
          });
          if (!message || message === `validation.${err.code}`) {
            // fallback to a generic error
            message = t('validation.generic', { field: fieldName, defaultValue: `${fieldName} is invalid` });
          }

          form.setError(err.path[0], {
            type: 'manual',
            message
          });
          errorMessages.push(message);
        });

        // Show a toast with the first error message
        if (errorMessages.length > 0) {
          toast({
            title: t('error', { defaultValue: 'Validation Error' }),
            description: errorMessages[0],
            variant: 'destructive',
          });
        }
      } else {
        // Handle API or other errors
        let errorMessage = error?.message || t('users.genericError', { defaultValue: 'An error occurred' });

        // If error is an array (like from FastAPI), extract the first message
        if (Array.isArray(error)) {
          errorMessage = error[0]?.msg || error[0]?.message || JSON.stringify(error[0]) || errorMessage;
        } else if (typeof error === 'object' && error !== null && error.detail) {
          // FastAPI sometimes returns { detail: [...] }
          if (Array.isArray(error.detail)) {
            errorMessage = error.detail[0]?.msg || error.detail[0]?.message || JSON.stringify(error.detail[0]);
          } else {
            errorMessage = error.detail;
          }
        }

      toast({
        title: t('error', { defaultValue: 'Error' }),
          description: errorMessage,
        variant: 'destructive',
      });
      }
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

  // Handlers
  const handleDelete = async () => {
    if (!username) return;
    try {
      await removeUserMutation.mutateAsync({ username });
      toast({ title: t('success'), description: t('users.deleteSuccess', { name: username }), variant: 'default' });
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      form.reset();
      // Refresh data after deletion
      refreshUserData();
    } catch (error: any) {
      toast({ title: t('error'), description: error?.message || t('users.genericError'), variant: 'destructive' });
    }
  };
  const handleResetUsage = async () => {
    if (!username) return;
    try {
      await resetUsageMutation.mutateAsync({ username });
      toast({ title: t('success'), description: t('users.resetUsageSuccess', { name: username }), variant: 'default' });
      // Refresh data after reset
      refreshUserData();
    } catch (error: any) {
      toast({ title: t('error'), description: error?.message || t('users.genericError'), variant: 'destructive' });
    }
  };
  const handleRevokeSub = async () => {
    if (!username) return;
    try {
      await revokeSubMutation.mutateAsync({ username });
      toast({ title: t('success'), description: t('users.revokeSubSuccess', { name: username }), variant: 'default' });
      // Refresh data after revoking subscription
      refreshUserData();
    } catch (error: any) {
      toast({ title: t('error'), description: error?.message || t('users.genericError'), variant: 'destructive' });
    }
  };
  const handleActiveNextPlan = async () => {
    if (!username) return;
    try {
      await activeNextPlanMutation.mutateAsync({ username });
      toast({ title: t('success'), description: t('users.activateNextPlanSuccess', { name: username }), variant: 'default' });
      // Refresh data after activating next plan
      refreshUserData();
    } catch (error: any) {
      toast({ title: t('error'), description: error?.message || t('users.genericError'), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-full overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={`${dir === 'rtl' ? 'text-right' : ''}`}>{editingUser ? t('userDialog.editUser', { defaultValue: 'Edit User' }) : t('createUser', { defaultValue: 'Create User' })}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className='flex items-center justify-center w-full gap-4'>
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className='flex-1'>
                    <FormLabel>{t('username', { defaultValue: 'Username' })}</FormLabel>
                    <FormControl>
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder={t('admins.enterUsername', { defaultValue: 'Enter username' })}
                          {...field}
                          value={field.value ?? ''}
                        />
                        <Button
                          size="icon"
                          type="button"
                          variant="ghost"
                          onClick={() => field.onChange(generateUsername())}
                          title="Generate username"
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
                name="status"
                render={({ field }) => (
                  <FormItem className='flex-1'>
                    <FormLabel>{t('status', { defaultValue: 'Status' })}</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('users.selectStatus', { defaultValue: 'Select status' })} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t('status.active', { defaultValue: 'Active' })}</SelectItem>
                          <SelectItem value="disabled">{t('status.disabled', { defaultValue: 'Disabled' })}</SelectItem>
                          <SelectItem value="on_hold">{t('status.on_hold', { defaultValue: 'On Hold' })}</SelectItem>
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
                    <FormLabel>{t('userDialog.dataLimit', { defaultValue: 'Data Limit (GB)' })}</FormLabel>
                    <FormControl>
                      <div className="relative w-full">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder={t('userDialog.dataLimit', { defaultValue: 'e.g. 1' })}
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
                      <FormLabel>{t('userDialog.onHoldExpireDuration', { defaultValue: 'On Hold Expire Duration (days)' })}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder={t('userDialog.onHoldExpireDurationPlaceholder', { defaultValue: 'e.g. 7' })}
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
                        <FormLabel>{t('userDialog.expiryDate', { defaultValue: 'Expire date' })}</FormLabel>
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
                          <p dir="ltr" className="text-xs text-muted-foreground mt-1">{expireInfo.time} later</p>
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
                  <FormLabel>{t('userDialog.note', { defaultValue: 'Note' })}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('userDialog.note', { defaultValue: 'Optional note' }) + "..."}
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="w-full">
              <div className="flex border-b">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`relative px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.id
                        ? 'text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                    type="button"
                  >
                    <div className="flex items-center gap-1.5">
                      <tab.icon className="h-4 w-4" />
                      <span>{t(tab.label)}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="py-2">
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
                    <FormField
                      control={form.control}
                      name="group_ids"
                      render={({ field }) => {
                        const [searchQuery, setSearchQuery] = useState('');
                        const selectedGroups = field.value || [];
                        const filteredGroups = (groupsData?.groups || []).filter((group: any) =>
                          group.name.toLowerCase().includes(searchQuery.toLowerCase())
                        );

                        const handleSelectAll = (checked: boolean) => {
                          if (checked) {
                            field.onChange(filteredGroups.map((group: any) => group.id));
                          } else {
                            field.onChange([]);
                          }
                        };

                        const allSelected = filteredGroups.length > 0 &&
                          filteredGroups.every((group: any) => selectedGroups.includes(group.id));

                        return (
                          <FormItem>
                            <div className="space-y-4 pt-4">
                              <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder={t('search', { defaultValue: 'Search' }) + " " + t("groups", { defaultValue: "groups" })}
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="pl-8"
                                />
                              </div>
                              <div className="flex items-center gap-2 p-2 border rounded-md">
                                <Checkbox
                                  checked={allSelected}
                                  onCheckedChange={handleSelectAll}
                                />
                                <span className="text-sm font-medium">
                                  {t('selectAll', { defaultValue: 'Select All' })}
                                </span>
                              </div>
                              <div className="max-h-[200px] overflow-y-auto space-y-2 p-2 border rounded-md">
                                {filteredGroups.length === 0 ? (
                                  <div className="text-sm text-muted-foreground text-center py-4">
                                    {t('users.noGroupsFound', { defaultValue: 'No groups found' })}
                                  </div>
                                ) : (
                                  filteredGroups.map((group: any) => (
                                    <label
                                      key={group.id}
                                      className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={selectedGroups.includes(group.id)}
                                        onCheckedChange={checked => {
                                          if (checked) {
                                            field.onChange([...selectedGroups, group.id]);
                                          } else {
                                            field.onChange(selectedGroups.filter((id: number) => id !== group.id));
                                          }
                                        }}
                                      />
                                      <span className="text-sm">{group.name}</span>
                                    </label>
                                  ))
                                )}
                              </div>
                              {selectedGroups.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                  {t('users.selectedGroups', {
                                    count: selectedGroups.length,
                                    defaultValue: '{{count}} groups selected'
                                  })}
                                </div>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                )}
              </div>
            </div>
            {/* Next Plan Section (toggleable) */}
            <div className="border rounded-md p-4 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{t('userDialog.nextPlanTitle', { defaultValue: 'Next Plan' })}</div>
                <Switch checked={nextPlanEnabled} onCheckedChange={setNextPlanEnabled} />
              </div>
              {nextPlanEnabled && (
                <div className="flex flex-col gap-4">
                  <FormField
                    control={form.control}
                    name="next_plan.user_template_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('userDialog.nextPlanTemplateId', { defaultValue: 'Template' })}</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ? String(field.value) : "none"}
                            onValueChange={val => field.onChange(val === "none" ? undefined : Number(val))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="---" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">---</SelectItem>
                              {(templatesData || []).map((tpl: any) => (
                                <SelectItem key={tpl.id} value={String(tpl.id)}>{tpl.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <div className="flex gap-8">
                    <FormField
                      control={form.control}
                      name="next_plan.add_remaining_traffic"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2">
                          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                          <FormLabel>{t('userDialog.nextPlanAddRemainingTraffic', { defaultValue: 'Add Remaining Traffic' })}</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="next_plan.fire_on_either"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2">
                          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                          <FormLabel>{t('userDialog.nextPlanFireOnEither', { defaultValue: 'Fire On Either' })}</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
            {/* Action buttons row above Cancel/Save */}
            {editingUser && (
              <div className="flex flex-wrap gap-2 justify-between items-center w-full mb-2">
                <div className='flex gap-2 items-center'>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={handleResetUsage} disabled={resetUsageMutation.status === 'pending'}>
                      {t('userDialog.resetUsage', { defaultValue: 'Reset Usage' })}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleRevokeSub} disabled={revokeSubMutation.status === 'pending'}>
                      {t('userDialog.revokeSubscription', { defaultValue: 'Revoke Subscription' })}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Split the action buttons and Cancel/Create buttons */}
            {editingUser && (
              <div className='flex gap-2 items-center'>
                <div className="flex gap-2">
                  <Button type="button" className="px-2 py-0" variant="outline" title={t('delete', { defaultValue: 'Delete' })} onClick={() => setConfirmDeleteOpen(true)} disabled={removeUserMutation.status === 'pending'}>
                    <Trash2 className="w-5 h-5" />
                  </Button>
                  <Button type="button" className="px-2 py-0" variant="outline" title={t('expiry', { defaultValue: 'Expiry' })} onClick={handleActiveNextPlan} disabled={activeNextPlanMutation.status === 'pending'}>
                    <PieChart className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            )}
            {/* Cancel/Create buttons - always visible */}
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button type="submit" disabled={loading}>
                {editingUser ? t('save', { defaultValue: 'Save' }) : t('create', { defaultValue: 'Create' })}
              </Button>
            </div>
            {/* Confirm Delete Modal */}
            <ConfirmDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
              <ConfirmDialogContent>
                <ConfirmDialogHeader>
                  <ConfirmDialogTitle>{t('users.deleteConfirmTitle', { defaultValue: 'Delete User' })}</ConfirmDialogTitle>
                </ConfirmDialogHeader>
                <div className="py-4">{t('users.deleteConfirm', { name: username, defaultValue: 'Are you sure you want to delete user «{{name}}»?' })}</div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>{t('cancel')}</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={removeUserMutation.status === 'pending'}>{t('delete')}</Button>
                </div>
              </ConfirmDialogContent>
            </ConfirmDialog>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
