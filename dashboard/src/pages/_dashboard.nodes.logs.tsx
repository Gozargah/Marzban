import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useGetNodes } from '@/service/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { getAuthToken } from '@/utils/authStorage'
import { EventSource } from 'eventsource'
import { ChevronDown, ArrowDown, Terminal, Clock, Search, ArrowDownCircle, FilterIcon, XIcon, DatabaseIcon, InfinityIcon, AlertTriangleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// define EventSource globally
globalThis.EventSource = EventSource

type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'none'

interface LogEntry {
  timestamp: string | number
  message: string
  level: LogLevel
}

export default function NodeLogs() {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [selectedNode, setSelectedNode] = useState<number>(0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showTimestamps, setShowTimestamps] = useState(false)
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>(['debug', 'info', 'warning', 'error'])
  const [searchQuery, setSearchQuery] = useState('')
  const [maxLogsCount, setMaxLogsCount] = useState(1000)
  const [isUnlimited, setIsUnlimited] = useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const logsRef = useRef<LogEntry[]>([])
  const pendingLogsRef = useRef<LogEntry[]>([])
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const maxStorageLogsRef = useRef<number>(10000)
  const isNodeSwitchingRef = useRef<boolean>(false)
  const lastScrollTopRef = useRef<number>(0)
  const wasAtBottomRef = useRef<boolean>(true)

  const { data: nodes = [] } = useGetNodes({})

  const logLevelColors = {
    debug: 'text-gray-500 dark:text-gray-400',
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
    none: 'text-foreground',
  }

  const logBadgeColors = {
    debug: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-300 dark:border-red-700',
    none: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600',
  }

  const logIconColors = {
    debug: 'text-gray-500 dark:text-gray-400',
    info: 'text-blue-500 dark:text-blue-400',
    warning: 'text-amber-500 dark:text-amber-400',
    error: 'text-red-500 dark:text-red-400',
    none: 'text-gray-500 dark:text-gray-400',
  }

  const determineLogLevel = (message: string): LogLevel => {
    const lowerMessage = message.toLowerCase()

    // First check for exact matches with brackets
    if (lowerMessage.includes('[error]')) return 'error'
    if (lowerMessage.includes('[warning]') || lowerMessage.includes('[warn]')) return 'warning'
    if (lowerMessage.includes('[info]')) return 'info'
    if (lowerMessage.includes('[debug]')) return 'debug'

    // Then check for other patterns
    if (lowerMessage.includes('warning:') || lowerMessage.includes('warn:')) return 'warning'
    if (lowerMessage.includes('info:') || lowerMessage.includes('inf:')) return 'info'
    if (lowerMessage.includes('debug:') || lowerMessage.includes('dbg:')) return 'debug'

    // Check for common patterns in the message
    if (lowerMessage.includes('warning')) return 'warning'
    if (lowerMessage.includes('info') || lowerMessage.includes('information')) return 'info'
    if (lowerMessage.includes('debug')) return 'debug'

    // Default to info for connection logs and other common patterns
    if (lowerMessage.includes('from') || lowerMessage.includes('connected') || lowerMessage.includes('connection')) return 'info'

    // If no level is detected, default to info
    return 'info'
  }

  // Reset all log-related state when node changes
  const resetLogState = useCallback(() => {
    setLogs([])
    setFilteredLogs([])
    logsRef.current = []
    pendingLogsRef.current = []
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current)
      updateTimerRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsLoading(true)
    isNodeSwitchingRef.current = true
  }, [selectedNode])

  // Handle node selection change
  const handleNodeChange = useCallback(
    (nodeId: number) => {
      resetLogState()
      setSelectedNode(nodeId)
    },
    [resetLogState],
  )

  useEffect(() => {
    if (selectedNode === 0) {
      setIsLoading(false)
      return
    }

    const baseUrl =
      import.meta.env.VITE_BASE_API && typeof import.meta.env.VITE_BASE_API === 'string' && import.meta.env.VITE_BASE_API.trim() !== '/' && import.meta.env.VITE_BASE_API.startsWith('http')
        ? import.meta.env.VITE_BASE_API
        : window.location.origin
    const token = getAuthToken()

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const url = `${baseUrl}/api/node/${selectedNode}/logs`
    const eventSource = new EventSource(url, {
      fetch: (input: Request | URL | string, init?: RequestInit) => {
        const headers = new Headers(init?.headers || {})
        headers.set('Authorization', `Bearer ${token}`)
        return fetch(input, {
          ...init,
          headers,
        })
      },
    } as any)

    eventSourceRef.current = eventSource

    let isProcessing = false

    const setupBatchUpdateTimer = () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current)
      }

      updateTimerRef.current = setTimeout(() => {
        if (pendingLogsRef.current.length > 0 && !isProcessing) {
          isProcessing = true
          try {
            const combinedLogs = [...logsRef.current, ...pendingLogsRef.current]
            const storageLimit = isUnlimited ? Number.MAX_SAFE_INTEGER : maxStorageLogsRef.current
            const trimmedLogs = combinedLogs.length > storageLimit ? combinedLogs.slice(-storageLimit) : combinedLogs

            logsRef.current = trimmedLogs
            pendingLogsRef.current = []
            setLogs(trimmedLogs)
          } catch (error) {
            console.error('Error processing logs:', error)
          } finally {
            isProcessing = false
          }
        }

        setupBatchUpdateTimer()
      }, 1000)
    }

    setupBatchUpdateTimer()

    eventSource.onmessage = event => {
      try {
        let logEntry: Partial<LogEntry>
        try {
          logEntry = JSON.parse(event.data)
        } catch {
          logEntry = {
            timestamp: Date.now(),
            message: event.data,
          }
        }

        const level = determineLogLevel(logEntry.message || '')
        const newEntry: LogEntry = {
          timestamp: logEntry.timestamp || Date.now(),
          message: logEntry.message || '',
          level,
        }

        pendingLogsRef.current.push(newEntry)
      } catch (error) {
        console.error('Error processing message:', error)
      }
    }

    eventSource.onerror = error => {
      console.error('SSE Error:', error)
      eventSource.close()
      setIsLoading(false)
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current)
        updateTimerRef.current = null
      }
    }

    eventSource.onopen = () => {
      setIsLoading(false)
      isNodeSwitchingRef.current = false
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current)
        updateTimerRef.current = null
      }
    }
  }, [selectedNode, isUnlimited])

  // Filter logs based on selected levels and search query
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      try {
        const visibleLogs = logs.filter(log => {
          const levelMatch = selectedLevels.includes(log.level)
          const searchMatch = searchQuery === '' || log.message.toLowerCase().includes(searchQuery.toLowerCase())
          return levelMatch && searchMatch
        })

        const filteredLogs = isUnlimited ? visibleLogs : visibleLogs.slice(-maxLogsCount)

        setFilteredLogs(filteredLogs)
      } catch (error) {
        console.error('Error filtering logs:', error)
      }
    }, 100)

    return () => clearTimeout(debounceTimer)
  }, [logs, selectedLevels, searchQuery, maxLogsCount, isUnlimited])

  // Initialize with all log levels selected
  useEffect(() => {
    setSelectedLevels(['debug', 'info', 'warning', 'error'])
  }, [])

  // For windowed rendering
  const [visibleStartIndex, setVisibleStartIndex] = useState(0)
  const itemHeight = 36 // Approximate height of a log entry in pixels
  const bufferSize = 50 // Number of items to render outside visible area
  const containerHeight = 600 // Container height in pixels
  const visibleItemsCount = Math.ceil(containerHeight / itemHeight) + 2 * bufferSize

  // Auto-scroll effect - completely rewritten for proper behavior
  useEffect(() => {
    if (!logsContainerRef.current || isNodeSwitchingRef.current) {
      return
    }

    const container = logsContainerRef.current
    
    if (autoScroll) {
      // If auto-scroll is enabled, always scroll to bottom immediately
      container.scrollTop = container.scrollHeight
      lastScrollTopRef.current = container.scrollHeight
      wasAtBottomRef.current = true
      
      // Update visible window for windowed rendering
      if (filteredLogs.length > 0) {
        const maxStartIndex = Math.max(0, filteredLogs.length - visibleItemsCount)
        setVisibleStartIndex(maxStartIndex)
      }
    } else {
      // Auto-scroll is OFF - force maintain exact position
      const savedScrollTop = lastScrollTopRef.current
      
      // Use multiple methods to ensure position is maintained
      container.scrollTop = savedScrollTop
      
      // Double-check with requestAnimationFrame
      requestAnimationFrame(() => {
        if (container && container.scrollTop !== savedScrollTop) {
          container.scrollTop = savedScrollTop
        }
      })
      
      // Triple-check with setTimeout as fallback
      setTimeout(() => {
        if (container && container.scrollTop !== savedScrollTop) {
          container.scrollTop = savedScrollTop
        }
      }, 0)
    }
  }, [filteredLogs, autoScroll, visibleItemsCount])

  // Handle scroll events - improved logic
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isNodeSwitchingRef.current) return

    const container = e.currentTarget
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    
    // Always update last scroll position when user manually scrolls
    lastScrollTopRef.current = scrollTop
    
    // Calculate visible start index for windowed rendering
    const firstVisibleIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize)
    setVisibleStartIndex(firstVisibleIndex)
    
    // Check if user is at the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 5
    wasAtBottomRef.current = isAtBottom
    
    // Auto-disable auto-scroll only if user deliberately scrolls up
    if (autoScroll && !isAtBottom) {
      setAutoScroll(false)
    }
  }, [autoScroll, bufferSize, itemHeight])

  const scrollToBottom = () => {
    if (logsContainerRef.current) {
      const container = logsContainerRef.current
      
      // Immediately scroll to bottom
      container.scrollTop = container.scrollHeight
      lastScrollTopRef.current = container.scrollHeight
      wasAtBottomRef.current = true
      
      // Enable auto-scroll
      setAutoScroll(true)
      
      // Update visible window
      if (filteredLogs.length > 0) {
        const maxStartIndex = Math.max(0, filteredLogs.length - visibleItemsCount)
        setVisibleStartIndex(maxStartIndex)
      }
    }
  }

  // Reset scroll state when node changes
  useEffect(() => {
    if (selectedNode !== 0 && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = 0
      lastScrollTopRef.current = 0
      wasAtBottomRef.current = true
      setVisibleStartIndex(0)
    }
  }, [selectedNode])

  // Handle auto-scroll toggle - simplified
  useEffect(() => {
    if (autoScroll && logsContainerRef.current && filteredLogs.length > 0) {
      // When auto-scroll is turned on, immediately go to bottom
      const container = logsContainerRef.current
      container.scrollTop = container.scrollHeight
      lastScrollTopRef.current = container.scrollHeight
      wasAtBottomRef.current = true
      
      if (filteredLogs.length > 0) {
        const maxStartIndex = Math.max(0, filteredLogs.length - visibleItemsCount)
        setVisibleStartIndex(maxStartIndex)
      }
    }
    // When auto-scroll is turned off, we don't need to do anything special
    // The main useEffect will handle position maintenance
  }, [autoScroll, filteredLogs.length, visibleItemsCount])

  // Calculate the items to display in the window
  const visibleLogs = useMemo(() => {
    if (filteredLogs.length === 0) return []

    // Calculate end index ensuring we don't go out of bounds
    const endIndex = Math.min(visibleStartIndex + visibleItemsCount, filteredLogs.length)

    // Get the slice of logs that should be visible
    return filteredLogs.slice(Math.max(0, visibleStartIndex), endIndex)
  }, [filteredLogs, visibleStartIndex, visibleItemsCount])

  // Calculate total content height for proper scrolling
  const totalContentHeight = filteredLogs.length * itemHeight

  // Calculate offset for the visible items
  const offsetY = Math.max(0, visibleStartIndex * itemHeight)

  const toggleLogLevel = (level: LogLevel) => {
    setSelectedLevels(prev => (prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]))
  }

  const clearLogs = () => {
    setLogs([])
  }

  // Format timestamp function
  const formatTimestamp = (timestamp: string | number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const getLevelName = (level: LogLevel) => {
    const keys = {
      debug: t('nodes.logs.debug', { defaultValue: 'DEBUG' }),
      info: t('nodes.logs.info', { defaultValue: 'INFO' }),
      warning: t('nodes.logs.warning', { defaultValue: 'WARNING' }),
      error: t('nodes.logs.error', { defaultValue: 'ERROR' }),
      none: '',
    }
    return keys[level].toUpperCase()
  }

  // Add handler for setting log limit and closing popover
  const handleSetLogLimit = (unlimited: boolean, count?: number) => {
    setIsUnlimited(unlimited)
    if (!unlimited && count) {
      setMaxLogsCount(count)
    } else if (unlimited) {
      setMaxLogsCount(Number.MAX_SAFE_INTEGER)
    }
    setIsPopoverOpen(false)
  }

  // Add a useEffect for window resize events
  useEffect(() => {
    const handleResize = () => {
      if (logsContainerRef.current) {
        // Force recalculation of visible items
        if (filteredLogs.length > 0) {
          const currScrollTop = logsContainerRef.current.scrollTop
          const firstVisibleIndex = Math.max(0, Math.floor(currScrollTop / itemHeight) - bufferSize)
          setVisibleStartIndex(firstVisibleIndex)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [itemHeight, bufferSize, filteredLogs.length])

  return (
    <div className={cn('flex flex-col gap-2 w-full', dir === 'rtl' && 'rtl')}>
      <div className="w-full pt-2">
        <div className={cn('flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-end md:justify-between gap-4 mb-4 py-2')}>
          <div className={cn('flex flex-col sm:flex-row items-start sm:items-center gap-4')}>
            <div className="w-full sm:w-auto">
              <Label htmlFor="node-select" className="mb-1 block text-sm">
                {t('nodes.title')}
              </Label>
              <Select value={selectedNode.toString()} onValueChange={value => handleNodeChange(Number(value))}>
                <SelectTrigger id="node-select" className="w-full sm:w-[200px] h-8 text-xs sm:text-sm">
                  <SelectValue placeholder={t('nodes.selectNode')} />
                </SelectTrigger>
                <SelectContent>
                  {nodes.map(node => (
                    <SelectItem key={node.id} value={node.id.toString()} className="text-xs sm:text-sm">
                      {node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-auto">
              <Label htmlFor="log-levels" className="mb-1 block text-sm">
                {t('nodes.logs.filter', { defaultValue: 'Filter Logs' })}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto flex items-center justify-between gap-2 h-8 text-xs sm:text-sm">
                    <div className="flex items-center gap-1">
                      <FilterIcon size={12} className="mr-1" />
                      <span>{t('nodes.logs.levels', { defaultValue: 'Log Levels' })}</span>
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {selectedLevels.length}
                      </Badge>
                    </div>
                    <ChevronDown size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[180px]">
                  {(['debug', 'info', 'warning', 'error'] as LogLevel[]).map(level => (
                    <DropdownMenuCheckboxItem key={level} checked={selectedLevels.includes(level)} onCheckedChange={() => toggleLogLevel(level)} className="flex items-center gap-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 w-full">
                        <Badge variant="outline" className={cn('shrink-0', logBadgeColors[level], 'text-xs')}>
                          {getLevelName(level)}
                        </Badge>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="w-full sm:w-auto">
              <Label htmlFor="search-logs" className="mb-1 block text-sm">
                {t('search')}
              </Label>
              <div className="relative flex items-center">
                <Search className="absolute left-2 h-3 w-3 text-muted-foreground" />
                <Input
                  id="search-logs"
                  placeholder={t('nodes.logs.search', { defaultValue: 'Search logs' })}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-7 w-full sm:w-[220px] h-8 text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className={cn('flex flex-wrap items-center gap-2', dir === 'rtl' && 'flex-row-reverse')}>
            <div className={cn('flex items-center gap-1 mr-1', dir === 'rtl' && 'flex-row-reverse ml-1 mr-0')}>
              <Label htmlFor="show-timestamps" className="text-xs whitespace-nowrap">
                <Clock size={10} className={cn('inline mr-1 opacity-70', dir === 'rtl' && 'ml-1 mr-0')} />
                {t('nodes.logs.timestamps', { defaultValue: 'Timestamps' })}
              </Label>
              <Switch id="show-timestamps" checked={showTimestamps} onCheckedChange={setShowTimestamps} className="scale-75 sm:scale-90" />
            </div>

            <div className={cn('flex items-center gap-1 mr-1', dir === 'rtl' && 'flex-row-reverse ml-1 mr-0')}>
              <Label htmlFor="auto-scroll" className="text-xs whitespace-nowrap">
                <ArrowDownCircle size={10} className={cn('inline mr-1 opacity-70', dir === 'rtl' && 'ml-1 mr-0')} />
                {t('nodes.logs.autoScroll', { defaultValue: 'Auto Scroll' })}
              </Label>
              <Switch
                id="auto-scroll"
                checked={autoScroll}
                onCheckedChange={setAutoScroll}
                className="scale-75 sm:scale-90"
              />
            </div>

            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-8 gap-1 text-xs', isUnlimited && 'border-amber-500 dark:border-amber-400')}>
                        <DatabaseIcon size={12} className="opacity-70" />
                        {isUnlimited ? (
                          <span className="flex items-center">
                            <InfinityIcon size={14} className="mr-1 text-amber-500 dark:text-amber-400" />
                            {t('nodes.logs.unlimited')}
                          </span>
                        ) : (
                          <span>{maxLogsCount.toLocaleString()}</span>
                        )}
                        <ChevronDown size={14} />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">{t('nodes.logs.maxLogsTooltip')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <PopoverContent className="w-56 p-3" align="end">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-sm">{t('nodes.logs.memory')}</h4>
                    {isUnlimited && (
                      <Badge variant="outline" className="text-xs text-amber-500 border-amber-500 dark:text-amber-400 dark:border-amber-400">
                        <AlertTriangleIcon size={10} className="mr-1" />
                        {t('nodes.logs.unlimited')}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button variant={isUnlimited ? 'default' : 'outline'} size="sm" className="justify-start text-xs" onClick={() => handleSetLogLimit(true)}>
                      <InfinityIcon size={12} className="mr-2 opacity-70" />
                      {t('nodes.logs.unlimited')}
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={!isUnlimited && maxLogsCount === 1000 ? 'default' : 'outline'} size="sm" className="justify-start text-xs" onClick={() => handleSetLogLimit(false, 1000)}>
                        1,000
                      </Button>
                      <Button variant={!isUnlimited && maxLogsCount === 5000 ? 'default' : 'outline'} size="sm" className="justify-start text-xs" onClick={() => handleSetLogLimit(false, 5000)}>
                        5,000
                      </Button>
                      <Button variant={!isUnlimited && maxLogsCount === 10000 ? 'default' : 'outline'} size="sm" className="justify-start text-xs" onClick={() => handleSetLogLimit(false, 10000)}>
                        10,000
                      </Button>
                      <Button variant={!isUnlimited && maxLogsCount === 50000 ? 'default' : 'outline'} size="sm" className="justify-start text-xs" onClick={() => handleSetLogLimit(false, 50000)}>
                        50,000
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 text-[10px] text-muted-foreground flex items-start gap-1">
                    <AlertTriangleIcon size={10} className="mt-0.5 shrink-0 text-amber-500" />
                    <span>{t('nodes.logs.memoryWarning')}</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button onClick={scrollToBottom} size="icon" variant="outline" className="flex items-center gap-1 text-xs" title={t('nodes.logs.scrollToEnd', { defaultValue: 'Scroll to End' })}>
              <ArrowDown />
            </Button>

            <Button onClick={clearLogs} size="icon" variant="outline" className="flex items-center gap-1 text-xs" title={t('nodes.logs.clear', { defaultValue: 'Clear Logs' })}>
              <XIcon />
            </Button>
          </div>
        </div>

        <Card className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationFillMode: 'both' }}>
          <CardContent dir="ltr" className="p-4">
            <div className="h-[600px] w-full rounded-md overflow-auto" ref={logsContainerRef} onScroll={handleScroll}>
              <div className="p-1">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full animate-pulse">
                    <p className="text-muted-foreground">{t('loading')}</p>
                  </div>
                ) : selectedNode === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">{t('nodes.selectNode')}</p>
                  </div>
                ) : filteredLogs.length > 0 ? (
                  <div style={{ height: `${totalContentHeight}px`, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${offsetY}px)` }}>
                      {visibleLogs.map((log, index) => (
                        <div key={`${log.timestamp}-${visibleStartIndex + index}`} className="text-sm font-mono p-2 mb-1 border-b border-muted last:border-b-0 hover:bg-muted/20 transition-colors">
                          <div className="flex flex-wrap items-start gap-2">
                            {showTimestamps && (
                              <div className="shrink-0 text-xs text-muted-foreground flex items-center gap-1 min-w-[85px]">
                                <Clock size={10} className="opacity-60" />
                                {formatTimestamp(log.timestamp)}
                              </div>
                            )}
                            <Badge variant="outline" className={`shrink-0 ${logBadgeColors[log.level]}`}>
                              <Terminal size={12} className={`mr-1 ${logIconColors[log.level]}`} />
                              <span className={cn(logLevelColors[log.level], 'text-xs font-body')}>{getLevelName(log.level)}</span>
                            </Badge>
                            <span className="break-words text-foreground">{log.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">{t('nodes.logs.noLogs')}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
