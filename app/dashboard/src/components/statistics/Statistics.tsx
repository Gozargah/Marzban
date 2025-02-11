import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart, Cpu, Gauge, MemoryStick } from "lucide-react"
import StatisticsChart from "../charts/statistics-chart"

export default function Statistics() {
    return (
        <div className="space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">System</h2>
                    <p className="text-sm">Monitor your servers and users</p>
                </div>
                <Select defaultValue="main">
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select server" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="main">Main Server</SelectItem>
                        <SelectItem value="backup">Backup Server</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                        <Cpu className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">49%</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">RAM Usage</CardTitle>
                        <MemoryStick className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1/4 GB</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Realtime Bandwidth</CardTitle>
                        <Gauge  className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1 TB</div>
                    </CardContent>
                </Card>
            </div>

            <StatisticsChart/>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">Users</h2>
                        <p className="text-sm">Monitor your servers and users</p>
                    </div>
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select users" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            <SelectItem value="active">Active Users</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Online User</CardTitle>
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">200 / 450</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active User</CardTitle>
                            <BarChart className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">350</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Expired User</CardTitle>
                            <BarChart className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">64</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Limited User</CardTitle>
                            <BarChart className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">32</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Disable User</CardTitle>
                            <BarChart className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">5</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">On Hold User</CardTitle>
                            <BarChart className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">17</div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

