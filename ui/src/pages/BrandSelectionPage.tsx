import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrand } from '../context/BrandContext'
import { BRANDS, BRAND_ENTITY, getBrandLogoUrl, needsDarkBg, getBrandHex, type BrandEntity, type BrandName } from '../constants/brands'
import { brandToSlug } from '../utils/brandSlug'
import { AdminPasscodeModal } from '../components/AdminPasscodeModal'
import { BrandPasscodeModal } from '../components/BrandPasscodeModal'

export function BrandSelectionPage() {
  const { selectedBrand, setSelectedBrand, clearBrand } = useBrand()
  const navigate = useNavigate()
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [pendingBrand, setPendingBrand] = useState<BrandName | null>(null)
  const [loadingBrand, setLoadingBrand] = useState<BrandName | null>(null)

  const webhookUrl = (import.meta.env.VITE_BRAND_PASSCODE_WEBHOOK_URL as string | undefined)?.trim()

  // Clear any lingering brand so the picker always shows
  useEffect(() => {
    if (selectedBrand) {
      clearBrand()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Group brands by entity
  const brandsByEntity: Record<BrandEntity, string[]> = {
    'AASB': [],
    'MBNS': [],
    'ARSB': [],
    'NISB': [],
  }

  BRANDS.forEach(brand => {
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
                <button
                  key={brand}
                  onClick={() => void handleSelectBrand(brand as BrandName)}
                  disabled={loadingBrand !== null}
                  className="glass-card rounded-xl transition-all duration-200 text-left group flex items-center overflow-hidden hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  <div
                    className="w-16 h-16 flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: needsDarkBg(brand) ? getBrandHex(brand) : '#F9FAFB' }}
                  >
                    <img
                      src={getBrandLogoUrl(brand)}
                      alt={brand}
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0 px-3 py-4">
                    <h2 className="font-display text-sm font-semibold text-neutral-950">{brand}</h2>
                  </div>
                  {loadingBrand === brand ? (
                    <span className="text-neutral-300 shrink-0 pr-3">
                      <span className="w-4 h-4 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin inline-block" />
                    </span>
                  ) : (
                    <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0 pr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </button>
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
                <button
                  key={brand}
                  onClick={() => void handleSelectBrand(brand as BrandName)}
                  disabled={loadingBrand !== null}
                  className="glass-card rounded-xl transition-all duration-200 text-left group flex items-center overflow-hidden hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  <div
                    className="w-16 h-16 flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: needsDarkBg(brand) ? getBrandHex(brand) : '#F9FAFB' }}
                  >
                    <img
                      src={getBrandLogoUrl(brand)}
                      alt={brand}
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0 px-3 py-4">
                    <h2 className="font-display text-sm font-semibold text-neutral-950">{brand}</h2>
                  </div>
                  {loadingBrand === brand ? (
                    <span className="text-neutral-300 shrink-0 pr-3">
                      <span className="w-4 h-4 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin inline-block" />
                    </span>
                  ) : (
                    <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0 pr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </button>
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
                <button
                  key={brand}
                  onClick={() => void handleSelectBrand(brand as BrandName)}
                  disabled={loadingBrand !== null}
                  className="glass-card rounded-xl transition-all duration-200 text-left group flex items-center overflow-hidden hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  <div
                    className="w-16 h-16 flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: needsDarkBg(brand) ? getBrandHex(brand) : '#F9FAFB' }}
                  >
                    <img
                      src={getBrandLogoUrl(brand)}
                      alt={brand}
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0 px-3 py-4">
                    <h2 className="font-display text-sm font-semibold text-neutral-950">{brand}</h2>
                  </div>
                  {loadingBrand === brand ? (
                    <span className="text-neutral-300 shrink-0 pr-3">
                      <span className="w-4 h-4 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin inline-block" />
                    </span>
                  ) : (
                    <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0 pr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </button>
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
