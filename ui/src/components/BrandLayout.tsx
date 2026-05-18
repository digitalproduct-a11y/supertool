import { useEffect } from 'react'
import { useParams, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { slugToBrand } from '../utils/brandSlug'
import { useBrand } from '../context/BrandContext'
import { Sidebar } from './Sidebar'
import type { ToolId } from './Sidebar'

interface BrandLayoutProps {
  isSidebarCollapsed: boolean
  onCollapsedChange: (v: boolean) => void
  toolToPath: Record<ToolId, string>
  getActiveTool: (pathname: string) => ToolId
}

export function BrandLayout({
  isSidebarCollapsed,
  onCollapsedChange,
  toolToPath,
  getActiveTool,
}: BrandLayoutProps) {
  const { brandSlug } = useParams<{ brandSlug: string }>()
  const { setSelectedBrand } = useBrand()
  const navigate = useNavigate()
  const location = useLocation()

  const resolvedBrand = brandSlug ? slugToBrand(brandSlug) : null

  // Sync URL brand → context
  useEffect(() => {
    if (resolvedBrand) {
      setSelectedBrand(resolvedBrand)
    }
  }, [resolvedBrand, setSelectedBrand])

  // Invalid slug → brand picker
  if (!resolvedBrand) {
    return <Navigate to="/" replace />
  }

  // Admin route requires passcode to have been entered this session
  if (resolvedBrand === 'Admin' && sessionStorage.getItem('kult_admin_auth') !== '1') {
    return <Navigate to="/" replace />
  }

  // Strip the /:brandSlug prefix to get the page path for active tool detection
  const pagePath = location.pathname.replace(`/${brandSlug}`, '') || '/home'
  const activeTool = getActiveTool(pagePath)

  return (
    <div className={`min-h-screen bg-[#f7f7f6] transition-[padding] duration-300 ${isSidebarCollapsed ? 'md:pl-0' : 'md:pl-60'}`}>
      <Sidebar
        activeTool={activeTool}
        onToolChange={(id) => navigate(`/${brandSlug}${toolToPath[id]}`)}
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={onCollapsedChange}
      />
      <Outlet />
    </div>
  )
}
