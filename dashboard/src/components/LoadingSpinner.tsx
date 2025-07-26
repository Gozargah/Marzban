import React from 'react'
import { Spinner } from './spinner'
import { useTranslation } from 'react-i18next'

interface LoadingSpinnerProps {
  text?: string
  size?: 'small' | 'medium' | 'large'
  className?: string
}

export function LoadingSpinner({ 
  text = 'loading', 
  size = 'medium',
  className = ''
}: LoadingSpinnerProps) {
  const { t } = useTranslation()
  return (
    <div className={`flex flex-col items-center justify-center min-h-screen ${className}`}>
      <Spinner size={size} />
      {text && (
        <p className="mt-4 text-sm text-muted-foreground">
          {t(text)}
        </p>
      )}
    </div>
  )
} 