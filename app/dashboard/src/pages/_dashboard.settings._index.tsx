import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

export default function GeneralSettings() {
  return (
    <div className="flex flex-col gap-y-6 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <p className="text-sm">Control your server details</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="path">Path</Label>
            <Input id="path" placeholder="/" />
            <p className="text-sm">Control your server details</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">Default Language</Label>
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
            <p className="text-sm">Control your server details</p>
          </div>
          <Button className="ml-auto">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <p className="text-sm">Control your server details</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telegram-bot">Telegram Bot</Label>
            <Input id="telegram-bot" />
            <p className="text-sm">Control your server details</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-token">API Token</Label>
            <Input id="api-token" type="password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-id">Admin ID</Label>
            <Input id="admin-id" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-channel">Log Channel Id</Label>
            <Input id="log-channel" />
          </div>
          <Separator />
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Filter Notifications</h4>
            <p className="text-sm">Get notified when any of the events bellow happens</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-events">Login events</Label>
                <Switch id="login-events" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="create-user">Create user</Label>
                <Switch id="create-user" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="update-user">Update user</Label>
                <Switch id="update-user" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="delete-user">Delete user</Label>
                <Switch id="delete-user" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="user-reset">User data reset</Label>
                <Switch id="user-reset" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="revoke-sub">Revoke subscription</Label>
                <Switch id="revoke-sub" />
              </div>
            </div>
          </div>
          <Button className="ml-auto">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configs</CardTitle>
          <p className="text-sm">Control your server details</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sub-prefix">Subscription prefix</Label>
            <Input id="sub-prefix" placeholder="/sub/" />
            <p className="text-sm">Control your server details</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-interval">Automatic update interval</Label>
            <Input id="update-interval" placeholder="/" />
            <p className="text-sm">Control your server details</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-title">Page Title</Label>
            <Input id="page-title" placeholder="/" />
            <p className="text-sm">Control your server details</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-url">Support URL</Label>
            <Input id="support-url" placeholder="/" />
            <p className="text-sm">Control your server details</p>
          </div>
          <Button className="ml-auto">Save Changes</Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <p className="text-sm">Control your server details</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-semibold">Restart Core</h4>
              <p className="text-sm">Control your server details</p>
            </div>
            <Button variant="destructive">Restart core</Button>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="auto-delete">Automatic delete limited users</Label>
            <Select defaultValue="never">
              <SelectTrigger id="auto-delete">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm">Control your server details</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-semibold">Reset all usage</h4>
              <p className="text-sm">Control your server details</p>
            </div>
            <Button variant="destructive">Clear all usage</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
