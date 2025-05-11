import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useClipboard } from '@/hooks/use-clipboard'
import { Check, Copy, Link } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface CopyButtonProps {
  value: string
  className?: string
  copiedMessage?: string
  defaultMessage?: string
  icon?: 'copy' | 'link'
  onClick?: (e: React.MouseEvent) => void
}

export function CopyButton({ value, className, copiedMessage = 'Copied!', defaultMessage = 'Click to copy', icon = 'copy', onClick }: CopyButtonProps) {
  const { t } = useTranslation()

  const { copy, copied } = useClipboard({ timeout: 1500 })
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      copy(value)
      onClick?.(e)
    },
    [copy, value, onClick],
  )

  return (
    <Tooltip open={copied ? true : undefined}>
      <TooltipTrigger asChild>
        <div>
          <Button 
            type="button"
            size="icon" 
            variant="ghost" 
            className={className} 
            aria-label="Copy to clipboard" 
            onClick={handleCopy}
          >
            {copied ? <Check className="h-4 w-4" /> : icon === 'copy' ? <Copy className="h-4 w-4" /> : <Link className="h-4 w-4" />}
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{copied ? t(copiedMessage) : t(defaultMessage)}</p>
      </TooltipContent>
    </Tooltip>
  )
}
