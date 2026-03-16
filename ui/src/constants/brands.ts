export const BRANDS = [
  'Astro Awani',
  'Astro Arena',
  'Astro Ulagam',
  'Era',
  'Gegar',
  'Gempak',
  'Hitz',
  'Hotspot',
  'Keluarga',
  'Lite',
  'Majalah Pama',
  'Maskulin',
  'Media Hiburan',
  'Melody',
  'Mingguan Wanita',
  'Mix',
  'My',
  'Nona',
  'Pa&Ma',
  'Raaga',
  'Rasa',
  'Remaja',
  'Roda Panas',
  'Rojak Daily',
  'Sinar',
  'Stadium Astro',
  'XUAN',
  'Zayan',
] as const

export type BrandName = (typeof BRANDS)[number]

export const DOMAIN_TO_BRAND: Record<string, { brand: BrandName; language: string; template: string }> = {
  'astroawani.com': { brand: 'Astro Awani', language: 'BM', template: 'Astro Awani' },
  'english.astroawani.com': { brand: 'Astro Awani', language: 'EN', template: 'Astro Awani' },
  'stadiumastro.com': { brand: 'Stadium Astro', language: 'BM', template: 'Stadium Astro' },
  'english.stadiumastro.com': { brand: 'Stadium Astro', language: 'EN', template: 'Astro Arena' },
  'astroulagam.com.my': { brand: 'Astro Ulagam', language: 'BM', template: 'Astro Ulagam' },
  'gempak.com': { brand: 'Gempak', language: 'BM', template: 'Gempak' },
  'xuan.com.my': { brand: 'XUAN', language: 'BM', template: 'XUAN' },
  'mediahiburan.my': { brand: 'Media Hiburan', language: 'BM', template: 'Media Hiburan' },
  'mingguanwanita.my': { brand: 'Mingguan Wanita', language: 'BM', template: 'Mingguan Wanita' },
  'nona.my': { brand: 'Nona', language: 'BM', template: 'Nona' },
  'rasa.my': { brand: 'Rasa', language: 'BM', template: 'Rasa' },
  'remaja.my': { brand: 'Remaja', language: 'BM', template: 'Remaja' },
  'majalahpama.my': { brand: 'Majalah Pama', language: 'BM', template: 'Majalah Pama' },
}

export function extractDomainFromUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url)
    return hostname.replace('www.', '')
  } catch {
    return null
  }
}

export function detectBrandFromUrl(url: string): BrandName | null {
  const domain = extractDomainFromUrl(url)
  if (!domain) return null
  return DOMAIN_TO_BRAND[domain]?.brand ?? null
}

export function detectBrandInfoFromUrl(url: string): { brand: BrandName; language: string; template: string } | null {
  const domain = extractDomainFromUrl(url)
  if (!domain) return null
  return DOMAIN_TO_BRAND[domain] ?? null
}
