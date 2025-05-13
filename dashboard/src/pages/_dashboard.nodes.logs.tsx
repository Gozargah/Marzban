import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEffect, useState, useRef } from 'react'
import { useGetNodes } from '@/service/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { getAuthToken } from '@/utils/authStorage'
import { EventSource } from 'eventsource'

// define EventSource globally
globalThis.EventSource = EventSource

interface LogEntry {
  timestamp: string | number
  message: string
}

export default function NodeLogs() {
  const { t } = useTranslation()
  const [selectedNode, setSelectedNode] = useState<number>(0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  const { data: nodes = [] } = useGetNodes({})

  useEffect(() => {
    if (selectedNode === 0) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const baseUrl = import.meta.env.VITE_BASE_API || ''
    const token = getAuthToken()
    const eventSource = new EventSource(`${baseUrl}/api/node/${selectedNode}/logs`, {
      fetch: (input: Request | URL | string, init?: RequestInit) => {
        const headers = new Headers(init?.headers || {})
        headers.set('Authorization', `Bearer ${token}`)
        return fetch(input, {
          ...init,
          headers,
        })
      }
    } as any)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      let logEntry: LogEntry
      try {
        logEntry = JSON.parse(event.data)
      } catch {
        // If not JSON, treat as plain string
        logEntry = {
          timestamp: Date.now(),
          message: event.data,
        }
      }
      setLogs(prevLogs => {
        const newLogs = [...prevLogs, logEntry]
        return newLogs.slice(-1000)
      })
    }

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error)
      eventSource.close()
      setIsLoading(false)
    }

    eventSource.onopen = () => {
      console.log('SSE connection opened')
      setIsLoading(false)
    }

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [selectedNode])

  return (
    <div className="flex flex-col gap-2 w-full items-start">
      <div className="px-4 w-full pt-2">
        <div className="mb-4">
          <Label htmlFor="node-select">{t('nodes.title')}</Label>
          <Select
            value={selectedNode.toString()}
            onValueChange={(value) => setSelectedNode(Number(value))}
          >
            <SelectTrigger id="node-select" className="w-[200px] mt-2">
              <SelectValue placeholder={t('nodes.selectNode')} />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((node) => (
                <SelectItem key={node.id} value={node.id.toString()}>
                  {node.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card>
          <CardContent className="p-4">
            <ScrollArea className="h-[600px] w-full rounded-md border p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">{t('loading')}</p>
                </div>
              ) : selectedNode === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">{t('nodes.selectNode')}</p>
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.map((log, index) => {
                    // Extract log level (e.g., [Info], [Warning], [Error])
                    const match = log.message.match(/(\[(Info|Warning|Error)\])/)
                    let color = 'text-foreground'
                    if (match) {
                      if (match[1] === '[Info]') color = 'text-blue-500'
                      else if (match[1] === '[Warning]') color = 'text-yellow-500'
                      else if (match[1] === '[Error]') color = 'text-red-500'
                    }
                    return (
                      <div key={`${log.timestamp}-${index}`} className="text-sm font-mono flex items-center gap-2">
                        {match ? (
                          <>
                            <span className={color}>{match[1]}</span>
                            <span>{log.message.replace(match[1], '')}</span>
                          </>
                        ) : (
                          <span>{log.message}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">{t('nodes.logs.noLogs')}</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 