import { Button } from '@/components/ui/button'
import { useClipboard } from '@/hooks/use-clipboard'
import { User } from '@/types/User'
import { Check, Copy, QrCode } from 'lucide-react'
import { FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from './CopyButton'
import QRCodeModal from './dialogs/QRCodeModal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

type ActionButtonsProps = {
  user: User
}

export interface SubscribeLink {
  protocol: string
  link: string
}

const ActionButtons: FC<ActionButtonsProps> = ({ user }) => {
  const [subscribeUrl, setSubscribeUrl] = useState<string>('')
  const [subscribeLinks, setSubscribeLinks] = useState<SubscribeLink[]>([])

  const onOpenModal = useCallback(() => {
    setSubscribeUrl(user.subscription_url ? user.subscription_url : '')
  }, [user.subscription_url])

  const onCloseModal = useCallback(() => {
    setSubscribeUrl('')
  }, [])

  const { t } = useTranslation()

  useEffect(() => {
    if (user.subscription_url) {
      const subURL = user.subscription_url.startsWith('/') ? window.location.origin + user.subscription_url : user.subscription_url

      const links = [
        { protocol: 'v2ray', link: `${subURL}/v2ray` },
        { protocol: 'v2ray-json', link: `${subURL}/v2ray-json` },
        { protocol: 'clash', link: `${subURL}/clash` },
        { protocol: 'clash-meta', link: `${subURL}/clash-meta` },
        { protocol: 'outline', link: `${subURL}/outline` },
        { protocol: 'sing-box', link: `${subURL}/sing-box` },
      ]
      setSubscribeLinks(links)
    }
  }, [subscribeUrl])

  const { copy, copied } = useClipboard({ timeout: 1500 })
  const handleCopy = useCallback(
    (text: string) => {
      return copy.bind(null, text)
    },
    [copy],
  )

  return (
    <div>
      <div className="flex justify-end gap-x-4 items-center">
        <TooltipProvider>
          <CopyButton
            value={user.subscription_url ? (user.subscription_url.startsWith('/') ? window.location.origin + user.subscription_url : user.subscription_url) : ''}
            copiedMessage="usersTable.copied"
            defaultMessage="usersTable.copyLink"
            icon="link"
          />
          <Tooltip open={copied ? true : undefined}>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <TooltipTrigger>
                  <Button size="icon" variant="ghost">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {subscribeLinks.map(subLink => (
                  <DropdownMenuItem className="p-0 justify-start" key={subLink.link}>
                    <Button variant="ghost" className="w-full h-full px-2 justify-start" aria-label="Copy" onClick={handleCopy(subLink.link)}>
                      <span>{subLink.protocol}</span>
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>{copied ? t('usersTable.copied') : t('usersTable.copyConfigs')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="qr code" onClick={onOpenModal}>
                <QrCode className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>QR Code</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {subscribeUrl && <QRCodeModal subscribeLinks={subscribeLinks} subscribeUrl={subscribeUrl} onCloseModal={onCloseModal} />}
      </div>
    </div>
  )
}

export default ActionButtons
