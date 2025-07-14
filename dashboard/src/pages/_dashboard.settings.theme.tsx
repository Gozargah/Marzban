import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useTheme, colorThemes, type ColorTheme, type Radius } from '@/components/theme-provider'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Palette, CheckCircle2, Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'

const colorThemeData = [
  { name: 'default', label: 'theme.default', dot: '#2563eb' },
  { name: 'red', label: 'theme.red', dot: '#ef4444' },
  { name: 'rose', label: 'theme.rose', dot: '#e11d48' },
  { name: 'orange', label: 'theme.orange', dot: '#f97316' },
  { name: 'green', label: 'theme.green', dot: '#22c55e' },
  { name: 'blue', label: 'theme.blue', dot: '#3b82f6' },
  { name: 'yellow', label: 'theme.yellow', dot: '#eab308' },
  { name: 'violet', label: 'theme.violet', dot: '#8b5cf6' },
] as const

const radiusOptions = [
  { value: '0', label: 'theme.radiusNone', description: '0px' },
  { value: '0.3rem', label: 'theme.radiusSmall', description: '0.3rem' },
  { value: '0.5rem', label: 'theme.radiusMedium', description: '0.5rem' },
  { value: '0.75rem', label: 'theme.radiusLarge', description: '0.75rem' },
] as const

export default function ThemeSettings() {
  const { t } = useTranslation()
  const { 
    theme, 
    colorTheme, 
    radius, 
    resolvedTheme,
    setTheme, 
    setColorTheme, 
    setRadius,
    resetToDefaults,
    isSystemTheme 
  } = useTheme()
  
  const [isResetting, setIsResetting] = useState(false)

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    
    // Get the appropriate icon for the toast
    const getThemeIcon = (theme: string) => {
      switch (theme) {
        case 'light': return '☀️'
        case 'dark': return '🌙'
        case 'system': return '💻'
        default: return '🎨'
      }
    }
    
    toast.success(t('success'), {
      description: `${getThemeIcon(newTheme)} ${t('theme.themeChanged')}`,
      duration: 2000,
    })
  }

  const handleColorChange = (colorName: string) => {
    if (Object.keys(colorThemes).includes(colorName)) {
      setColorTheme(colorName as ColorTheme)
      
      // Get the color dot for the toast
      const colorData = colorThemeData.find(c => c.name === colorName)
      const colorEmoji = '🎨'
      
      toast.success(t('success'), {
        description: `${colorEmoji} ${t('theme.themeSaved')} - ${t(colorData?.label || '')}`,
        duration: 2000,
      })
    }
  }

  const handleRadiusChange = (radiusValue: string) => {
    if (['0', '0.3rem', '0.5rem', '0.75rem'].includes(radiusValue)) {
      setRadius(radiusValue as Radius)
      
      const radiusData = radiusOptions.find(r => r.value === radiusValue)
      
      toast.success(t('success'), {
        description: `📐 ${t('theme.radiusSaved')} - ${t(radiusData?.label || '')}`,
        duration: 2000,
      })
    }
  }

  const handleResetToDefaults = async () => {
    setIsResetting(true)
    try {
      resetToDefaults()
      toast.success(t('success'), {
        description: '🔄 ' + t('theme.resetSuccess'),
        duration: 3000,
      })
    } catch (error) {
      toast.error(t('error'), {
        description: '❌ ' + t('theme.resetFailed'),
        duration: 3000,
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 mt-6 pb-8">
      {/* Header Section */}
      <div className="space-y-1 px-4">
        <h2 className="text-2xl font-semibold tracking-tight">{t('theme.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('theme.description')}</p>
      </div>

      {/* Theme Mode Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center">
              <Palette className="h-3 w-3 text-primary" />
            </div>
            <CardTitle className="text-lg">{t('theme.mode')}</CardTitle>
          </div>
          <CardDescription className="text-sm">
            {t('theme.modeDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <RadioGroup 
            value={theme} 
            onValueChange={handleThemeChange} 
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <div className="relative">
              <RadioGroupItem value="light" id="light" className="peer sr-only" />
              <Label
                htmlFor="light"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-background p-6 hover:bg-accent/50 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary transition-all cursor-pointer group"
              >
                <div className="mb-3 p-2 rounded-md bg-gradient-to-br from-orange-400 to-orange-600 text-white">
                  <Sun className="h-5 w-5" />
                </div>
                <span className="font-medium">{t('theme.light')}</span>
                <span className="text-xs text-muted-foreground mt-1">{t('theme.lightDescription')}</span>
                {theme === 'light' && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
                )}
              </Label>
            </div>
            
            <div className="relative">
              <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
              <Label
                htmlFor="dark"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-background p-6 hover:bg-accent/50 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary transition-all cursor-pointer group"
              >
                <div className="mb-3 p-2 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 text-white">
                  <Moon className="h-5 w-5" />
                </div>
                <span className="font-medium">{t('theme.dark')}</span>
                <span className="text-xs text-muted-foreground mt-1">{t('theme.darkDescription')}</span>
                {theme === 'dark' && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
                )}
              </Label>
            </div>
            
            <div className="relative">
              <RadioGroupItem value="system" id="system" className="peer sr-only" />
              <Label
                htmlFor="system"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-background p-6 hover:bg-accent/50 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary transition-all cursor-pointer group"
              >
                <div className="mb-3 p-2 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  <Monitor className="h-5 w-5" />
                </div>
                <span className="font-medium">{t('theme.system')}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {isSystemTheme ? `${t('theme.systemDescription')} (${resolvedTheme === 'dark' ? t('theme.dark') : t('theme.light')})` : t('theme.systemDescription')}
                </span>
                {theme === 'system' && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
                )}
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Color Theme Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
              </svg>
            </div>
            <CardTitle className="text-lg">{t('theme.color')}</CardTitle>
          </div>
          <CardDescription className="text-sm">
            {t('theme.colorDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {colorThemeData.map(color => (
              <button
                key={color.name}
                onClick={() => handleColorChange(color.name)}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-200 hover:scale-[1.02] group',
                  colorTheme === color.name 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : 'border-border bg-background hover:border-primary/50 hover:bg-accent/50'
                )}
                aria-label={color.label}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className={cn(
                      "w-6 h-6 rounded-full border-2 shadow-sm transition-transform group-hover:scale-110",
                      colorTheme === color.name ? "border-white shadow-md" : "border-border"
                    )} 
                    style={{ background: color.dot }} 
                  />
                  {colorTheme === color.name && (
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <span className="text-sm font-medium">{t(color.label)}</span>
                {colorTheme === color.name && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Border Radius Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect width="18" height="18" x="3" y="3" rx="6"/>
              </svg>
              </div>
            <CardTitle className="text-lg">{t('theme.radius')}</CardTitle>
          </div>
          <CardDescription className="text-sm">
            {t('theme.radiusDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <RadioGroup 
            value={radius} 
            onValueChange={handleRadiusChange} 
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {radiusOptions.map((option) => (
              <div key={option.value} className="relative">
                <RadioGroupItem value={option.value} id={`radius-${option.value}`} className="peer sr-only" />
                <Label
                  htmlFor={`radius-${option.value}`}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent/50 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary transition-all cursor-pointer"
                >
                  <div className="mb-3 p-3 bg-muted border" style={{ borderRadius: option.value }}>
                    <div className="w-4 h-4 bg-primary/20" style={{ borderRadius: option.value }} />
                  </div>
                  <span className="text-sm font-medium">{t(option.label)}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                  {radius === option.value && (
                    <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-3-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <CardTitle className="text-lg">{t('theme.preview')}</CardTitle>
          </div>
          <CardDescription className="text-sm">
            {t('theme.previewDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="p-6 rounded-lg border bg-card space-y-4" style={{ borderRadius: radius }}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold">{t('theme.dashboardPreview')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('theme.currentTheme')}: {t(colorThemeData.find(c => c.name === colorTheme)?.label || '')} • {resolvedTheme === 'dark' ? t('theme.dark') : t('theme.light')}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <div className="h-3 w-3 rounded-full bg-muted" />
                <div className="h-3 w-3 rounded-full bg-accent" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 bg-primary rounded" style={{ borderRadius: radius }} />
                <div className="h-4 bg-muted rounded" style={{ borderRadius: radius }} />
                <div className="h-4 bg-accent rounded" style={{ borderRadius: radius }} />
              </div>
              <div className="space-y-2">
                <div className="h-8 bg-background border rounded flex items-center px-3" style={{ borderRadius: radius }}>
                  <span className="text-sm text-muted-foreground">{t('theme.sampleInput')}</span>
                </div>
                <div className="h-8 bg-primary text-primary-foreground rounded flex items-center justify-center" style={{ borderRadius: radius }}>
                  <span className="text-sm font-medium">{t('theme.primaryButton')}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Section */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">{t('theme.resetToDefaults')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('theme.resetDescription')}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleResetToDefaults}
              disabled={isResetting}
            >
              {isResetting ? t('theme.resetting') : t('theme.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
