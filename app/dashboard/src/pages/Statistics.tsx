import { useSidebar } from '@/hooks/use-sidebar'
import { useStore } from '@/hooks/use-store'

const Statistics = () => {
  const sidebar = useStore(useSidebar, x => x)
  if (!sidebar) return null
  return (
    <div>
      <div className="mx-auto py-10"></div>
    </div>
  )
}

export default Statistics
