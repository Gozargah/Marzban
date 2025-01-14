import { UserResponse } from '@/service/api'

export type Status = 'active' | 'disabled' | 'limited' | 'expired' | 'on_hold' | 'error' | 'connecting' | 'connected'
export type ProxyKeys = ('vmess' | 'vless' | 'trojan' | 'shadowsocks')[]
export type ProxyType = {
  vmess?: {
    id?: string
  }
  vless?: {
    id?: string
    flow?: string
  }
  trojan?: {
    password?: string
  }
  shadowsocks?: {
    password?: string
    method?: string
  }
}

export type DataLimitResetStrategy = 'no_reset' | 'day' | 'week' | 'month' | 'year'

export type UserInbounds = {
  [key: string]: string[]
}

export interface AdminType {
  username: string
  is_sudo: boolean
  telegram_id: string | null
  discord_webhook: string | null
}
export type User = UserResponse

export type UserCreate = Pick<User, 'inbounds' | 'proxies' | 'expire' | 'data_limit' | 'data_limit_reset_strategy' | 'on_hold_expire_duration' | 'username' | 'status' | 'note'>

export type UserApi = {
  discord_webook: string
  is_sudo: boolean
  telegram_id: number | string
  username: string
}

export type UseGetUserReturn = {
  userData: UserApi
  getUserIsPending: boolean
  getUserIsSuccess: boolean
  getUserIsError: boolean
  getUserError: Error | null
}
