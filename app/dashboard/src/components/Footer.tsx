import { ORGANIZATION_URL, REPO_URL } from '@/constants/Project'
import { useDashboard } from '@/contexts/DashboardContext'
import { FC, HTMLAttributes } from 'react'

export const Footer: FC<HTMLAttributes<HTMLDivElement>> = props => {
  const { version } = useDashboard()
  return (
    <div className="flex w-full pt-1 pb-3 relative" {...props}>
      <p className="inline-block flex-grow text-center text-gray-500 text-xs">
        <a className="text-blue-400" href={REPO_URL}>
          Marzban
        </a>
        {version ? ` (v${version}), ` : ', '}
        Made with ❤️ in{' '}
        <a className="text-blue-400" href={ORGANIZATION_URL}>
          Gozargah
        </a>
      </p>
    </div>
  )
}
