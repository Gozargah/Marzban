import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function GeneralSettings() {
    return (
        <div className="flex flex-col gap-y-6 mt-10">
            <div>
                <div className="flex items-start flex-col gap-y-6 md:flex-row">
                    <div className="flex-1">
                        <h3 className="font-semibold mb-2 text-lg">Dashboard</h3>
                        <p className="text-sm text-muted-foreground">Control your server details</p>
                    </div>
                    <Card className="flex-1 pt-6 w-full">
                        <CardContent className="space-y-6">
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-base" htmlFor="path">Path</Label>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1">
                                    <Input id="path" placeholder="/" />
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label htmlFor="language">Default Language</Label>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1">

                                    <Select defaultValue="english">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select language" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="english">English</SelectItem>
                                            <SelectItem value="spanish">Spanish</SelectItem>
                                            <SelectItem value="french">French</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
                <div className="flex items-center justify-end my-4">
                    <Button>Save Changes</Button>
                </div>
            </div>

            <Separator />

            <div>
                <div className="flex items-start flex-col gap-y-6 md:flex-row">
                    <div className="flex-1">
                        <h3 className="font-semibold mb-2 text-lg">Subscription</h3>
                        <p className="text-sm text-muted-foreground">Control your server details</p>
                    </div>
                    <Card className="flex-1 pt-6 w-full">
                        <CardContent className="space-y-6">
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-base" htmlFor="path">Subscription prefix</Label>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1">
                                    <Input id="path" placeholder="/sub/" />
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-base" htmlFor="path">Automatic update interval</Label>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1">
                                    <Input id="path" placeholder="/" />
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-base" htmlFor="path">Page Title</Label>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1">
                                    <Input id="path" placeholder="Marzban" />
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-base" htmlFor="path">Support URL</Label>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1">
                                    <Input id="path" placeholder="/" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
                <div className="flex items-center justify-end my-4">
                    <Button>Save Changes</Button>
                </div>
            </div>

            <Separator />

            <div>
                <div className="flex items-start flex-col gap-y-6 md:flex-row">
                    <div className="flex-1">
                        <h3 className="font-semibold mb-2 text-lg">Notifications</h3>
                        <p className="text-sm text-muted-foreground">Control your server details</p>
                    </div>
                    <Card className="flex-1 pt-6 w-full">
                        <CardHeader className="pt-2 mb-2">
                            <CardTitle className="mb-2">Telegram Bot</CardTitle>
                            <p className="text-sm text-muted-foreground">Control your server details</p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-base" htmlFor="path">API Token</Label>
                                </div>
                                <div className="flex-1">
                                    <Input id="path" placeholder="" />
                                </div>
                            </div>
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-base" htmlFor="path">Admin ID</Label>
                                </div>
                                <div className="flex-1">
                                    <Input id="path" placeholder="/" />
                                </div>
                            </div>
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-base" htmlFor="path">Log Channel ID</Label>
                                </div>
                                <div className="flex-1">
                                    <Input id="path" placeholder="/" />
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <h4 className="mb-2">Discord Webhook URL</h4>
                                <p className="text-sm text-muted-foreground mb-8">Control your server details</p>
                                <div className="flex items-center w-full justify-between">
                                    <div className="space-y-2 flex-1">
                                        <Label className="text-base" htmlFor="path">Webhook URLs</Label>
                                        <p className="text-sm text-muted-foreground">Comma separated URLs</p>
                                    </div>
                                    <div className="flex-1">
                                        <Input id="path" placeholder="discord.gg" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <Label className="text-base" htmlFor="path">Webhook Secret</Label>
                                    <p className="text-sm text-muted-foreground">Control you server details</p>
                                </div>
                                <div className="flex-1">
                                    <Input id="path" placeholder="$yfrb" />
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <h4 className="mb-2">Filter Notifications</h4>
                                <p className="text-sm text-muted-foreground mb-8">Get notified when any of the events bellow happens</p>
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div className="flex items-center justify-between font-medium">
                                        <Label htmlFor="login-events">Login events</Label>
                                        <Switch id="login-events" />
                                    </div>
                                    <div className="flex items-center justify-between font-medium">
                                        <Label htmlFor="create-user">Create user</Label>
                                        <Switch id="create-user" />
                                    </div>
                                    <div className="flex items-center justify-between font-medium">
                                        <Label htmlFor="update-user">Update user</Label>
                                        <Switch id="update-user" />
                                    </div>
                                    <div className="flex items-center justify-between font-medium">
                                        <Label htmlFor="delete-user">Delete user</Label>
                                        <Switch id="delete-user" />
                                    </div>
                                    <div className="flex items-center justify-between font-medium">
                                        <Label htmlFor="user-reset">User data reset</Label>
                                        <Switch id="user-reset" />
                                    </div>
                                    <div className="flex items-center justify-between font-medium">
                                        <Label htmlFor="revoke-sub">Revoke subscription</Label>
                                        <Switch id="revoke-sub" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
                <div className="flex items-center justify-end my-4">
                    <Button>Save Changes</Button>
                </div>
            </div>

            <Separator />

            <div>
                <div className="flex items-start flex-col gap-y-6 md:flex-row">
                    <div className="flex-1">
                        <h3 className="font-semibold text-red-700 mb-2 text-lg">Danger Zone</h3>
                        <p className="text-sm text-muted-foreground">Control your server details</p>
                    </div>
                    <Card className="flex-1 pt-6 w-full border-red-700">
                        <CardContent className="space-y-6">
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="text-base">Restart Core</div>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1 flex items-center justify-end">
                                    <Button variant="destructive">Restart Core</Button>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="text-base">Automatic delete limited users</div>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1">
                                    <Select defaultValue="never">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select language" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="never">Never</SelectItem>
                                            <SelectItem value="10 Days">10 Days</SelectItem>
                                            <SelectItem value="30 Days">30 Days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="text-base">Automatic delete expired users</div>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1">
                                    <Select defaultValue="never">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select language" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="never">Never</SelectItem>
                                            <SelectItem value="10 Days">10 Days</SelectItem>
                                            <SelectItem value="30 Days">30 Days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center w-full justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="text-base">Reset all usage</div>
                                    <p className="text-sm text-muted-foreground">Control your server details</p>
                                </div>
                                <div className="flex-1 flex items-center justify-end">
                                    <Button variant="destructive">Clear all usage</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
                <div className="flex items-center justify-end my-4">
                    <Button>Save Changes</Button>
                </div>
            </div>
        </div>
    )
}

