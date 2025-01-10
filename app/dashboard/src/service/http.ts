import { getAuthToken } from '@/utils/authStorage'
import { FetchError, FetchOptions, $fetch as ofetch } from 'ofetch'

export const $fetch = ofetch.create({
  baseURL: import.meta.env.VITE_BASE_API,
  onRequest({ options }) {
    const token = getAuthToken()
    if (token) {
      options.headers.set('Authorization', `Bearer ${getAuthToken()}`)
    }
  },
})

export const fetcher = <T>(url: string, ops: FetchOptions<'json'> = {}) => {
  return $fetch<T>(url, ops).catch(e => {
    if (e.status === 401) {
      const url = new URL(window.location.href)
      if (url.hash !== '#/login') {
        url.hash = '#/login'
        window.location.href = url.href
      }
    }
    throw e
  })
}

export const fetch = fetcher

export type ErrorType<Error> = FetchError<{ detail: Error }>
export type BodyType<BodyData> = BodyData

type OvalFetcherParams = FetchOptions<'json'> & {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  params?: Record<string, unknown>
  data?: FetchOptions<'json'>['body']
}
export const orvalFetcher = async <T>({ url, method, params, data: body }: OvalFetcherParams): Promise<T> => {
  return fetcher(url, {
    method,
    params,
    body,
  })
}

export default orvalFetcher
