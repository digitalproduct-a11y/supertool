import { useState } from 'react'
import { BRANDS } from '../constants/brands'
import { useAffiliateLinks } from '../hooks/useAffiliateLinks'
import type { AffiliateLinksState } from '../types'

const TEMPLATE_URL = 'https://docs.google.com/spreadsheets/d/1J6JokZsSRvtHK98gZF77Y16oBwP7mzyL/export?format=xlsx'

export function AffiliateLinksPage() {
  const [pageState, setPageState] = useState<AffiliateLinksState>('idle')
  const [selectedBrand, setSelectedBrand] = useState(BRANDS[0] || '')
  const [errorMessage, setErrorMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const { run } = useAffiliateLinks()

  const handleFile = async (selectedFile: File) => {
    if (!selectedBrand) {
      setErrorMessage('Please select a brand first')
      return
    }

    setPageState('loading')
    setErrorMessage('')

    const response = await run(selectedFile, selectedBrand)

    if (response.success) {
      setPageState('result')
    } else {
      setErrorMessage(response.message)
      setPageState('error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith('.xlsx')) {
      handleFile(droppedFile)
    } else {
      setErrorMessage('Please upload an Excel (.xlsx) file')
      setPageState('error')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) handleFile(selectedFile)
  }

  const handleReset = () => {
    setPageState('idle')
    setErrorMessage('')
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-neutral-950 tracking-tight">Shopee Affiliate Links</h1>
          <p className="text-neutral-500 mt-1 text-sm">Upload an Excel file with Shopee links and get back a processed file with affiliate data</p>
          <div className="mt-4 h-[3px] w-24 rounded-full" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-6">
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
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm bg-white hover:border-neutral-300 focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950"
                >
                  {BRANDS.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
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
              <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-950 rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-700">Processing your file…</p>
                <p className="text-xs text-neutral-500 mt-1">This may take 1–2 minutes</p>
              </div>
            </div>
          )}

          {pageState === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">{errorMessage}</div>
              <button
                onClick={handleReset}
                className="px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition active:scale-[0.97]"
              >
                Try again
              </button>
            </div>
          )}

          {pageState === 'result' && (
            <div className="space-y-4">
              <div className="bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium">Your file is ready and has been downloaded.</p>
                  <p className="text-xs mt-1 opacity-90">Check your Downloads folder for the processed Excel file.</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="w-full py-2.5 border border-neutral-200 hover:border-neutral-300 rounded-xl text-sm font-medium text-neutral-700 hover:text-neutral-950 transition-colors"
              >
                Process another file
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
