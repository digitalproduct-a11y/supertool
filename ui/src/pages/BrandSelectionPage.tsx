import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrand } from '../context/BrandContext'
import { useMsal } from '@azure/msal-react'
import { BRANDS, BRAND_ENTITY, getBrandLogoUrl, needsDarkBg, getBrandHex, type BrandEntity, type BrandName } from '../constants/brands'
import { brandToSlug } from '../utils/brandSlug'
import { AdminPasscodeModal } from '../components/AdminPasscodeModal'
import { BrandPasscodeModal } from '../components/BrandPasscodeModal'

// A brand is treated as "coming soon" while it has no Cloudinary logo URL.
// Filling in BRAND_LOGO_URLS for a brand automatically activates it.
function isComingSoon(brand: BrandName): boolean {
  return !getBrandLogoUrl(brand)
}

function BrandCard({
  brand,
  loadingBrand,
  onSelect,
}: {
  brand: BrandName
  loadingBrand: BrandName | null
  onSelect: (brand: BrandName) => void
}) {
  const comingSoon = isComingSoon(brand)
  const isLoading = loadingBrand === brand
  const disabled = comingSoon || loadingBrand !== null

  return (
    <button
      key={brand}
      onClick={() => !comingSoon && onSelect(brand)}
      disabled={disabled}
      aria-disabled={disabled}
      title={comingSoon ? 'Coming soon' : undefined}
      className={`glass-card rounded-xl transition-all duration-200 text-left group flex items-center overflow-hidden ${
        comingSoon
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none'
      }`}
    >
      <div
        className="w-16 h-16 flex-shrink-0 flex items-center justify-center"
        style={{
          backgroundColor: comingSoon
            ? '#E5E7EB'
            : needsDarkBg(brand)
              ? getBrandHex(brand)
              : '#F9FAFB',
        }}
      >
        {comingSoon ? (
          <span className="text-[9px] font-medium text-neutral-500 text-center leading-tight px-1">
            Coming<br />soon
          </span>
        ) : (
          <img
            src={getBrandLogoUrl(brand)}
            alt={brand}
            className="w-12 h-12 object-contain"
          />
        )}
      </div>
      <div className="flex-1 min-w-0 px-3 py-4">
        <h2 className="font-display text-sm font-semibold text-neutral-950">{brand}</h2>
        {comingSoon && (
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 mt-0.5">Coming soon</p>
        )}
      </div>
      {isLoading ? (
        <span className="text-neutral-300 shrink-0 pr-3">
          <span className="w-4 h-4 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin inline-block" />
        </span>
      ) : !comingSoon ? (
        <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0 pr-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      ) : null}
    </button>
  )
}

export function BrandSelectionPage() {
  const { setSelectedBrand } = useBrand()
  const navigate = useNavigate()
  const { instance } = useMsal()
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [pendingBrand, setPendingBrand] = useState<BrandName | null>(null)
  const [loadingBrand, setLoadingBrand] = useState<BrandName | null>(null)

  const webhookUrl = (import.meta.env.VITE_BRAND_PASSCODE_WEBHOOK_URL as string | undefined)?.trim()

  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
  const userEmail = account?.username ?? ''
  const userDisplayName = account?.name ?? userEmail.split('@')[0]
  const userInitials = userDisplayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  // Brand auth/context is wiped by the "Switch brand" button in Sidebar — not
  // here. Landing at `/` can also happen via MSAL redirect or guard bounces,
  // and those must not invalidate an existing passcode session.

  // Group brands by entity
  const brandsByEntity: Record<BrandEntity, string[]> = {
    'AASB': [],
    'MBNS': [],
    'ARSB': [],
    'NISB': [],
  }

  BRANDS.filter(brand => !isComingSoon(brand)).forEach(brand => {
    const entity = BRAND_ENTITY[brand]
    brandsByEntity[entity].push(brand)
  })

  const handleSelectBrand = async (brand: BrandName) => {
    setLoadingBrand(brand)
    try {
      if (!webhookUrl) {
        setPendingBrand(brand)
        return
      }
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, passcode: '' }),
      })
      const data = await res.json() as { success?: boolean; requires_passcode?: boolean }
      if (data.success && !data.requires_passcode) {
        sessionStorage.setItem(`kult_brand_auth_${brandToSlug(brand)}`, '1')
        setSelectedBrand(brand)
        navigate(`/${brandToSlug(brand)}/home`)
      } else {
        setPendingBrand(brand)
      }
    } catch {
      setPendingBrand(brand)
    } finally {
      setLoadingBrand(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f6] flex items-center justify-center px-4 py-16">

      {/* User profile — top right */}
      <div className="fixed top-4 right-4 flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-3 py-2 shadow-sm z-10">
        <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-semibold text-white">{userInitials}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-medium text-neutral-900 leading-tight truncate max-w-[160px]">{userDisplayName}</span>
          <span className="text-[11px] text-neutral-400 leading-tight truncate max-w-[160px]">{userEmail}</span>
        </div>
        <button
          onClick={() => instance.logoutRedirect()}
          aria-label="Sign out"
          title="Sign out"
          className="ml-1 text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      <div className="w-full max-w-7xl">

        {/* Hero */}
        <div className="mb-12 text-center">
          <p className="text-xs font-mono text-neutral-400 mb-3 uppercase tracking-widest">
            <span className="glitch-text" data-text="KULT Digital Kit">KULT Digital Kit</span>
          </p>
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
            Select your brand
          </h1>
          <p className="text-neutral-500 mt-2 text-sm max-w-xs mx-auto">
            Choose your brand to get started. Your selection will be remembered.
          </p>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow max-w-xs mx-auto"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Entities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Astro (combines AASB + MBNS) */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-widest mb-4">
              Astro
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {[...brandsByEntity['AASB'], ...brandsByEntity['MBNS']].map(brand => (
                <BrandCard
                  key={brand}
                  brand={brand as BrandName}
                  loadingBrand={loadingBrand}
                  onSelect={(b) => void handleSelectBrand(b)}
                />
              ))}
            </div>
          </div>

          {/* Astro Radio */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-widest mb-4">
              Astro Radio
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {brandsByEntity['ARSB'].map(brand => (
                <BrandCard
                  key={brand}
                  brand={brand as BrandName}
                  loadingBrand={loadingBrand}
                  onSelect={(b) => void handleSelectBrand(b)}
                />
              ))}
            </div>
          </div>

          {/* Nu Ideaktiv */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-widest mb-4">
              Nu Ideaktiv
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {brandsByEntity['NISB'].map(brand => (
                <BrandCard
                  key={brand}
                  brand={brand as BrandName}
                  loadingBrand={loadingBrand}
                  onSelect={(b) => void handleSelectBrand(b)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Admin card */}
        <div className="mt-8 pt-8 border-t border-neutral-200">
          <button
            onClick={() => setShowAdminModal(true)}
            className="w-full bg-neutral-900 hover:bg-neutral-800 rounded-xl px-4 py-6 transition-all duration-200 text-left group flex items-center gap-3 hover:shadow-[0_12px_40px_rgba(0,0,0,0.20)] hover:scale-[1.01]"
          >
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-sm font-semibold text-white">Admin</h2>
              <p className="text-xs text-neutral-400 mt-0.5">Full access · Internal use only</p>
            </div>
            <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        </div>

      </div>

      {showAdminModal && (
        <AdminPasscodeModal
          onSuccess={() => {
            setSelectedBrand('Admin')
            navigate('/admin/home')
          }}
          onClose={() => setShowAdminModal(false)}
        />
      )}

      {pendingBrand && (
        <BrandPasscodeModal
          brand={pendingBrand}
          onSuccess={() => {
            sessionStorage.setItem(`kult_brand_auth_${brandToSlug(pendingBrand)}`, '1')
            setSelectedBrand(pendingBrand)
            navigate(`/${brandToSlug(pendingBrand)}/home`)
            setPendingBrand(null)
          }}
          onClose={() => setPendingBrand(null)}
        />
      )}
    </div>
  )
}
