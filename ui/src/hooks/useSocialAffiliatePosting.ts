import { useState } from 'react'
import type {
  SocialAffiliateState,
  SocialAffiliateFormData,
  SocialAffiliateGenerationResult,
} from '../types'

const MOCK_RESULT: SocialAffiliateGenerationResult = {
  sessionId: 'sess_mock123',
  createdAt: new Date().toISOString(),
  productName: 'Xiaomi Smart Desk Fan 30cm',
  affiliateLink: 'https://shopee.com/product/xxx',
  affiliateLinkGenerated: 'https://s.shopee.com.my/4pqAaWd3kT',
  angle: 'bilik panas dan ruang kecil',
  targetAudience: 'student dan orang bujang',
  tone: 'problem-solution',
  threads: {
    contentLabel: 'Student Cool Room Setup',
    posts: [
      { postNumber: 1, title: 'Hook', content: 'Tengok la, tengok. Tengah berpuasa sampai lebih jam 5 petang. Air cond bilik dorm sibuk jadi panas. Kipas biasa jadi tak cukup, suasana tercekik. Rasa nak pengsan sampai kena tidur tepi pintu. Ada solusi la untuk ini...' },
      { postNumber: 2, title: 'Pain Expansion', content: 'Masalahnya, bilik dorm size bilik tidur rumah sakit je. Kipas standing ambil separuh space. Keliling badan panas, gusi kering, produktiviti belajar jatuh picik. Pas exam season ni, lagi teruk sebab stress tinggi.' },
      { postNumber: 3, title: 'Solution + Features', content: 'Kena ada fan yang praktis. Kecil, tak ambil tempat, tapi angin kuat. Ada yang ada oscillation feature, boleh rotate 70 derajat. Boleh adjust 3 speed level. Siap dengan sleep mode lagi.' },
      { postNumber: 4, title: 'Product Recommendation', content: 'Xiaomi Smart Desk Fan 30cm ni solve semua. Letak kat atas meja study, angin terus kena badan, kepala sejuk. Besar-besaran design tapi compact, tak ganggu dekstop space. Boleh remote control lagi. Link ada kat bio kalau nak check.' },
      { postNumber: 5, title: 'CTA', content: 'Bilik dorm sejuk, kepala sejuk, belajar fokus. Sekali beli, semester panjang boleh tahan. Solusi paling praktis untuk ruang kecil. Check out link kat bio!' },
    ],
  },
  facebook: {
    contentLabel: 'Dorm Room Comfort Guide',
    paragraphs: [
      'Tengok la, tengok. Kalau kamu dorm student yang bilik tengah panas sepanjang hari, apatah lagi tengah cuaca puasa ni — kau tau exactly rasa apa.',
      'Masalahnya, space bilik dorm kita limited. Kipas standing gitu ambil separuh ruang, meja jadi bersepit, dan akhirnya kipas jadi hiasan je.',
      'Kena ada solution yang praktis dan smart. Xiaomi Smart Desk Fan 30cm ni designed untuk exactly situation kita — compact, powerful angin, dan features yang boleh guna.',
      'Kalau kau serious nak bilik sejuk dan comfort, Xiaomi Smart Desk Fan 30cm ni investment terbaik untuk dorm life. Beli sekali, tahan semester panjang.',
    ],
    fullText: 'Tengok la, tengok. Kalau kamu dorm student yang bilik tengah panas sepanjang hari, apatah lagi tengah cuaca puasa ni — kau tau exactly rasa apa.\n\nMasalahnya, space bilik dorm kita limited. Kipas standing gitu ambil separuh ruang, meja jadi bersepit, dan akhirnya kipas jadi hiasan je.\n\nKena ada solution yang praktis dan smart. Xiaomi Smart Desk Fan 30cm ni designed untuk exactly situation kita — compact, powerful angin, dan features yang boleh guna.\n\nKalau kau serious nak bilik sejuk dan comfort, Xiaomi Smart Desk Fan 30cm ni investment terbaik untuk dorm life. Beli sekali, tahan semester panjang.',
  },
}

function unwrapN8n<T>(data: T | T[]): T {
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error('Empty response from webhook')
    return data[0]
  }
  return data
}

export function useSocialAffiliatePosting() {
  const [state, setState] = useState<SocialAffiliateState>('idle')
  const [result, setResult] = useState<SocialAffiliateGenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<SocialAffiliateFormData | null>(null)

  const isMockMode = import.meta.env.VITE_SOCIAL_AFFILIATE_MOCK_MODE === 'true'

  const generate = async (data: SocialAffiliateFormData) => {
    setFormData(data)
    setState('loading')
    setError(null)

    try {
      let generationResult: SocialAffiliateGenerationResult

      if (isMockMode) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        generationResult = MOCK_RESULT
      } else {
        const generateUrl = import.meta.env.VITE_SOCIAL_AFFILIATE_POSTING_WEBHOOK_URL as string | undefined
        if (!generateUrl) {
          throw new Error('Content generation webhook URL is not configured')
        }

        const res = await fetch(generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(180_000),
        })
        if (!res.ok) throw new Error(`Webhook error: ${res.status}`)
        const raw = await res.json()
        generationResult = unwrapN8n<SocialAffiliateGenerationResult>(raw)
      }

      setResult(generationResult)
      setState('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(message)
      setState('error')
    }
  }

  const extractProductName = async (affiliateLink: string): Promise<string> => {
    const extractUrl = import.meta.env.VITE_SOCIAL_AFFILIATE_EXTRACT_NAME_WEBHOOK_URL as string | undefined
    if (!extractUrl) throw new Error('Extract product name webhook URL is not configured')

    const response = await fetch(extractUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affiliateLink }),
      mode: 'cors',
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) throw new Error('Failed to fetch product name')

    const data = await response.json()
    const unwrapped = Array.isArray(data) ? data[0] : data
    const name = unwrapped?.productName || ''
    if (!name) throw new Error('Could not extract product name from link')
    return name
  }

  const reset = () => {
    setState('idle')
    setResult(null)
    setError(null)
    setFormData(null)
  }

  return { state, result, error, formData, generate, extractProductName, reset }
}
