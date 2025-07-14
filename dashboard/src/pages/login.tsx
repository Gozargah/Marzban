import Logo from '@/assets/logo.svg?react'
import { Footer } from '@/components/Footer'
import { Language } from '@/components/Language'
import { ThemeToggle } from '@/components/theme-toggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { useAdminToken } from '@/service/api'
import { removeAuthToken, setAuthToken } from '@/utils/authStorage'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlertIcon, LogInIcon } from 'lucide-react'
import { FC, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { PasswordInput } from '@/components/ui/password-input'
import { LoaderButton } from '@/components/ui/loader-button'

const schema = z.object({
  username: z.string().min(1, 'login.fieldRequired'),
  password: z.string().min(1, 'login.fieldRequired'),
})

type LoginSchema = z.infer<typeof schema>

export const Login: FC = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const location = useLocation()
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<LoginSchema>({
    defaultValues: {
      username: '',
      password: '',
    },
    resolver: zodResolver(schema),
  })
  useEffect(() => {
    removeAuthToken()
    if (location.pathname !== '/login') {
      navigate('/login', { replace: true })
    }
  }, [])
  const {
    mutate: login,
    isPending: loading,
    error,
  } = useAdminToken({
    mutation: {
      onSuccess({ access_token }) {
        setAuthToken(access_token)
        navigate('/', { replace: true })
      },
    },
  })
  const handleLogin = (values: LoginSchema) => {
    login({
      data: {
        ...values,
        grant_type: 'password',
      },
    })
  }

  return (
    <div className="flex min-h-screen w-full flex-col justify-between p-6">
      <div className="w-full">
        <div className="flex w-full items-center justify-between">
          <Language />
          <ThemeToggle />
        </div>
        <div className="flex w-full items-center justify-center">
          <div className="mt-6 w-full max-w-[340px]">
            <div className="flex flex-col items-center gap-2">
              <Logo className="h-12 w-12 stroke-[12px]" />
              <span className="text-2xl font-semibold">{t('login.loginYourAccount')}</span>
              <span className="text-gray-600 dark:text-gray-400">{t('login.welcomeBack')}</span>
            </div>
            <div className="mx-auto w-full max-w-[300px] pt-4">
              <form onSubmit={handleSubmit(handleLogin)}>
                <div className="mt-4 flex flex-col gap-y-2">
                  <Input className="py-5" placeholder={t('username')} {...register('username')} error={t(errors?.username?.message as string)} />
                  <PasswordInput className="py-5" placeholder={t('password')} {...register('password')} error={t(errors?.password?.message as string)} />
                  {error && error.data && (
                    <Alert className="mt-2" variant="destructive">
                      <CircleAlertIcon size="18px" />
                      <AlertDescription>{String(error.data.detail)}</AlertDescription>
                    </Alert>
                  )}
                  <div className="mt-2">
                    <LoaderButton isLoading={loading} type="submit" className="flex w-full items-center gap-2">
                      <span>{t('login')}</span>
                      <LogInIcon size="18px" />
                    </LoaderButton>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default Login
