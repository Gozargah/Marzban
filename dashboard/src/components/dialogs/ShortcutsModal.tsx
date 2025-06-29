import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { useTranslation } from 'react-i18next'
import { 
  UsersIcon,
  Users2,
  LayoutTemplate,
  ListTodo,
  Share2Icon,
  Cpu,
  UserCog,
  Bookmark
} from 'lucide-react'

interface QuickAction {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  action: () => void
  disabled?: boolean
  category: 'users' | 'system' | 'management'
}

interface QuickActionsModalProps {
  open: boolean
  onClose: () => void
  onCreateUser: () => void
  onCreateGroup: () => void
  onCreateHost: () => void
  onCreateNode: () => void
  onCreateAdmin?: () => void
  onCreateTemplate?: () => void
  onCreateCore?: () => void
}

const QuickActionsModal = ({ 
  open, 
  onClose, 
  onCreateUser, 
  onCreateGroup, 
  onCreateHost, 
  onCreateNode,
  onCreateAdmin,
  onCreateTemplate,
  onCreateCore
}: QuickActionsModalProps) => {
  const { t } = useTranslation()

  const quickActions: QuickAction[] = [
    // User Management
    {
      id: '1',
      name: t('createUser'),
      description: t('emptyState.noUsers.description', { defaultValue: 'Get started by creating your first user account' }),
      icon: <UsersIcon className="h-5 w-5" />,
      action: onCreateUser,
      disabled: false,
      category: 'users'
    },
    {
      id: '2',
      name: t('createGroup'),
      description: t('manageGroups'),
      icon: <Users2 className="h-5 w-5" />,
      action: onCreateGroup,
      disabled: false,
      category: 'users'
    },
    {
      id: '3',
      name: t('templates.addTemplate'),
      description: t('templates.description', { defaultValue: 'Manage your Templates.' }),
      icon: <LayoutTemplate className="h-5 w-5" />,
      action: onCreateTemplate || (() => {}),
      disabled: !onCreateTemplate,
      category: 'users'
    },
    {
      id: '4',
      name: t('hostsDialog.addHost'),
      description: t('manageHosts'),
      icon: <ListTodo className="h-5 w-5" />,
      action: onCreateHost,
      disabled: false,
      category: 'system'
    },
    {
      id: '5',
      name: t('nodes.addNode'),
      description: t('manageNodes'),
      icon: <Share2Icon className="h-5 w-5" />,
      action: onCreateNode,
      disabled: false,
      category: 'system'
    },
    {
      id: '6',
      name: t('coreConfigModal.addConfig'),
      description: t('settings.cores.description', { defaultValue: 'Manage Your Cores' }),
      icon: <Cpu className="h-5 w-5" />,
      action: onCreateCore || (() => {}),
      disabled: !onCreateCore,
      category: 'system'
    },
    // Admin Management
    {
      id: '7',
      name: t('admins.createAdmin'),
      description: t('admins.description', { defaultValue: 'Manage system administrators' }),
      icon: <UserCog className="h-5 w-5" />,
      action: onCreateAdmin || (() => {}),
      disabled: !onCreateAdmin,
      category: 'management'
    }
  ]

  const categories = {
    users: { title: t('users', { defaultValue: 'Users' }), icon: <UsersIcon className="h-4 w-4" /> },
    system: { title: t('statistics.system', { defaultValue: 'System' }), icon: <Share2Icon className="h-4 w-4" /> },
    management: { title: t('admins.title', { defaultValue: 'Admins' }), icon: <UserCog className="h-4 w-4" /> }
  }

  const groupedActions = quickActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = []
    }
    acc[action.category].push(action)
    return acc
  }, {} as Record<string, QuickAction[]>)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[100dvh] overflow-hidden">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            {t('quickActions.title')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto max-h-[calc(100dvh-100px)] pr-1">
          {Object.entries(groupedActions).map(([category, actions]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-1">
                {categories[category as keyof typeof categories]?.icon}
                {categories[category as keyof typeof categories]?.title}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {actions.map((action) => (
                  <Card 
                    key={action.id} 
                    className={`${
                      action.disabled 
                        ? 'cursor-not-allowed opacity-50' 
                        : 'cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!action.disabled) {
                        action.action()
                        onClose()
                      }
                    }}
                  >
                    <CardHeader className="pb-2 px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                          {action.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-medium truncate">
                            {action.name}
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-1">
                            {action.description}
                          </CardDescription>
                        </div>
                        {action.disabled && (
                          <div className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded text-center">
                            {t('quickActions.comingSoon')}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default QuickActionsModal 