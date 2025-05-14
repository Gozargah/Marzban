import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Button} from '@/components/ui/button';
import {useTranslation} from 'react-i18next';
import {UseFormReturn} from 'react-hook-form';
import {toast} from '@/hooks/use-toast';
import {useState, useEffect} from 'react';
import {UseFormValues, userCreateSchema} from '@/pages/_dashboard._index';
import {RefreshCcw} from 'lucide-react';
import {Calendar} from '@/components/ui/calendar';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {format} from 'date-fns';
import {CalendarIcon} from 'lucide-react';
import {cn} from '@/lib/utils';
import {relativeExpiryDate} from '@/utils/dateFormatter';
import {Textarea} from '@/components/ui/textarea';
import {formatBytes} from '@/utils/formatByte';
import {
    useGetUserTemplates,
    useGetAllGroups,
    useGetUsers,
    useCreateUser,
    useModifyUser,
    useCreateUserFromTemplate
} from '@/service/api';
import {Layers, Users} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {Search} from 'lucide-react';
import useDirDetection from '@/hooks/use-dir-detection';
import {Switch} from '@/components/ui/switch';
import {useQueryClient} from '@tanstack/react-query';

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

export default function UserModal({
                                      isDialogOpen,
                                      onOpenChange,
                                      form,
                                      editingUser,
                                      editingUserId,
                                      onSuccessCallback
                                  }: UserModalProps) {
    const {t} = useTranslation();
    const dir = useDirDetection();
    const [loading, setLoading] = useState(false);
    const status = form.watch('status');
    const [activeTab, setActiveTab] = useState<'groups' | 'templates'>('groups');
    const tabs = [
        {id: 'groups', label: 'groups', icon: Users},
        {id: 'templates', label: 'templates.title', icon: Layers},
    ];
    const [nextPlanEnabled, setNextPlanEnabled] = useState(!!form.watch('next_plan'));
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(undefined);

    // Query client for data refetching
    const queryClient = useQueryClient();

    // Get refetch function for users
    const {refetch: refetchUsers} = useGetUsers({}, {
        query: {enabled: false}
    });

    // Function to refresh all user-related data
    const refreshUserData = () => {
        // Invalidate relevant queries to trigger fresh fetches
        queryClient.invalidateQueries({queryKey: ['/api/users']});
        queryClient.invalidateQueries({queryKey: ['getUsersUsage']});
        queryClient.invalidateQueries({queryKey: ['getUserStats']});
        queryClient.invalidateQueries({queryKey: ['getInboundStats']});
        queryClient.invalidateQueries({queryKey: ['getUserOnlineStats']});

        // Force immediate refetch
        refetchUsers();

        // Call the success callback if provided
        if (onSuccessCallback) {
            onSuccessCallback();
        }
    };

    const createUserMutation = useCreateUser({
        mutation: {
            onSuccess: () => refreshUserData()
        }
    });
    const modifyUserMutation = useModifyUser({
        mutation: {
            onSuccess: () => refreshUserData()
        }
    });
    const createUserFromTemplateMutation = useCreateUserFromTemplate({
        mutation: {
            onSuccess: () => refreshUserData()
        }
    });

    useEffect(() => {
        // When the dialog closes, reset errors
        if (!isDialogOpen) {
            form.clearErrors();
        }
    }, [isDialogOpen, form]);

    useEffect(() => {
        // Set form validation schema
        form.clearErrors();
        if (!editingUser) {
            form.setError('username', {
                type: 'manual',
                message: t('validation.required', {field: t('username')})
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
                    message: t('validation.required', {field: t('userDialog.onHoldExpireDuration')})
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

        // For number values, return directly (already a timestamp)
        if (typeof expire === 'number') return expire;

        // For Date objects, convert to Unix timestamp (seconds)
        if (expire instanceof Date) {
            return Math.floor(expire.getTime() / 1000);
        }

        // For strings
        if (typeof expire === 'string') {
            // Try as number first
            const asNum = Number(expire);
            if (!isNaN(asNum) && expire.trim() !== '') {
                return asNum; // Return as number if it's a valid numeric string
            }

            // Try as date string
            const asDate = new Date(expire);
            if (!isNaN(asDate.getTime())) {
                return Math.floor(asDate.getTime() / 1000);
            }
        }

        // Return as is for any other case
        return expire;
    }

    // Helper to clear group selection
    const clearGroups = () => form.setValue('group_ids', []);
    // Helper to clear template selection
    const clearTemplate = () => setSelectedTemplateId(undefined);

    // Helper to check if a template is selected in next plan
    const nextPlanTemplateSelected = !!form.watch('next_plan.user_template_id');

    const onSubmit = async (values: UseFormValues) => {
        try {
            form.clearErrors();
            // If a template is selected, use createUserFromTemplate
            if (selectedTemplateId) {
                setLoading(true);
                await createUserFromTemplateMutation.mutateAsync({
                    data: {
                        user_template_id: selectedTemplateId,
                        username: values.username,
                        note: values.note || undefined
                    }
                });
                toast({
                    title: t('success', {defaultValue: 'Success'}),
                    description: t('users.createSuccess', {
                        name: values.username,
                        defaultValue: 'User «{{name}}» has been created successfully'
                    })
                });
                onOpenChange(false);
                form.reset();
                setSelectedTemplateId(undefined);
                return;
            }
            // Convert data to the right format before validation
            const preparedValues = {
                ...values,
                // Ensure data_limit is a number
                data_limit: typeof values.data_limit === 'string'
                    ? parseFloat(values.data_limit)
                    : values.data_limit,
                // Ensure on_hold_expire_duration is a number and valid for on_hold status
                on_hold_expire_duration: status === 'on_hold'
                    ? (typeof values.on_hold_expire_duration === 'string' && values.on_hold_expire_duration !== ''
                        ? parseInt(values.on_hold_expire_duration, 10)
                        : values.on_hold_expire_duration)
                    : undefined,
                // Ensure expire is properly formatted and not set when on_hold
                expire: status === 'on_hold' ? undefined : normalizeExpire(values.expire),
                // Ensure group_ids is an array
                group_ids: Array.isArray(values.group_ids) ? values.group_ids : [],
            };

            // Remove next_plan.data_limit and next_plan.expire if next_plan.user_template_id is set
            if (preparedValues.next_plan && preparedValues.next_plan.user_template_id) {
                delete preparedValues.next_plan.data_limit;
                delete preparedValues.next_plan.expire;
            }

            // Validate against schema
            const validatedData = userCreateSchema.parse(preparedValues);

            setLoading(true);
            // Convert data_limit from GB to bytes
            const sendValues = {
                ...validatedData,
                data_limit: gbToBytes(validatedData.data_limit as any),
                expire: normalizeExpire(validatedData.expire),
            };

            // Make API calls to the backend
            if (editingUser && editingUserId) {
                await modifyUserMutation.mutateAsync({
                    username: sendValues.username,
                    data: sendValues
                });
                toast({
                    title: t('success', {defaultValue: 'Success'}),
                    description: t('users.editSuccess', {
                        name: values.username,
                        defaultValue: 'User «{{name}}» has been updated successfully'
                    })
                });
            } else {
                await createUserMutation.mutateAsync({
                    data: sendValues
                });
                toast({
                    title: t('success', {defaultValue: 'Success'}),
                    description: t('users.createSuccess', {
                        name: values.username,
                        defaultValue: 'User «{{name}}» has been created successfully'
                    })
                });
            }

            onOpenChange(false);
            form.reset();
        } catch (error: any) {
            console.error('Form submission error:', error);

            // Reset all previous errors first
            form.clearErrors();

            // Handle validation errors
            if (error?.errors) {
                // For zod validation errors
                const fields = ['username', 'status', 'data_limit', 'expire', 'note',
                    'data_limit_reset_strategy', 'on_hold_expire_duration',
                    'on_hold_timeout', 'group_ids'];

                // Show first error in a toast
                if (error.errors.length > 0) {
                    const firstError = error.errors[0];
                    const fieldName = firstError.path[0] ?
                        t(`userDialog.${firstError.path[0]}`, {defaultValue: firstError.path[0]}) :
                        'field';

                    // Set error on form if it's a recognized field
                    if (firstError.path[0] && fields.includes(firstError.path[0])) {
                        form.setError(firstError.path[0] as any, {
                            type: 'manual',
                            message: t(`validation.${firstError.code}`, {
                                field: fieldName,
                                defaultValue: `${fieldName} is invalid`
                            })
                        });
                    }

                    toast({
                        title: t('error', {defaultValue: 'Validation Error'}),
                        description: t(`validation.${firstError.code}`, {
                            field: fieldName,
                            defaultValue: `${fieldName} is invalid`
                        }),
                        variant: 'destructive',
                    });
                }
            } else if (error?.response?.data) {
                // Handle API errors
                const apiError = error.response?.data;
                let errorMessage = '';

                if (typeof apiError === 'string') {
                    errorMessage = apiError;
                } else if (apiError?.detail) {
                    errorMessage = typeof apiError.detail === 'string' ?
                        apiError.detail :
                        (Array.isArray(apiError.detail) && apiError.detail.length > 0 ?
                            apiError.detail[0].msg : 'Validation error');
                } else if (apiError?.message) {
                    errorMessage = apiError.message;
                } else {
                    errorMessage = 'An unexpected error occurred';
                }

                toast({
                    title: t('error', {defaultValue: 'Error'}),
                    description: errorMessage,
                    variant: 'destructive',
                });
            } else {
                // Generic error handling
                toast({
                    title: t('error', {defaultValue: 'Error'}),
                    description: error?.message || t('users.genericError', {defaultValue: 'An error occurred'}),
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
    const {data: templatesData, isLoading: templatesLoading} = useGetUserTemplates();
    const {data: groupsData, isLoading: groupsLoading} = useGetAllGroups();


    useEffect(() => {
        // Log form state when dialog opens
        if (isDialogOpen) {
            // Initialize on_hold_expire_duration if status is on_hold
            if (status === 'on_hold' && editingUser) {
                const currentDuration = form.getValues('on_hold_expire_duration');
                if (currentDuration === undefined || currentDuration === null || Number(currentDuration) === 0) {
                    // Only set default if there's no value at all
                    form.setValue('on_hold_expire_duration', 0);
                }
            }
        }
    }, [isDialogOpen, form, editingUser, status]);

    return (
        <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className={`lg:min-w-[900px]  ${editingUser ? "sm:h-auto h-full" : "h-auto"}`}>
                <DialogHeader>
                    <DialogTitle
                        className={`${dir === 'rtl' ? 'text-right' : ''}`}>{editingUser ? t('userDialog.editUser', {defaultValue: 'Edit User'}) : t('createUser', {defaultValue: 'Create User'})}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div
                            className="max-h-[85vh] overflow-y-auto pr-4 -mr-4 sm:max-h-[75vh] px-2">
                            <div
                                className='flex flex-col gap-6 lg:flex-row items-center lg:items-start justify-between w-full lg:pb-8'>
                                <div className='space-y-6 flex-[2] w-full'>
                                    <div className='flex items-center justify-center w-full gap-4'>
                                        {/* Hide these fields if a template is selected */}
                                        {!selectedTemplateId && (
                                            <>
                                                <FormField
                                                    control={form.control}
                                                    name="username"
                                                    render={({field}) => (
                                                        <FormItem className='flex-1'>
                                                            <FormLabel>{t('username', {defaultValue: 'Username'})}</FormLabel>
                                                            <FormControl>
                                                                <div className="flex gap-2 items-center">
                                                                    <Input
                                                                        placeholder={t('admins.enterUsername', {defaultValue: 'Enter username'})}
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
                                                                        <RefreshCcw className="w-3 h-3"/>
                                                                    </Button>
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="status"
                                                    render={({field}) => (
                                                        <FormItem className='flex-1'>
                                                            <FormLabel>{t('status', {defaultValue: 'Status'})}</FormLabel>
                                                            <FormControl>
                                                                <Select onValueChange={field.onChange}
                                                                        value={field.value || ''}>
                                                                    <SelectTrigger>
                                                                        <SelectValue
                                                                            placeholder={t('users.selectStatus', {defaultValue: 'Select status'})}/>
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem
                                                                            value="active">{t('status.active', {defaultValue: 'Active'})}</SelectItem>
                                                                        {editingUser && <SelectItem
                                                                            value="disabled">{t('status.disabled', {defaultValue: 'Disabled'})}</SelectItem>}
                                                                        <SelectItem
                                                                            value="on_hold">{t('status.on_hold', {defaultValue: 'On Hold'})}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />
                                            </>
                                        )}
                                        {/* If template is selected, only show username field */}
                                        {selectedTemplateId && (
                                            <FormField
                                                control={form.control}
                                                name="username"
                                                render={({field}) => (
                                                    <FormItem className='flex-1'>
                                                        <FormLabel>{t('username', {defaultValue: 'Username'})}</FormLabel>
                                                        <FormControl>
                                                            <div className="flex gap-2 items-center">
                                                                <Input
                                                                    placeholder={t('admins.enterUsername', {defaultValue: 'Enter username'})}
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
                                                                    <RefreshCcw className="w-3 h-3"/>
                                                                </Button>
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                    {/* Hide data_limit and expire if template is selected */}
                                    {!selectedTemplateId && (
                                        <div className='flex-col w-full gap-4 flex sm:flex-row sm:items-start'>
                                            <FormField
                                                control={form.control}
                                                name="data_limit"
                                                render={({field}) => (
                                                    <FormItem className='flex-1'>
                                                        <FormLabel>{t('userDialog.dataLimit', {defaultValue: 'Data Limit (GB)'})}</FormLabel>
                                                        <FormControl>
                                                            <div className="relative w-full">
                                                                <Input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    placeholder={t('userDialog.dataLimit', {defaultValue: 'e.g. 1'})}
                                                                    {...field}
                                                                    value={field.value === null || field.value === undefined ? '' : field.value}
                                                                    className="pr-12"
                                                                />
                                                                <span
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">GB</span>
                                                            </div>
                                                        </FormControl>
                                                        {field.value && field.value < 1 && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {formatBytes(Math.round(field.value * 1024 * 1024 * 1024))}
                                                            </p>
                                                        )}
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            {form.getValues("data_limit") > 0 && (
                                                <FormField
                                                    control={form.control}
                                                    name="data_limit_reset_strategy"
                                                    render={({field}) => (
                                                        <FormItem className="flex-1">
                                                            <FormLabel>{t('userDialog.periodicUsageReset', {defaultValue: 'Periodic Usage Reset'})}</FormLabel>
                                                            <Select onValueChange={field.onChange}
                                                                    value={field.value || ''}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue
                                                                            placeholder={t('userDialog.resetStrategyNo', {defaultValue: 'No'})}/>
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem
                                                                        value="no_reset">{t('userDialog.resetStrategyNo', {defaultValue: 'No'})}</SelectItem>
                                                                    <SelectItem
                                                                        value="day">{t('userDialog.resetStrategyDaily', {defaultValue: 'Daily'})}</SelectItem>
                                                                    <SelectItem
                                                                        value="week">{t('userDialog.resetStrategyWeekly', {defaultValue: 'Weekly'})}</SelectItem>
                                                                    <SelectItem
                                                                        value="month">{t('userDialog.resetStrategyMonthly', {defaultValue: 'Monthly'})}</SelectItem>
                                                                    <SelectItem
                                                                        value="year">{t('userDialog.resetStrategyAnnually', {defaultValue: 'Annually'})}</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />)}
                                            <div className="flex items-start md:w-52 gap-4">
                                                {status === 'on_hold' ? (
                                                    <FormField
                                                        control={form.control}
                                                        name="on_hold_expire_duration"
                                                        render={({field}) => (
                                                            <FormItem className="flex-1">
                                                                <FormLabel>{t('userDialog.onHoldExpireDuration', {defaultValue: 'On Hold Expire Duration (days)'})}</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        placeholder={t('userDialog.onHoldExpireDurationPlaceholder', {defaultValue: 'e.g. 7'})}
                                                                        {...field}
                                                                        value={field.value === null || field.value === undefined ? '' : field.value}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />

                                                ) : (
                                                    <FormField
                                                        control={form.control}
                                                        name="expire"
                                                        render={({field}) => {
                                                            let expireUnix: number | null = null;
                                                            let displayDate: Date | null = null;

                                                            // Handle various formats of expire value
                                                            if (isDate(field.value)) {
                                                                expireUnix = Math.floor(field.value.getTime() / 1000);
                                                                displayDate = field.value;
                                                            } else if (typeof field.value === 'string') {
                                                                // Try parsing as date string first
                                                                if (field.value === '') {
                                                                    // Empty string - no date set
                                                                    expireUnix = null;
                                                                    displayDate = null;
                                                                } else {
                                                                    const asNum = Number(field.value);
                                                                    if (!isNaN(asNum)) {
                                                                        // It's a numeric string (timestamp), convert to date
                                                                        const timestamp = asNum * 1000; // Convert seconds to ms
                                                                        const date = new Date(timestamp);
                                                                        if (date.getFullYear() > 1970) {
                                                                            displayDate = date;
                                                                            expireUnix = asNum;
                                                                        }
                                                                    } else {
                                                                        // Try as date string
                                                                        const date = new Date(field.value);
                                                                        if (!isNaN(date.getTime()) && date.getFullYear() > 1970) {
                                                                            expireUnix = Math.floor(date.getTime() / 1000);
                                                                            displayDate = date;
                                                                        }
                                                                    }
                                                                }
                                                            } else if (typeof field.value === 'number') {
                                                                // Direct timestamp in seconds
                                                                const date = new Date(field.value * 1000);
                                                                // Validate the date is reasonable (after 1970)
                                                                if (date.getFullYear() > 1970) {
                                                                    displayDate = date;
                                                                    expireUnix = field.value;
                                                                }
                                                            }

                                                            const expireInfo = expireUnix ? relativeExpiryDate(expireUnix) : null;

                                                            return (
                                                                <FormItem className="flex flex-col flex-1">
                                                                    <FormLabel>{t('userDialog.expiryDate', {defaultValue: 'Expire date'})}</FormLabel>
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
                                                                                    {displayDate
                                                                                        ? format(displayDate, "yyyy/MM/dd")
                                                                                        : field.value && !isNaN(Number(field.value))
                                                                                            ? String(field.value)
                                                                                            :
                                                                                            <span>{t('users.expirePlaceholder', {defaultValue: 'Pick a date'})}</span>
                                                                                    }
                                                                                    <CalendarIcon
                                                                                        className="ml-auto h-4 w-4 opacity-50"/>
                                                                                </Button>
                                                                            </FormControl>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-auto p-0"
                                                                                        align="start">
                                                                            <Calendar
                                                                                mode="single"
                                                                                selected={displayDate || undefined}
                                                                                onSelect={date => {
                                                                                    if (date) {
                                                                                        // Convert to seconds timestamp when saving to form
                                                                                        const timestamp = Math.floor(date.getTime() / 1000);
                                                                                        field.onChange(timestamp);
                                                                                    } else {
                                                                                        field.onChange('');
                                                                                    }
                                                                                }}
                                                                                fromDate={new Date()}
                                                                                initialFocus
                                                                            />
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                    {expireInfo?.time && (
                                                                        <p dir="ltr"
                                                                           className="text-xs text-muted-foreground mt-1">{expireInfo.time} later</p>
                                                                    )}
                                                                    <FormMessage/>
                                                                </FormItem>
                                                            );
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <FormField
                                        control={form.control}
                                        name="note"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>{t('userDialog.note', {defaultValue: 'Note'})}</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder={t('userDialog.note', {defaultValue: 'Optional note'}) + "..."}
                                                        {...field}
                                                        rows={3}
                                                    />
                                                </FormControl>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />
                                    {/* Next Plan Section (toggleable) */}
                                    {editingUser && (
                                        <>
                                            <div className="flex items-center justify-between mb-2">
                                                <div
                                                    className="font-semibold">{t('userDialog.nextPlanTitle', {defaultValue: 'Next Plan'})}</div>
                                                <Switch checked={nextPlanEnabled} onCheckedChange={setNextPlanEnabled}/>
                                            </div>
                                            {nextPlanEnabled && (
                                                <div className="flex flex-col gap-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="next_plan.user_template_id"
                                                        render={({field}) => (
                                                            <FormItem>
                                                                <FormLabel>{t('userDialog.nextPlanTemplate', {defaultValue: 'Template'})}</FormLabel>
                                                                <FormControl>
                                                                    <Select
                                                                        value={field.value ? String(field.value) : "none"}
                                                                        onValueChange={val => {
                                                                            if (val === "none" || (field.value && String(field.value) === val)) {
                                                                                field.onChange(undefined);
                                                                            } else {
                                                                                field.onChange(Number(val));
                                                                            }
                                                                        }}
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue
                                                                                placeholder={t('userDialog.selectTemplatePlaceholder', {defaultValue: 'Choose a template'})}/>
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="none">---</SelectItem>
                                                                            {(templatesData || []).map((tpl: any) => (
                                                                                <SelectItem key={tpl.id}
                                                                                            value={String(tpl.id)}>{tpl.name}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    {/* Only show expire and data_limit if no template is selected */}
                                                    {!nextPlanTemplateSelected && (
                                                        <div className="flex gap-4">
                                                            <FormField
                                                                control={form.control}
                                                                name="next_plan.expire"
                                                                render={({field}) => (
                                                                    <FormItem>
                                                                        <FormLabel>{t('userDialog.nextPlanExpire', {defaultValue: 'Expire'})}</FormLabel>
                                                                        <FormControl>
                                                                            <Input type="number" min="0" {...field}
                                                                                   value={field.value ?? ''}/>
                                                                        </FormControl>
                                                                        <span
                                                                            className="text-xs text-muted-foreground">{t('userDialog.days', {defaultValue: 'Days'})}</span>
                                                                        <FormMessage/>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="next_plan.data_limit"
                                                                render={({field}) => (
                                                                    <FormItem>
                                                                        <FormLabel>{t('userDialog.nextPlanDataLimit', {defaultValue: 'Data Limit'})}</FormLabel>
                                                                        <FormControl>
                                                                            <Input type="number" min="0"
                                                                                   step="any" {...field}
                                                                                   value={field.value ?? ''}/>
                                                                        </FormControl>
                                                                        <span
                                                                            className="text-xs text-muted-foreground">GB</span>
                                                                        <FormMessage/>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="flex gap-8">
                                                        <FormField
                                                            control={form.control}
                                                            name="next_plan.add_remaining_traffic"
                                                            render={({field}) => (
                                                                <FormItem className="flex flex-row items-center gap-2">
                                                                    <Switch checked={!!field.value}
                                                                            onCheckedChange={field.onChange}/>
                                                                    <FormLabel>{t('userDialog.nextPlanAddRemainingTraffic', {defaultValue: 'Add Remaining Traffic'})}</FormLabel>
                                                                    <FormMessage/>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name="next_plan.fire_on_either"
                                                            render={({field}) => (
                                                                <FormItem className="flex flex-row items-center gap-2">
                                                                    <Switch checked={!!field.value}
                                                                            onCheckedChange={field.onChange}/>
                                                                    <FormLabel>{t('userDialog.nextPlanFireOnEither', {defaultValue: 'Fire On Either'})}</FormLabel>
                                                                    <FormMessage/>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <div className='space-y-6 w-full h-full flex-1'>
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
                                                        <tab.icon className="h-4 w-4"/>
                                                        <span>{t(tab.label)}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="py-2">
                                            {activeTab === 'templates' && (
                                                templatesLoading ?
                                                    <div>{t('Loading...', {defaultValue: 'Loading...'})}</div> :
                                                    <div className="space-y-4 pt-4">
                                                        <FormLabel>{t('userDialog.selectTemplate', {defaultValue: 'Select Template'})}</FormLabel>
                                                        <Select
                                                            value={selectedTemplateId ? String(selectedTemplateId) : 'none'}
                                                            onValueChange={val => {
                                                                if (val === 'none' || (selectedTemplateId && String(selectedTemplateId) === val)) {
                                                                    setSelectedTemplateId(undefined);
                                                                    clearGroups();
                                                                } else {
                                                                    setSelectedTemplateId(Number(val));
                                                                    clearGroups();
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue
                                                                    placeholder={t('userDialog.selectTemplatePlaceholder', {defaultValue: 'Choose a template'})}/>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">---</SelectItem>
                                                                {(templatesData || []).map((template: any) => (
                                                                    <SelectItem key={template.id}
                                                                                value={String(template.id)}>{template.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {selectedTemplateId && (
                                                            <div className="text-sm text-muted-foreground">
                                                                {t('users.selectedTemplates', {
                                                                    count: 1,
                                                                    defaultValue: '1 template selected'
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                            )}
                                            {activeTab === 'groups' && (
                                                groupsLoading ?
                                                    <div>{t('Loading...', {defaultValue: 'Loading...'})}</div> :
                                                    <FormField
                                                        control={form.control}
                                                        name="group_ids"
                                                        render={({field}) => {
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

                                                            // If a group is selected, clear template selection
                                                            const handleGroupChange = (checked: boolean, groupId: number) => {
                                                                if (checked) {
                                                                    clearTemplate();
                                                                    field.onChange([...selectedGroups, groupId]);
                                                                } else {
                                                                    field.onChange(selectedGroups.filter((id: number) => id !== groupId));
                                                                }
                                                            };

                                                            return (
                                                                <FormItem>
                                                                    <div className="space-y-4 pt-4">
                                                                        <div className="relative">
                                                                            <Search
                                                                                className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
                                                                            <Input
                                                                                placeholder={t('search', {defaultValue: 'Search'}) + " " + t("groups", {defaultValue: "groups"})}
                                                                                value={searchQuery}
                                                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                                                className="pl-8"
                                                                            />
                                                                        </div>
                                                                        <div
                                                                            className="flex items-center gap-2 p-2 border rounded-md">
                                                                            <Checkbox
                                                                                checked={allSelected}
                                                                                onCheckedChange={handleSelectAll}
                                                                            />
                                                                            <span className="text-sm font-medium">
                                      {t('selectAll', {defaultValue: 'Select All'})}
                                    </span>
                                                                        </div>
                                                                        <div
                                                                            className="max-h-[200px] overflow-y-auto space-y-2 p-2 border rounded-md">
                                                                            {filteredGroups.length === 0 ? (
                                                                                <div
                                                                                    className="text-sm text-muted-foreground text-center py-4">
                                                                                    {t('users.noGroupsFound', {defaultValue: 'No groups found'})}
                                                                                </div>
                                                                            ) : (
                                                                                filteredGroups.map((group: any) => (
                                                                                    <label
                                                                                        key={group.id}
                                                                                        className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                                                                    >
                                                                                        <Checkbox
                                                                                            checked={selectedGroups.includes(group.id)}
                                                                                            onCheckedChange={checked => handleGroupChange(!!checked, group.id)}
                                                                                        />
                                                                                        <span
                                                                                            className="text-sm">{group.name}</span>
                                                                                    </label>
                                                                                ))
                                                                            )}
                                                                        </div>
                                                                        {selectedGroups.length > 0 && (
                                                                            <div
                                                                                className="text-sm text-muted-foreground">
                                                                                {t('users.selectedGroups', {
                                                                                    count: selectedGroups.length,
                                                                                    defaultValue: '{{count}} groups selected'
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <FormMessage/>
                                                                </FormItem>
                                                            );
                                                        }}
                                                    />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Cancel/Create buttons - always visible */}
                        <div className="flex justify-end gap-2 mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t('cancel', {defaultValue: 'Cancel'})}
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {editingUser ? t('save', {defaultValue: 'Save'}) : t('create', {defaultValue: 'Create'})}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
