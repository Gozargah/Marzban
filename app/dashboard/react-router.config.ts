import type { Config } from '@react-router/dev/config'

export default {
  ssr: false,
  appDirectory: './src',
  basename: process.env.BASE_URL,
  future: {
    unstable_optimizeDeps: true,
  },
} satisfies Config
