import PageHeader from "@/components/page-header"
import MainContent from "@/components/statistics/Statistics";

const Statistics = () => {

  return (
    <div className="pb-8">
      <PageHeader
        title='statistics'
        description='monitorServers'
      />
      <div>
        <MainContent />
      </div>
    </div>
  )
}

export default Statistics
