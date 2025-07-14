import { ORGANIZATION_URL, REPO_URL } from '@/constants/Project'
import { useGetSystemStats } from '@/service/api'
import { FC, HTMLAttributes } from 'react'

const FooterContent = () => {
  const { data: systemStats } = useGetSystemStats(undefined, {
    query: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    },
  })

  const version = systemStats?.version ? ` (v${systemStats.version})` : ''

  return (
    <p className="inline-block flex-grow text-center text-xs text-gray-500">
      <a className="text-blue-400" href={REPO_URL}>
        Marzban
      </a>
      {version}, Made with ❤️ in{' '}
      <a className="text-blue-400" href={ORGANIZATION_URL}>
        Gozargah
      </a>
    </p>
  )
}

export const Footer: FC<HTMLAttributes<HTMLDivElement>> = props => {
  return (
    <div className="relative flex w-full pb-3 pt-1" {...props}>
      <FooterContent />
    </div>
  )
}
