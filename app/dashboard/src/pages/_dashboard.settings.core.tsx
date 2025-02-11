import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Editor from '@monaco-editor/react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTheme } from '../components/theme-provider'

const defaultConfig = {
  log: {
    loglevel: 'error',
  },
  inbounds: [
    {
      tag: 'inbound Name',
      listen: '0.0.0.0',
      port: 1122,
      protocol: 'vless',
      settings: {
        clients: [],
        decryption: 'none',
      },
      streamSettings: {
        network: 'tcp',
        tcpSettings: {},
        security: 'none',
      },
      sniffing: {},
    },
  ],
}

const sampleLogs = [
  '2021/09/22 19:36:25 from 77.33.44.11:0 accepted tcp:www.googleapis.com:80 [VLESS_WS_INBOUND >> direct] email: user5322',
  '2021/09/22 19:36:25 from 22.33.44.55:0 accepted tcp:www.google.com:443 [VLESS_WS_INBOUND >> direct] email: user123',
  '2021/09/22 19:36:25 from 22.33.44.55:0 accepted tcp:3.3.3.3:80 [VLESS_WS_INBOUND >> direct] email: user123',
]

interface ValidationResult {
  isValid: boolean
  error?: string
}

export default function CoreSettings() {
  const [config, setConfig] = useState(JSON.stringify(defaultConfig, null, 2))
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true })
  const [isEditorReady, setIsEditorReady] = useState(false)
  const { resolvedTheme } = useTheme()

  const handleEditorValidation = useCallback(
    (markers: any[]) => {
      // Monaco editor provides validation markers
      const hasErrors = markers.length > 0
      if (hasErrors) {
        setValidation({
          isValid: false,
          error: markers[0].message,
        })
      } else {
        try {
          // Additional validation - try parsing the JSON
          JSON.parse(config)
          setValidation({ isValid: true })
        } catch (e) {
          setValidation({
            isValid: false,
            error: e instanceof Error ? e.message : 'Invalid JSON',
          })
        }
      }
    },
    [config],
  )

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value) {
      setConfig(value)
    }
  }, [])

  const handleEditorDidMount = useCallback(() => {
    setIsEditorReady(true)
  }, [])

  // const handleFormat = useCallback(() => {
  //   try {
  //     const formatted = JSON.stringify(JSON.parse(config), null, 2)
  //     setConfig(formatted)
  //   } catch (e) {
  //     // If JSON is invalid, formatting will fail silently
  //   }
  // }, [config])

  const handleSave = useCallback(() => {
    if (validation.isValid) {
      // Here you would typically save the config to your backend
      console.log('Saving config:', JSON.parse(config))
    }
  }, [config, validation.isValid])

  return (
    <div className="flex flex-col gap-y-6 pt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Xray Config</CardTitle>
            <p className="text-sm">Control your server details</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" disabled={!isEditorReady || !validation.isValid}>
                Restart core
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {validation.error && !validation.isValid && (
            <Alert variant="destructive">
              <AlertDescription>{validation.error}</AlertDescription>
            </Alert>
          )}
          <div className="rounded-lg border">
            <Editor
              height="400px"
              defaultLanguage="json"
              value={config}
              theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
              onChange={handleEditorChange}
              onValidate={handleEditorValidation}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {validation.isValid ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-red-500" />}
              <span className="text-sm">{validation.isValid ? 'Valid JSON' : 'Invalid JSON'}</span>
            </span>
            <Button size="sm" onClick={handleSave} disabled={!isEditorReady || !validation.isValid}>
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Server logs</CardTitle>
            <p className="text-sm">Control your server details</p>
          </div>
          <Select defaultValue="main">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select server" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Main server</SelectItem>
              <SelectItem value="backup">Backup server</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] space-y-2 overflow-auto rounded-lg border p-4 font-mono text-sm">
            {sampleLogs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap">
                {log}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
