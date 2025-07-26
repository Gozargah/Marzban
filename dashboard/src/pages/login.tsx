import Logo from '@/assets/logo.svg?react'
import { Footer } from '@/components/Footer'
import { Language } from '@/components/Language'
import { ThemeToggle } from '@/components/theme-toggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { useAdminToken, useAdminMiniAppToken } from '@/service/api'
import { removeAuthToken, setAuthToken } from '@/utils/authStorage'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlertIcon, LogInIcon } from 'lucide-react'
import { FC, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { PasswordInput } from '@/components/ui/password-input'
import { LoaderButton } from '@/components/ui/loader-button'
import { $fetch } from '@/service/http'
import { retrieveRawInitData } from '@telegram-apps/sdk'

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
  let isTelegram = false;
  let initDataRaw = '';
  try {
    initDataRaw = retrieveRawInitData() || '';
    isTelegram = !!initDataRaw;
  } catch (e) {
    isTelegram = false;
    initDataRaw = '';
  }

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

  // MiniApp login mutation
  const {
    isPending: miniAppLoading,
    error: miniAppError,
  } = useAdminMiniAppToken({
    mutation: {
      onSuccess(data: any) {
        // Assume data contains access_token
        if (data && data.access_token) {
          setAuthToken(data.access_token)
          navigate('/', { replace: true })
        }
      },
    },
  })

  const handleLogin = async (values: LoginSchema) => {
    if (isTelegram) {
      try {
        const data = await $fetch('/api/admin/miniapp/token', {
          method: 'POST',
          headers: {
            'x-telegram-authorization': initDataRaw,
          },
        });
        if (data && data.access_token) {
          setAuthToken(data.access_token);
          navigate('/', { replace: true });
        } else {
          throw new Error(data?.detail || 'Telegram login failed');
        }
      } catch (err: any) {
        alert(err.message || 'Telegram login failed');
      }
    } else {
      login({
        data: {
          ...values,
          grant_type: 'password',
        },
      })
    }
  }

  const [telegramLoading, setTelegramLoading] = useState(false);

  // Auto-login for Telegram MiniApp
  useEffect(() => {
    if (isTelegram) {
      // Try to expand for all platforms
      try {
        const win = window as any;
        // Always try to expand the Telegram WebApp if possible
        if (win.Telegram && win.Telegram.WebApp && typeof win.Telegram.WebApp.expand === 'function') {
          win.Telegram.WebApp.expand();
        }
        // Send web_app_expand event for all platforms
        const expandEventData = JSON.stringify({
          eventType: 'web_app_expand',
          eventData: {},
        });
        // Web (iframe)
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(expandEventData, 'https://web.telegram.org');
        }
        // Windows Phone
        if (typeof (window as any).external !== 'undefined' && typeof (window as any).external.notify === 'function') {
          (window as any).external.notify(expandEventData);
        }
        // Mobile/Desktop
        if (win.TelegramWebviewProxy && typeof win.TelegramWebviewProxy.postEvent === 'function') {
          win.TelegramWebviewProxy.postEvent('web_app_expand', '{}');
        }
      }
      catch (e) {
        // Ignore errors if not available
      }

      setTelegramLoading(true);
      console.log('[Telegram MiniApp] x-telegram-authorization payload:', initDataRaw);
      $fetch('/api/admin/miniapp/token', {
        method: 'POST',
        headers: {
          'x-telegram-authorization': initDataRaw,
        },
      })
        .then((data: any) => {
          console.log('[Telegram MiniApp] response data:', data);
          if (data && data.access_token) {
            setAuthToken(data.access_token);
            navigate('/', { replace: true });
          } else {
            throw new Error(data?.detail || 'Telegram login failed');
          }
        })
        .catch((err: any) => {
          alert(err.message || 'Telegram login failed');
        })
        .finally(() => {
          setTelegramLoading(false);
        });
    }
  }, []);

  return (
    <div className="flex flex-col justify-between min-h-screen p-6 w-full">
      <div className="w-full">
        <div className="flex justify-between items-center w-full">
          <Language />
          <ThemeToggle />
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
                  <Input className="py-5" placeholder={t('username')} {...register('username')} error={t(errors?.username?.message as string)} />
                  <PasswordInput className="py-5" placeholder={t('password')} {...register('password')} error={t(errors?.password?.message as string)} />
                  {((error && error.data) || (miniAppError && miniAppError.data)) && (
                    <Alert className='mt-2' variant="destructive">
                      <CircleAlertIcon size="18px" />
                      <AlertDescription>{String(error?.data?.detail || miniAppError?.data?.detail)}</AlertDescription>
                    </Alert>
                  )}
                  <div className='mt-2'>
                    <LoaderButton  isLoading={loading || miniAppLoading || telegramLoading} type="submit" className="w-full flex items-center gap-2">
                      <span>{t('login')}</span>
                      <LogInIcon size="18px" />
                    </LoaderButton>
                  </div>
                </div>
              </form>
              {/* Telegram MiniApp: auto-login on page load
              // (Button removed; see useEffect above) */}
            </div>
          </div>
        </div>
      </div>
      <Footer showVersion={false} />
    </div>
  )
}

export default Login
