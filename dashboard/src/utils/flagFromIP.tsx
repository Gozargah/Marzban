import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Monitor } from 'lucide-react'

interface FlagFromIPProps {
  ip: string
}

// Helper to check if a string is an IP address
const isIPAddress = (input: string) => {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(input)) return true
  // IPv6 (very basic check)
  if (/^[0-9a-fA-F:]+$/.test(input) && input.includes(':')) return true
  return false
}

const FlagFromIP: React.FC<FlagFromIPProps> = ({ ip }) => {
  const [flag, setFlag] = useState<string | null>(null)

  // Show Lucide icon for localhost or 127.0.0.1
  if (ip === '127.0.0.1' || ip === 'localhost') {
    return <Monitor size={16} className="inline align-text-bottom text-muted-foreground" />
  }

  const generateFlagEmoji = (countryCode: string): string => {
    const baseCodePoint = 127397 // Base code point for flags
    return String.fromCodePoint(baseCodePoint + countryCode.charCodeAt(0)) + String.fromCodePoint(baseCodePoint + countryCode.charCodeAt(1))
  }

  const fetchFlag = async (ipOrDomain: string) => {
    let targetIP = ipOrDomain
    try {
      if (!isIPAddress(ipOrDomain)) {
        // Resolve domain to IP using DNS-over-HTTPS (Google)
        const dnsRes = await axios.get(`https://dns.google/resolve?name=${encodeURIComponent(ipOrDomain)}&type=A`)
        const answer = dnsRes.data?.Answer?.find((a: any) => a.type === 1) // type 1 = A record
        if (answer && answer.data) {
          targetIP = answer.data
        } else {
          setFlag('') // Show nothing
          return
        }
      }
      const { data } = await axios.get(`https://freeipapi.com/api/json/${targetIP}`)
      if (data && data.countryCode) {
        const countryCode = data.countryCode.toUpperCase()
        const flagEmoji = generateFlagEmoji(countryCode)
        setFlag(flagEmoji)
      } else {
        setFlag('')
      }
    } catch (error) {
      console.error(error)
      setFlag('')
    }
  }

  useEffect(() => {
    if (ip) {
      setFlag(null)
      fetchFlag(ip)
    }
  }, [ip])

  if (flag) return <span>{flag}</span>
  if (flag === null) return <span>🌐</span>
  return null
}

export default FlagFromIP
