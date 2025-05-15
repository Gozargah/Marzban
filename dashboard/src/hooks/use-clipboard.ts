import { useState, useCallback } from 'react'

function copyToClipboard(text: string): boolean {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
    return true;
  }

  const input = document.createElement('input');
  input.value = text;
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.focus();
  input.select();

  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(input);
    return successful;
  } catch (err) {
    document.body.removeChild(input);
    return false;
  }
}

export function useClipboard({ timeout = 1500 } = {}) {
  const [error, setError] = useState<Error | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyTimeout, setCopyTimeout] = useState<number | null>(null)

  const handleCopyResult = (value: boolean) => {
    window.clearTimeout(copyTimeout!)
    setCopyTimeout(window.setTimeout(() => setCopied(false), timeout))
    setCopied(value)
  }

  const copy = useCallback((text: string) => {
    const success = copyToClipboard(text)
    if (success) {
      handleCopyResult(true)
    } else {
      setError(new Error('useClipboard: copyToClipboard failed'))
    }
  }, [timeout])

  const reset = () => {
    setCopied(false)
    setError(null)
    window.clearTimeout(copyTimeout!)
  }

  return { copy, reset, error, copied }
}
