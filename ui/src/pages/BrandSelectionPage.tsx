import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrand } from '../context/BrandContext'
import { BRANDS } from '../constants/brands'
import { AdminPasscodeModal } from '../components/AdminPasscodeModal'

export function BrandSelectionPage() {
  const { selectedBrand, setSelectedBrand } = useBrand()
  const navigate = useNavigate()
  const [showAdminModal, setShowAdminModal] = useState(false)

  useEffect(() => {
    if (selectedBrand) {
      navigate('/home', { replace: true })
    }
  }, [selectedBrand, navigate])

  if (selectedBrand) return null

  return (
    <div className="min-h-screen bg-[#f7f7f6] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl">

        {/* Hero */}
        <div className="mb-10 text-center">
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

        {/* Brand grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BRANDS.map((brand) => (
            <button
              key={brand}
              onClick={() => {
                setSelectedBrand(brand)
                navigate('/home')
              }}
              className="glass-card rounded-xl px-4 py-6 transition-all duration-200 text-left group flex items-center gap-3 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015]"
            >
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-sm font-semibold text-neutral-950">{brand}</h2>
              </div>
              <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          ))}

          {/* Admin card */}
          <button
            onClick={() => setShowAdminModal(true)}
            className="bg-neutral-900 hover:bg-neutral-800 rounded-xl px-4 py-6 transition-all duration-200 text-left group flex items-center gap-3 hover:shadow-[0_12px_40px_rgba(0,0,0,0.20)] hover:scale-[1.015]"
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
            navigate('/home')
          }}
          onClose={() => setShowAdminModal(false)}
        />
      )}
    </div>
  )
}
