import useDirDetection from '@/hooks/use-dir-detection'
import { UserTemplateType } from '@/types/User'
import UserTemplate from '../components/templates/UserTemplate'

export default function UserTemplates() {
  const dir = useDirDetection()
  const templates: UserTemplateType[] = [
    {
      name: 'my template 1',
      data_limit: 0,
      expire_duration: 0,
      username_prefix: null,
      username_suffix: null,
      inbounds: {},
      id: 1,
    },
    {
      name: 'premium plan',
      data_limit: 5000000000, // 5GB
      expire_duration: 30, // 30 days
      username_prefix: 'VIP_',
      username_suffix: '_2024',
      inbounds: {
        main: {
          tag: 'main',
          protocol: 'vmess',
          network: 'ws',
          tls: 'tls',
          port: 443,
        },
      },
      id: 2,
    },
    {
      name: 'trial user',
      data_limit: 1000000000, // 1GB
      expire_duration: 7, // 7 days
      username_prefix: 'trial_',
      username_suffix: null,
      inbounds: {
        backup: {
          tag: 'backup',
          protocol: 'trojan',
          network: 'tcp',
          tls: 'tls',
          port: 8080,
        },
      },
      id: 3,
    },
  ]

  return (
    <div dir={dir} className="gap-y-6 pt-4 lg:gap-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {templates?.map((template: UserTemplateType) => (
        <UserTemplate template={template} key={template.id} />
      ))}
    </div>
  )
}
