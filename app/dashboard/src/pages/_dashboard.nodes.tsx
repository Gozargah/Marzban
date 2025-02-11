import AddNodeModal from '@/components/dialogs/AddNodeModal'
import NodesSection from '@/components/nodes/NodesSection'
import PageHeader from '@/components/page-header'
import { useNodesQuery } from '@/contexts/NodesContext'
import { Plus } from 'lucide-react'
import { useState } from 'react'

const Nodes = () => {
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false)
  const { data: nodes, isLoading } = useNodesQuery()

  return (
    <div className="pb-8">
      <PageHeader
        title='nodes'
        description='manageNodes'
        buttonIcon={Plus}
        buttonText='nodes.addNode'
        onButtonClick={() => setIsAddNodeModalOpen(true)}
      />
      <div>
        <NodesSection nodes={nodes} />
        <AddNodeModal onCloseModal={() => setIsAddNodeModalOpen(false)} isOpen={isAddNodeModalOpen} />
      </div>
    </div>
  )
}

export default Nodes
