import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getPageTitle } from '../utils/pageTitles'

export function PageTitle() {
  const location = useLocation()

  useEffect(() => {
    document.title = getPageTitle(location.pathname)
  }, [location.pathname])

  return null
}
