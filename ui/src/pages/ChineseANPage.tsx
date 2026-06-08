import { GuideModal } from '../components/ds/GuideModal'

// WIP: Using n8n hosted form directly while we build out this page
const N8N_FORM_URL = 'https://astroproduct.app.n8n.cloud/form/a1120c9c-5dfd-4a34-ba94-cf7667bbfebf'

export function ChineseANPage() {

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">ChineseAN Product Feed</h1>
              <p className="text-neutral-500 mt-1 text-sm">Pull affiliate-ready products from a ChineseAN merchant (PUMA, Adidas, Trip.com) and get back a processed Excel file.</p>
            </div>
            <GuideModal title="How to use the ChineseAN Product Feed">
              <div className="space-y-4">
                <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-600">
                  <li>Click <span className="font-semibold">Start now</span> to open the form.</li>
                  <li>Pick a merchant — PUMA MY, Adidas MY, or Trip.com (Flights &amp; Hotels).</li>
                  <li>Set how many products you want (default 100, max 1000).</li>
                  <li>Download the Excel — each row has the product, affiliate link, price, and CMS tags ready to publish.</li>
                </ol>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs font-semibold text-yellow-800">🚧 Work in Progress</p>
                  <p className="text-xs text-yellow-700 mt-1">We're building this page. Using the n8n form for now.</p>
                </div>
              </div>
            </GuideModal>
          </div>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-12 text-center space-y-4">
            <p className="text-neutral-950 font-medium">Fill in this form to pull the ChineseAN Product Feed</p>
            <button
              onClick={() => window.open(N8N_FORM_URL, '_blank')}
              className="inline-block px-6 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
            >
              Start now
            </button>
          </div>

          <div className="bg-neutral-100/50 rounded-2xl p-6 text-center border border-neutral-200">
            <p className="text-sm text-neutral-600">🚧 <span className="font-semibold">We're building this page</span> for a better user experience. Coming soon!</p>
          </div>
        </div>
      </div>
    </main>
  )
}
