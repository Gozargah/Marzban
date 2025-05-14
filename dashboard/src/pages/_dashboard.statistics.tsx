import PageHeader from '@/components/page-header'
import MainContent from '@/components/statistics/Statistics'
import {Separator} from '@/components/ui/separator'
import {getGetSystemStatsQueryKey, getSystemStats} from '@/service/api'
import {useQuery} from '@tanstack/react-query'
import {useState} from 'react'
import {Construction} from 'lucide-react'
import {useTranslation} from "react-i18next";

const Statistics = () => {
    const [selectedServer, setSelectedServer] = useState<string>("master");
    const {t} = useTranslation()
    // Use the getSystemStats API with proper query key and refetch interval
    const {data, error, isLoading} = useQuery({
        queryKey: getGetSystemStatsQueryKey(),
        queryFn: () => getSystemStats(),
        refetchInterval: selectedServer === "master" ? 5000 : false, // Only refetch when master is selected
        staleTime: 3000,      // Consider data stale after 3 seconds
        refetchOnWindowFocus: true,
        enabled: selectedServer === "master" // Only fetch when master is selected
    });

    return (
        <div className="flex flex-col gap-2 w-full items-start">
            <PageHeader title="statistics" description="monitorServers"/>

            <div className="w-full relative">
                <Separator/>
                <div className="px-4 w-full pt-2">
                    <MainContent
                        error={error}
                        isLoading={isLoading}
                        data={data}
                        selectedServer={selectedServer}
                        onServerChange={setSelectedServer}
                    />
                </div>

                {/* Under Development Overlay */}
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex flex-col items-center z-10">
                    <div
                        className="bg-background/90 border-2 border-amber-400 dark:border-amber-600 shadow-md rounded-md p-4 max-w-md sm:max-w-lg md:max-w-xl mt-6 mx-auto flex flex-col items-center gap-3">
                        <Construction className="h-16 w-16 sm:h-20 sm:w-20 text-amber-500 "/>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">{t("underDevelopment.title")}</h2>
                            <p className="text-sm text-muted-foreground">{t("underDevelopment.description")}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Statistics
