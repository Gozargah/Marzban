/**
 * Parse user agent string to extract client information
 */

export interface ClientInfo {
  name: string
  version?: string
  platform?: string
  isKnownClient: boolean
  iconType: 'desktop' | 'mobile' | 'browser' | 'unknown'
}

export function parseUserAgent(userAgent: string | null | undefined): ClientInfo {
  if (!userAgent) {
    return {
      name: 'Unknown',
      isKnownClient: false,
      iconType: 'unknown'
    }
  }

  const ua = userAgent.toLowerCase()

  // Common VPN/Proxy clients
  const clientPatterns = [
    { pattern: /clash/, name: 'Clash', iconType: 'desktop' as const },
    { pattern: /v2rayn/, name: 'v2rayN', iconType: 'desktop' as const },
    { pattern: /v2rayng/, name: 'v2rayNG', iconType: 'mobile' as const },
    { pattern: /shadowrocket/, name: 'Shadowrocket', iconType: 'mobile' as const },
    { pattern: /quantumult/, name: 'Quantumult', iconType: 'mobile' as const },
    { pattern: /surge/, name: 'Surge', iconType: 'mobile' as const },
    { pattern: /shadowsocks/, name: 'Shadowsocks', iconType: 'desktop' as const },
    { pattern: /sing-box/, name: 'sing-box', iconType: 'desktop' as const },
    { pattern: /hiddify/, name: 'Hiddify', iconType: 'mobile' as const },
    { pattern: /fairvpn/, name: 'FairVPN', iconType: 'mobile' as const },
    { pattern: /v2box/, name: 'V2Box', iconType: 'mobile' as const },
    { pattern: /pharos/, name: 'Pharos', iconType: 'mobile' as const },
    { pattern: /napsternetv/, name: 'NapsternetV', iconType: 'mobile' as const },
    { pattern: /oneclick/, name: 'OneClick', iconType: 'mobile' as const },
    { pattern: /streisand/, name: 'Streisand', iconType: 'desktop' as const },
    { pattern: /outline/, name: 'Outline', iconType: 'desktop' as const },
    { pattern: /matsuri/, name: 'Matsuri', iconType: 'mobile' as const },
    { pattern: /sagernet/, name: 'SagerNet', iconType: 'mobile' as const },
    { pattern: /nekobox/, name: 'NekoBox', iconType: 'mobile' as const },
    { pattern: /foxray/, name: 'FoxRay', iconType: 'mobile' as const },
  ]

  // Check for known clients
  for (const client of clientPatterns) {
    if (client.pattern.test(ua)) {
      // Try to extract version
      const versionMatch = userAgent.match(new RegExp(`${client.name.toLowerCase()}[/\\s]([\\d.]+)`, 'i'))
      
      return {
        name: client.name,
        version: versionMatch?.[1],
        isKnownClient: true,
        iconType: client.iconType
      }
    }
  }

  // Check for common browsers (less likely but possible)
  if (ua.includes('chrome')) {
    return { name: 'Chrome', isKnownClient: false, iconType: 'browser' }
  }
  if (ua.includes('firefox')) {
    return { name: 'Firefox', isKnownClient: false, iconType: 'browser' }
  }
  if (ua.includes('safari')) {
    return { name: 'Safari', isKnownClient: false, iconType: 'browser' }
  }
  if (ua.includes('edge')) {
    return { name: 'Edge', isKnownClient: false, iconType: 'browser' }
  }

  // Check for mobile platforms
  if (ua.includes('android')) {
    return { name: 'Android App', platform: 'Android', isKnownClient: false, iconType: 'mobile' }
  }
  if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    return { name: 'iOS App', platform: 'iOS', isKnownClient: false, iconType: 'mobile' }
  }

  // Fallback: try to extract first word that looks like an app name
  const appMatch = userAgent.match(/^([a-zA-Z0-9]+)/i)
  if (appMatch) {
    return {
      name: appMatch[1],
      isKnownClient: false,
      iconType: 'unknown'
    }
  }

  return {
    name: 'Unknown',
    isKnownClient: false,
    iconType: 'unknown'
  }
}

export function formatClientInfo(clientInfo: ClientInfo): string {
  if (!clientInfo.isKnownClient && clientInfo.name === 'Unknown') {
    return 'Unknown client'
  }

  let result = clientInfo.name
  if (clientInfo.version) {
    result += ` ${clientInfo.version}`
  }
  if (clientInfo.platform) {
    result += ` (${clientInfo.platform})`
  }

  return result
} 