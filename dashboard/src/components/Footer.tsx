import { ORGANIZATION_URL, REPO_URL } from '@/constants/Project'
import { useGetSystemStats } from '@/service/api'

const FooterContent = () => {
  const { data: systemStats } = useGetSystemStats({
    query: {
      // Only fetch once when component mounts
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity
    }
  })

  const version = systemStats?.version ? ` (v${systemStats.version})` : ''

  return (
    <p className="inline-block flex-grow text-center text-gray-500 text-xs">
      <a className="text-blue-400" href={REPO_URL}>
        Marzban
      </a>
      v{version}, Made with ❤️ in{' '}
      <a className="text-blue-400" href={ORGANIZATION_URL}>
        Gozargah
      </a>
    </p>
  )
}

export default FooterContent
