import AddNodeModal from '@/components/dialogs/AddNodeModal'
import NodesSection from '@/components/nodes/NodesSection'
import PageHeader from '@/components/page-header'
import {useNodesQuery} from '@/contexts/NodesContext'
import {Plus} from 'lucide-react'
import {useState} from 'react'
import NodesCertificate from "@/components/nodes/NodesCertificate.tsx";
import {useQuery} from "@tanstack/react-query";
import {getNodeSettings} from "@/service/api";

const Nodes = () => {
    const {data: nodes, isLoading: nodeLoading} = useNodesQuery()
    const {data: certificate, error, isLoading: nodeSettingLoading} = useQuery({
        queryKey: ["getGetNodeSettingsQueryKey"],
        queryFn: () => getNodeSettings(),
    });
    const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false)

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
                <NodesSection nodeSetting={certificate} nodes={nodes}/>
                {/*global certificate*/}
                <NodesCertificate/>
                <AddNodeModal nodeSetting={certificate} onCloseModal={() => setIsAddNodeModalOpen(false)}
                              isOpen={isAddNodeModalOpen}/>
            </div>
        </div>
    )
}

export default Nodes
