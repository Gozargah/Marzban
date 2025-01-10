import Logo from '@/assets/logo.svg?react'
import { Footer } from '@/components/Footer'
import { Language } from '@/components/Language'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminToken } from '@/service/api'
import { removeAuthToken, setAuthToken } from '@/utils/authStorage'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlertIcon } from 'lucide-react'
import { FC, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

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
        navigate('/')
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
    <div className="flex flex-col justify-between min-h-screen p-6 w-full">
      <div className="w-full">
        <div className="flex justify-end w-full">
          <Language />
        </div>
        <div className="w-full justify-center flex items-center">
          <div className="w-full max-w-[340px] mt-6">
            <div className="flex flex-col items-center gap-2">
              <Logo className="w-12 h-12 stroke-[12px]" />
              <span className="text-2xl font-semibold">{t('login.loginYourAccount')}</span>
              <span className="text-gray-600 dark:text-gray-400">{t('login.welcomeBack')}</span>
            </div>
            <div className="w-full max-w-[300px] mx-auto pt-4">
              <form onSubmit={handleSubmit(handleLogin)}>
                <div className="flex flex-col mt-4 gap-y-2">
                  <Input placeholder={t('username')} {...register('username')} error={t(errors?.username?.message as string)} />
                  <Input type="password" placeholder={t('password')} {...register('password')} error={t(errors?.password?.message as string)} />
                  {error && error.data && (
                    <Alert variant="destructive">
                      <CircleAlertIcon size="18px" />
                      <AlertDescription>{String(error.data.detail)}</AlertDescription>
                    </Alert>
                  )}
                  <Button isLoading={loading} type="submit" className="w-full">
                    {t('login')}
                  </Button>
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
