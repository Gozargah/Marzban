
import PageHeader from '@/components/page-header'
import { Plus } from 'lucide-react'
import MainSection from '@/components/hosts/Hosts'
import { useState } from 'react'

const Hosts = () => {
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)

    return (
        <div className="pb-8">
            <PageHeader
                title='hosts'
                description='manageHosts'
                buttonIcon={Plus}
                buttonText='hostsDialog.addHost'
                onButtonClick={() => setIsDialogOpen(true)}
            />
            <div>
                <MainSection isDialogOpen={isDialogOpen} onAddHost={(open) => setIsDialogOpen(open)} />
            </div>
        </div>
    )
}

export default Hosts
