import { BaseHost, CreateHost, createHost, modifyHosts } from '@/service/api'
import { queryClient } from '@/utils/query-client'
import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, UniqueIdentifier, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'
import HostModal from '../dialogs/HostModal'
import SortableHost from './SortableHost'

interface Brutal {
  enable?: boolean
  up_mbps: number
  down_mbps: number
}

interface XrayMuxSettings {
  enable?: boolean
  concurrency: number | null
  xudp_concurrency: number | null
  xudp_proxy_443: string
}

interface SingBoxMuxSettings {
  enable?: boolean
  protocol: string | null | undefined
  max_connections: number | null
  max_streams: number | null
  min_streams: number | null
  padding: boolean | null
  brutal: Brutal | null
}

interface ClashMuxSettings {
  enable?: boolean
  protocol: string | null | undefined
  max_connections: number | null
  max_streams: number | null
  min_streams: number | null
  padding: boolean | null
  brutal: Brutal | null
  statistic: boolean | null
  only_tcp: boolean | null
}

interface MuxSettings {
  xray?: XrayMuxSettings
  sing_box?: SingBoxMuxSettings
  clash?: ClashMuxSettings
}

export interface HostFormValues {
  id?: number
  remark: string
  address: string
  port?: number
  inbound_tag: string
  status: ('active' | 'disabled' | 'limited' | 'expired' | 'on_hold')[]
  host?: string
  sni?: string
  path?: string
  http_headers?: Record<string, string>
  security: 'none' | 'tls' | 'inbound_default'
  alpn?: string
  fingerprint?: string
  allowinsecure: boolean
  is_disabled: boolean
  random_user_agent: boolean
  use_sni_as_host: boolean
  priority: number
  fragment_settings?: {
    xray?: {
      packets?: string
      length?: string
      interval?: string
    }
    sing_box?: {
      fragment: boolean
      fragment_fallback_delay: string
      record_fragment: boolean
    }
  }
  noise_settings?: {
    xray?: {
      type: string
      packet: string
      delay: string
    }[]
  }
  mux_settings?: MuxSettings
  transport_settings?: {
    xhttp_settings?: {
      mode?: 'auto' | 'packet-up' | 'stream-up' | 'stream-one'
      no_grpc_header?: boolean
      x_padding_bytes?: string
      sc_max_each_post_bytes?: string
      sc_min_posts_interval_ms?: string
      sc_max_buffered_posts?: string
      sc_stream_up_server_secs?: string
      download_settings?: number
      xmux?: {
        max_concurrency?: string
        max_connections?: string
        c_max_reuse_times?: string
        c_max_lifetime?: string
        h_max_request_times?: string
        h_keep_alive_period?: string
      }
    }
    grpc_settings?: {
      multi_mode?: boolean
      idle_timeout?: number
      health_check_timeout?: number
      permit_without_stream?: number
      initial_windows_size?: number
    }
    kcp_settings?: {
      header?: string
      mtu?: number
      tti?: number
      uplink_capacity?: number
      downlink_capacity?: number
      congestion?: number
      read_buffer_size?: number
      write_buffer_size?: number
    }
    tcp_settings?: {
      header?: string
      request?: {
        version?: string
        headers?: Record<string, string[]>
        method?: string
      }
      response?: {
        version?: string
        headers?: Record<string, string[]>
        status?: string
        reason?: string
      }
    }
    websocket_settings?: {
      heartbeatPeriod?: number
    }
  }
}

// Update the transport settings schema
const transportSettingsSchema = z
  .object({
    xhttp_settings: z
      .object({
        mode: z.enum(['auto', 'packet-up', 'stream-up', 'stream-one']).nullish().optional(),
        no_grpc_header: z.boolean().nullish().optional(),
        x_padding_bytes: z.string().nullish().optional(),
        sc_max_each_post_bytes: z.string().nullish().optional(),
        sc_min_posts_interval_ms: z.string().nullish().optional(),
        sc_max_buffered_posts: z.string().nullish().optional(),
        sc_stream_up_server_secs: z.string().nullish().optional(),
        download_settings: z.number().nullish().optional(),
        xmux: z
          .object({
            max_concurrency: z.string().nullish().optional(),
            max_connections: z.string().nullish().optional(),
            c_max_reuse_times: z.string().nullish().optional(),
            c_max_lifetime: z.string().nullish().optional(),
            h_max_request_times: z.string().nullish().optional(),
            h_keep_alive_period: z.string().nullish().optional(),
          })
          .nullish()
          .optional(),
      })
      .nullish()
      .optional(),
    grpc_settings: z
      .object({
        multi_mode: z.boolean().nullish().optional(),
        idle_timeout: z.number().nullish().optional(),
        health_check_timeout: z.number().nullish().optional(),
        permit_without_stream: z.number().nullish().optional(),
        initial_windows_size: z.number().nullish().optional(),
      })
      .nullish()
      .optional(),
    kcp_settings: z
      .object({
        header: z.string().nullish().optional(),
        mtu: z.number().nullish().optional(),
        tti: z.number().nullish().optional(),
        uplink_capacity: z.number().nullish().optional(),
        downlink_capacity: z.number().nullish().optional(),
        congestion: z.number().nullish().optional(),
        read_buffer_size: z.number().nullish().optional(),
        write_buffer_size: z.number().nullish().optional(),
      })
      .nullish()
      .optional(),
    tcp_settings: z
      .object({
        header: z.enum(['none', 'http']).nullish().optional(),
        request: z
          .object({
            version: z.enum(['1.0', '1.1', '2.0', '3.0']).nullish().optional(),
            method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'TRACE', 'CONNECT']).nullish().optional(),
            headers: z.record(z.array(z.string())).nullish().optional(),
          })
          .nullish()
          .optional(),
        response: z
          .object({
            version: z.enum(['1.0', '1.1', '2.0', '3.0']).nullish().optional(),
            status: z
              .string()
              .regex(/^[1-5]\d{2}$/)
              .nullish()
              .optional(),
            reason: z
              .enum([
                'Continue',
                'Switching Protocols',
                'OK',
                'Created',
                'Accepted',
                'Non-Authoritative Information',
                'No Content',
                'Reset Content',
                'Partial Content',
                'Multiple Choices',
                'Moved Permanently',
                'Found',
                'See Other',
                'Not Modified',
                'Use Proxy',
                'Temporary Redirect',
                'Permanent Redirect',
                'Bad Request',
                'Unauthorized',
                'Payment Required',
                'Forbidden',
                'Not Found',
                'Method Not Allowed',
                'Not Acceptable',
                'Proxy Authentication Required',
                'Request Timeout',
                'Conflict',
                'Gone',
                'Length Required',
                'Precondition Failed',
                'Payload Too Large',
                'URI Too Long',
                'Unsupported Media Type',
                'Range Not Satisfiable',
                'Expectation Failed',
                "I'm a teapot",
                'Misdirected Request',
                'Unprocessable Entity',
                'Locked',
                'Failed Dependency',
                'Too Early',
                'Upgrade Required',
                'Precondition Required',
                'Too Many Requests',
                'Request Header Fields Too Large',
                'Unavailable For Legal Reasons',
                'Internal Server Error',
                'Not Implemented',
                'Bad Gateway',
                'Service Unavailable',
                'Gateway Timeout',
                'HTTP Version Not Supported',
              ])
              .nullish()
              .optional(),
            headers: z.record(z.array(z.string())).nullish().optional(),
          })
          .nullish()
          .optional(),
      })
      .nullish()
      .optional(),
    websocket_settings: z
      .object({
        heartbeatPeriod: z.number().nullish().optional(),
      })
      .nullish()
      .optional(),
  })
  .nullish()
  .optional()

export const HostFormSchema = z.object({
  remark: z.string().min(1, 'Remark is required'),
  address: z.string().min(1, 'Address is required'),
  port: z.number().min(1, 'Port must be at least 1').max(65535, 'Port must be at most 65535').optional().or(z.literal('')),
  inbound_tag: z.string().min(1, 'Inbound tag is required'),
  status: z.array(z.string()).default([]),
  host: z.string().default(''),
  sni: z.string().default(''),
  path: z.string().default(''),
  http_headers: z.record(z.string()).default({}),
  security: z.enum(['inbound_default', 'tls', 'none']).default('inbound_default'),
  alpn: z.string().default(''),
  fingerprint: z.string().default(''),
  allowinsecure: z.boolean().default(false),
  random_user_agent: z.boolean().default(false),
  use_sni_as_host: z.boolean().default(false),
  priority: z.number().default(0),
  is_disabled: z.boolean().default(false),
  fragment_settings: z
    .object({
      xray: z
        .object({
          packets: z.string().optional(),
          length: z.string().optional(),
          interval: z.string().optional(),
        })
        .optional(),
      sing_box: z
        .object({
          fragment: z.boolean().optional(),
          fragment_fallback_delay: z.string().optional(),
          record_fragment: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  noise_settings: z
    .object({
      xray: z
        .array(
          z.object({
            type: z
              .string()
              .regex(/^(?:rand|str|base64|hex)$/)
              .optional(),
            packet: z.string().optional(),
            delay: z
              .string()
              .regex(/^\d{1,16}(-\d{1,16})?$/)
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  mux_settings: z
    .object({
      xray: z
        .object({
          concurrency: z.number().nullable().optional(),
          xudp_concurrency: z.number().nullable().optional(),
          xudp_proxy_443: z.enum(['reject', 'allow', 'skip']).nullable().optional(),
        })
        .optional(),
      sing_box: z
        .object({
          protocol: z.enum(['none', 'smux', 'yamux', 'h2mux']).optional(),
          max_connections: z.number().nullable().optional(),
          max_streams: z.number().nullable().optional(),
          min_streams: z.number().nullable().optional(),
          padding: z.boolean().nullable().optional(),
          brutal: z
            .object({
              up_mbps: z.number().nullable().optional(),
              down_mbps: z.number().nullable().optional(),
            })
            .nullable()
            .optional(),
        })
        .optional(),
      clash: z
        .object({
          protocol: z.enum(['none', 'smux', 'yamux', 'h2mux']).optional(),
          max_connections: z.number().nullable().optional(),
          max_streams: z.number().nullable().optional(),
          min_streams: z.number().nullable().optional(),
          padding: z.boolean().nullable().optional(),
          brutal: z
            .object({
              up_mbps: z.number().nullable().optional(),
              down_mbps: z.number().nullable().optional(),
            })
            .nullable()
            .optional(),
          statistic: z.boolean().nullable().optional(),
          only_tcp: z.boolean().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  transport_settings: transportSettingsSchema,
})

// Define initial default values separately
const initialDefaultValues: HostFormValues = {
  remark: '',
  address: '',
  port: undefined,
  inbound_tag: '',
  status: [],
  host: '',
  sni: '',
  path: '',
  http_headers: {},
  security: 'inbound_default',
  alpn: '',
  fingerprint: '',
  allowinsecure: false,
  is_disabled: false,
  random_user_agent: false,
  use_sni_as_host: false,
  priority: 0,
  fragment_settings: undefined,
}

export interface HostsProps {
  data: BaseHost[]
  isDialogOpen: boolean
  onDialogOpenChange: (open: boolean) => void
  onAddHost: (open: boolean) => void
  onSubmit: (data: HostFormValues) => Promise<{ status: number }>
  editingHost: BaseHost | null
  setEditingHost: (host: BaseHost | null) => void
}

export default function Hosts({ data, onAddHost, isDialogOpen, onSubmit, editingHost, setEditingHost }: HostsProps) {
  const [hosts, setHosts] = useState<BaseHost[] | undefined>()
  const [debouncedHosts, setDebouncedHosts] = useState<BaseHost[] | undefined>([])
  const [skipNextDebounce, setSkipNextDebounce] = useState(false)
  const { t } = useTranslation()

  // Set up hosts data from props
  useEffect(() => {
    setHosts(data ?? [])
    setSkipNextDebounce(true)
  }, [data])

  const form = useForm<HostFormValues>({
    resolver: zodResolver(HostFormSchema),
    defaultValues: initialDefaultValues,
  })

  const refreshHostsData = () => {
    // Just invalidate the main query key used in the dashboard
    queryClient.invalidateQueries({
      queryKey: ['getGetHostsQueryKey'],
      exact: true, // Only invalidate this exact query
      refetchType: 'active', // Only refetch if the query is currently being rendered
    })
  }

  const handleEdit = (host: BaseHost) => {
    const formData: HostFormValues = {
      remark: host.remark || '',
      address: host.address || '',
      port: host.port ? Number(host.port) : undefined,
      inbound_tag: host.inbound_tag || '',
      status: host.status || [],
      host: host.host || '',
      sni: host.sni || '',
      path: host.path || '',
      http_headers: host.http_headers || {},
      security: host.security || 'inbound_default',
      alpn: host.alpn || '',
      fingerprint: host.fingerprint || '',
      allowinsecure: host.allowinsecure || false,
      random_user_agent: host.random_user_agent || false,
      use_sni_as_host: host.use_sni_as_host || false,
      priority: host.priority || 0,
      is_disabled: host.is_disabled || false,
      fragment_settings: host.fragment_settings
        ? {
            xray: host.fragment_settings.xray ?? undefined,
            sing_box: host.fragment_settings.sing_box ?? undefined,
          }
        : undefined,
      noise_settings: host.noise_settings
        ? {
            xray: host.noise_settings.xray ?? undefined,
          }
        : undefined,
      mux_settings: host.mux_settings
        ? {
            xray: host.mux_settings.xray
              ? {
                  enable: host.mux_settings.xray.enable ?? false,
                  concurrency: host.mux_settings.xray.concurrency ?? null,
                  xudp_concurrency: host.mux_settings.xray.xudpConcurrency ?? null,
                  xudp_proxy_443: host.mux_settings.xray.xudpProxyUDP443 ?? 'reject',
                }
              : undefined,
            sing_box: host.mux_settings.sing_box
              ? {
                  enable: host.mux_settings.sing_box.enable ?? false,
                  protocol: host.mux_settings.sing_box.protocol ?? null,
                  max_connections: host.mux_settings.sing_box.max_connections ?? null,
                  max_streams: host.mux_settings.sing_box.max_streams ?? null,
                  min_streams: host.mux_settings.sing_box.min_streams ?? null,
                  padding: host.mux_settings.sing_box.padding ?? null,
                  brutal: host.mux_settings.sing_box.brutal ?? null,
                }
              : undefined,
            clash: host.mux_settings.clash
              ? {
                  enable: host.mux_settings.clash.enable ?? false,
                  protocol: host.mux_settings.clash.protocol ?? null,
                  max_connections: host.mux_settings.clash.max_connections ?? null,
                  max_streams: host.mux_settings.clash.max_streams ?? null,
                  min_streams: host.mux_settings.clash.min_streams ?? null,
                  padding: host.mux_settings.clash.padding ?? null,
                  brutal: host.mux_settings.clash.brutal ?? null,
                  statistic: host.mux_settings.clash.statistic ?? null,
                  only_tcp: host.mux_settings.clash.only_tcp ?? null,
                }
              : undefined,
          }
        : undefined,
      transport_settings: host.transport_settings
        ? {
            xhttp_settings: host.transport_settings.xhttp_settings
              ? {
                  mode: host.transport_settings.xhttp_settings.mode ?? undefined,
                  no_grpc_header: host.transport_settings.xhttp_settings.no_grpc_header === null ? undefined : !!host.transport_settings.xhttp_settings.no_grpc_header,
                  x_padding_bytes: host.transport_settings.xhttp_settings.x_padding_bytes ?? undefined,
                  sc_max_each_post_bytes: host.transport_settings.xhttp_settings.sc_max_each_post_bytes ?? undefined,
                  sc_min_posts_interval_ms: host.transport_settings.xhttp_settings.sc_min_posts_interval_ms ?? undefined,
                  sc_max_buffered_posts: host.transport_settings.xhttp_settings.sc_max_buffered_posts ?? undefined,
                  sc_stream_up_server_secs: host.transport_settings.xhttp_settings.sc_stream_up_server_secs ?? undefined,
                  download_settings: host.transport_settings.xhttp_settings.download_settings ?? undefined,
                }
              : undefined,
            grpc_settings: host.transport_settings.grpc_settings
              ? {
                  multi_mode: host.transport_settings.grpc_settings.multi_mode === null ? undefined : !!host.transport_settings.grpc_settings.multi_mode,
                  idle_timeout: host.transport_settings.grpc_settings.idle_timeout ?? undefined,
                  health_check_timeout: host.transport_settings.grpc_settings.health_check_timeout ?? undefined,
                  permit_without_stream: host.transport_settings.grpc_settings.permit_without_stream ?? undefined,
                  initial_windows_size: host.transport_settings.grpc_settings.initial_windows_size ?? undefined,
                }
              : undefined,
            kcp_settings: host.transport_settings.kcp_settings
              ? {
                  header: host.transport_settings.kcp_settings.header ?? undefined,
                  mtu: host.transport_settings.kcp_settings.mtu ?? undefined,
                  tti: host.transport_settings.kcp_settings.tti ?? undefined,
                  uplink_capacity: host.transport_settings.kcp_settings.uplink_capacity ?? undefined,
                  downlink_capacity: host.transport_settings.kcp_settings.downlink_capacity ?? undefined,
                  congestion: host.transport_settings.kcp_settings.congestion ?? undefined,
                  read_buffer_size: host.transport_settings.kcp_settings.read_buffer_size ?? undefined,
                  write_buffer_size: host.transport_settings.kcp_settings.write_buffer_size ?? undefined,
                }
              : undefined,
            tcp_settings: host.transport_settings.tcp_settings
              ? {
                  header: host.transport_settings.tcp_settings.header ?? undefined,
                  request: host.transport_settings.tcp_settings.request
                    ? {
                        version: host.transport_settings.tcp_settings.request.version ?? undefined,
                        method: host.transport_settings.tcp_settings.request.method ?? undefined,
                        headers: host.transport_settings.tcp_settings.request.headers ?? undefined,
                      }
                    : undefined,
                  response: host.transport_settings.tcp_settings.response
                    ? {
                        version: host.transport_settings.tcp_settings.response.version ?? undefined,
                        status: host.transport_settings.tcp_settings.response.status ?? undefined,
                        reason: host.transport_settings.tcp_settings.response.reason ?? undefined,
                        headers: host.transport_settings.tcp_settings.response.headers ?? undefined,
                      }
                    : undefined,
                }
              : undefined,
            websocket_settings: host.transport_settings.websocket_settings
              ? {
                  heartbeatPeriod: host.transport_settings.websocket_settings.heartbeatPeriod ?? undefined,
                }
              : undefined,
          }
        : undefined,
    }
    form.reset(formData)
    setEditingHost(host)
    onAddHost(true)
  }

  const handleDuplicate = async (host: BaseHost) => {
    if (!host) return

    try {
      // Find all hosts with priorities equal to or less than the host being duplicated
      // Get the host's index in the sorted array
      const sortedHosts = [...(hosts ?? [])].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      const hostIndex = sortedHosts.findIndex(h => h.id === host.id)

      if (hostIndex === -1) return

      // Find the next host's priority
      let newPriority: number
      if (hostIndex === sortedHosts.length - 1) {
        // If it's the last host, just add 1 to its priority
        newPriority = (host.priority ?? 0) + 1
      } else {
        // Set priority after the current host but before the next host
        // Always use an integer value
        const nextHostPriority = sortedHosts[hostIndex + 1].priority ?? hostIndex + 1
        const currentPriority = host.priority ?? 0

        if (nextHostPriority > currentPriority + 1) {
          // If there's space between priorities, simply add 1
          newPriority = currentPriority + 1
        } else {
          // Otherwise increment all priorities after this host
          newPriority = currentPriority + 1

          // Update all hosts after this one to have higher priorities
          const hostsToUpdate = sortedHosts.slice(hostIndex + 1).map(h => ({
            ...h,
            priority: (h.priority ?? 0) + 1,
          }))

          if (hostsToUpdate.length > 0) {
            // Update priorities in batch
            await modifyHosts(hostsToUpdate)
          }
        }
      }

      // Create duplicate with new priority and slightly modified name
      const newHost: CreateHost = {
        ...host,
        id: undefined, // Remove ID so a new one is generated
        remark: `${host.remark || ''} (copy)`,
        priority: newPriority,
        // Special handling for enum values
        alpn: host.alpn === '' ? undefined : host.alpn,
        fingerprint: host.fingerprint === '' ? undefined : host.fingerprint,
      }

      await createHost(newHost)

      // Show success toast
      toast.success(t('host.duplicateSuccess', { name: host.remark || '' }))

      // Refresh the hosts data
      refreshHostsData()
    } catch (error) {
      // Show error toast
      toast.error(t('host.duplicateFailed', { name: host.remark || '' }))
    }
  }
const cleanEmptyValues = (obj: any) => {
    if (!obj) return undefined
    const cleaned: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0)) {
        continue
      }
      if (typeof value === 'object') {
        const cleanedValue = cleanEmptyValues(value)
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue
        }
      } else {
        cleaned[key] = value
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined
  }


  const handleSubmit = async (data: HostFormValues) => {
    try {
      // Clean up the data before submission
      const cleanedData = {
        ...data,
        fragment_settings: data.fragment_settings
          ? {
              xray:
                data.fragment_settings.xray && (data.fragment_settings.xray.packets || data.fragment_settings.xray.length || data.fragment_settings.xray.interval)
                  ? data.fragment_settings.xray
                  : undefined,
              sing_box:
                data.fragment_settings.sing_box &&
                (data.fragment_settings.sing_box.fragment || data.fragment_settings.sing_box.fragment_fallback_delay || data.fragment_settings.sing_box.record_fragment)
                  ? data.fragment_settings.sing_box
                  : undefined,
            }
          : undefined,
        mux_settings: data.mux_settings
          ? {
              xray: data.mux_settings.xray
                ? {
                    concurrency: data.mux_settings.xray.concurrency ?? null,
                    xudp_concurrency: data.mux_settings.xray.xudp_concurrency ?? null,
                    xudp_proxy_443: data.mux_settings.xray.xudp_proxy_443 ?? 'reject',
                  }
                : undefined,
              sing_box: data.mux_settings.sing_box && data.mux_settings.sing_box.protocol !== 'none' ? data.mux_settings.sing_box : undefined,
              clash: data.mux_settings.clash && data.mux_settings.clash.protocol !== 'none' ? data.mux_settings.clash : undefined,
            }
          : undefined,
      }

      // Remove fragment_settings if it's empty
      if (cleanedData.fragment_settings && !cleanedData.fragment_settings.xray && !cleanedData.fragment_settings.sing_box) {
        delete cleanedData.fragment_settings
      }

      // Remove mux_settings if it's empty
      if (cleanedData.mux_settings && !cleanedData.mux_settings.xray && !cleanedData.mux_settings.sing_box && !cleanedData.mux_settings.clash) {
        delete cleanedData.mux_settings
      }

      const response = await onSubmit(cleanedData)
      if (response.status === 200) {
        if (editingHost?.id) {
          toast.success(t('hostsDialog.editSuccess', { name: data.remark }))
        } else {
          toast.success(t('hostsDialog.createSuccess', { name: data.remark }))
        }

        // Refresh the hosts data
        refreshHostsData()
      }
      return response
    } catch (error) {
      console.error('Error submitting form:', error)
      throw error
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setHosts(hosts => {
        if (!hosts) return []
        const oldIndex = hosts.findIndex(item => item.id === active.id)
        const newIndex = hosts.findIndex(item => item.id === over.id)
        const reorderedHosts = arrayMove(hosts, oldIndex, newIndex)

        // Update priorities based on new order (lower number = higher priority)
        return reorderedHosts.map((host, index) => ({
          ...host,
          priority: index,
        }))
      })
    }
  }

  // Debounce the host updates to prevent too many API calls
  useEffect(() => {
    if (skipNextDebounce) {
      setSkipNextDebounce(false)
      return
    }
    const handler = setTimeout(() => {
      setDebouncedHosts(hosts)
    }, 1500)

    return () => {
      clearTimeout(handler)
    }
  }, [hosts])

  // Save debounced hosts to the server
  useEffect(() => {
    const updateHosts = async () => {
      if (debouncedHosts && debouncedHosts.length > 0) {
        try {
          await modifyHosts(debouncedHosts)
          // Refresh data after modifying hosts order
          refreshHostsData()
        } catch (error) {
          console.error('Error updating host order:', error)
        }
      }
    }

    updateHosts()
  }, [debouncedHosts])

  // Filter out hosts without IDs for the sortable context
  const sortableHosts =
    hosts
      ?.filter(host => host.id !== null)
      .map(host => ({
        id: host.id as UniqueIdentifier,
      })) ?? []

  // Sort hosts by priority (lower number = higher priority)
  const sortedHosts = [...(hosts ?? [])].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

  return (
    <div>
      <div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableHosts} strategy={rectSortingStrategy}>
            <div className="max-w-screen-[2000px] min-h-screen overflow-hidden">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedHosts.map(host => (
                  <SortableHost key={host.id ?? 'new'} host={host} onEdit={handleEdit} onDuplicate={handleDuplicate} onDataChanged={refreshHostsData} />
                ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <HostModal
        isDialogOpen={isDialogOpen}
        onSubmit={handleSubmit}
        onOpenChange={open => {
          if (!open) {
            setEditingHost(null)
            form.reset(initialDefaultValues) // Reset to initial values when closing
          } else if (!editingHost) {
            // When opening for a new host, ensure form is reset to initial values
            form.reset(initialDefaultValues)
          }
          onAddHost(open)
        }}
        form={form}
        editingHost={!!editingHost}
      />
    </div>
  )
}
