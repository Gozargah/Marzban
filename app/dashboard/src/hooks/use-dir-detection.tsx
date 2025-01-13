import { useTranslation } from 'react-i18next'

const useDirDetection = () => {
  const { i18n } = useTranslation()
  return i18n.dir()
}

export default useDirDetection
