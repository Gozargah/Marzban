import AddNodeModal from '@/components/dialogs/AddNodeModal'
import NodesSection from '@/components/nodes/NodesSection'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNodesQuery } from '@/contexts/NodesContext'
import useDirDetection from '@/hooks/use-dir-detection'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const Nodes = () => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [isAddNodeModalOpen,setIsAddNodeModalOpen] = useState(false)
  const { data: nodes, isLoading } = useNodesQuery()

  return (
    <div className="pb-8">
      <div dir={dir} className="mx-auto pt-6 gap-4 flex items-center justify-between flex-wrap px-4 sm:px-8 pb-4">
        <div className="flex flex-col gap-y-2">
          <h1 className="font-semibold text-2xl sm:text-3xl">{t('nodes')}</h1>
          <span className="text-muted-foreground text-xs sm:text-sm">{t('manageNodes')}</span>
        </div>
        <div>
          <Button onClick={() => setIsAddNodeModalOpen(true)} className="flex items-center">
            <Plus />
            <span>{t('nodes.addNode')}</span>
          </Button>
        </div>
      </div>
      <Separator />
      <div>
        <NodesSection nodes={nodes} />
        <AddNodeModal onCloseModal={() => setIsAddNodeModalOpen(false)} isOpen={isAddNodeModalOpen}/>
      </div>
    </div>
  )
}

export default Nodes
