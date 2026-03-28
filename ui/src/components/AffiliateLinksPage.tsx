import { useState } from 'react'
import { toast } from '../hooks/useToast'
import { BRANDS, type BrandName } from '../constants/brands'
import { Spinner } from './ds/Spinner'
import { GuideModal } from './ds/GuideModal'
import { useAffiliateLinks } from '../hooks/useAffiliateLinks'
import type { AffiliateLinksState } from '../types'

const TEMPLATE_URL = 'https://docs.google.com/spreadsheets/d/1J6JokZsSRvtHK98gZF77Y16oBwP7mzyL/export?format=xlsx'

export function AffiliateLinksPage() {
  const [pageState, setPageState] = useState<AffiliateLinksState>('idle')
  const [selectedBrand, setSelectedBrand] = useState<BrandName>(BRANDS[0])
  const [dragOver, setDragOver] = useState(false)
  const { run } = useAffiliateLinks()

  const handleFile = async (selectedFile: File) => {
    if (!selectedBrand) {
      toast.error('Please select a brand first')
      return
    }

    setPageState('loading')

    const response = await run(selectedFile, selectedBrand)

    if (response.success) {
      toast.success('Your file is ready and has been downloaded.')
      setPageState('idle')
    } else {
      toast.error(response.message)
      setPageState('idle')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith('.xlsx')) {
      handleFile(droppedFile)
    } else {
      toast.error('Please upload an Excel (.xlsx) file')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) handleFile(selectedFile)
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-950 tracking-tight">Shopee Affiliate Links</h1>
              <p className="text-neutral-500 mt-1 text-sm">Upload an Excel file with Shopee links and get back a processed file with affiliate data</p>
            </div>
            <GuideModal title="How to use Shopee Affiliate Links">
              <div className="space-y-4">
                <ol className="space-y-3 list-decimal list-inside text-sm text-neutral-700">
                  <li><strong>Select a brand</strong> — choose from the dropdown menu</li>
                  <li><strong>Download the template</strong> — if you don't already have one, get the Excel template to see the expected format</li>
                  <li><strong>Fill in Shopee URLs</strong> — place one Shopee product URL per row in the template</li>
                  <li><strong>Upload the file</strong> — drag and drop the filled Excel file, or click to browse</li>
                  <li><strong>Wait for processing</strong> — the tool extracts product data and adds affiliate tags</li>
                  <li><strong>Download the result</strong> — your processed file auto-downloads with all affiliate links and product data included</li>
                </ol>
                <div className="mt-4 p-3 bg-neutral-100 border border-neutral-300 rounded-lg">
                  <p className="text-xs font-semibold text-neutral-800 mb-1">💡 Tip</p>
                  <p className="text-xs text-neutral-700">Make sure you're uploading Shopee product URLs (shopee.com.my). One URL per row in the template.</p>
                </div>
              </div>
            </GuideModal>
          </div>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-6">
          {pageState === 'idle' && (
            <>
              {/* Template Download */}
              <div className="flex items-center justify-between pb-6 border-b border-neutral-100">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-950">Need a template?</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Download the Excel template to see the expected format</p>
                </div>
                <a
                  href={TEMPLATE_URL}
                  download
                  className="px-4 py-2 border border-neutral-200 hover:border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Download Template
                </a>
              </div>

              {/* Brand Selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Brand *</label>
                <div className="relative">
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value as BrandName)}
                    className="w-full px-4 py-3 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition"
                  >
                    {BRANDS.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Upload Excel File *</label>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => document.getElementById('file-input')?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    dragOver ? 'border-neutral-400 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <svg className="w-10 h-10 text-neutral-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm font-medium text-neutral-700">Drop your Excel file here or click to browse</p>
                  <p className="text-xs text-neutral-400 mt-1">Format: .xlsx</p>
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>
              </div>
            </>
          )}

          {pageState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Spinner size="md" />
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-700">Processing your file…</p>
                <p className="text-xs text-neutral-500 mt-1">This may take 1–2 minutes</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
