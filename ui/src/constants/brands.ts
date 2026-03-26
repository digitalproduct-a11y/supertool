export const BRANDS = [
  'Astro Awani',
  'Astro Arena',
  'Astro Ulagam',
  'Era',
  'Era Sabah',
  'Era Sarawak',
  'Gegar',
  'Gempak',
  'Goxuan',
  'Hitz',
  'Hotspot',
  'Impiana',
  'Keluarga',
  'Lite',
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
  'international.astroawani.com': { brand: 'Astro Awani', language: 'EN', template: 'Astro Awani' },
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
  'majalahpama.my': { brand: 'Pa&Ma', language: 'BM', template: 'Pa&Ma' },
  'era.je': { brand: 'Era', language: 'BM', template: 'Era' },
  'era.je/sabah': { brand: 'Era Sabah', language: 'BM', template: 'Era Sabah' },
  'era.je/sarawak': { brand: 'Era Sarawak', language: 'BM', template: 'Era Sarawak' },
  'zayan.my': { brand: 'Zayan', language: 'BM', template: 'Zayan' },
  'gegar.my': { brand: 'Gegar', language: 'BM', template: 'Gegar' },
  'lite.my': { brand: 'Lite', language: 'BM', template: 'Lite' },
  'hitz.com.my': { brand: 'Hitz', language: 'BM', template: 'Hitz' },
  'mix.my': { brand: 'Mix', language: 'BM', template: 'Mix' },
  'raaga.my': { brand: 'Raaga', language: 'BM', template: 'Raaga' },
  'my.syok.my': { brand: 'My', language: 'BM', template: 'My' },
  'goxuan.syok.my': { brand: 'Goxuan', language: 'BM', template: 'Goxuan' },
  'melody.syok.my': { brand: 'Melody', language: 'BM', template: 'Melody' },
  'impiana.my': { brand: 'Impiana', language: 'BM', template: 'Impiana' },
}
 
export function extractDomainFromUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url)
    return hostname.replace('www.', '')
  } catch {
    return null
  }
}
 
function lookupByUrl(url: string): { brand: BrandName; language: string; template: string } | null {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace('www.', '')
    const firstSegment = pathname.split('/').filter(Boolean)[0]
 
    // Check path-qualified key first (e.g., 'era.je/sabah')
    if (firstSegment) {
      const pathKey = `${host}/${firstSegment}`
      if (DOMAIN_TO_BRAND[pathKey]) return DOMAIN_TO_BRAND[pathKey]
    }
 
    // Fall back to hostname-only key
    return DOMAIN_TO_BRAND[host] ?? null
  } catch {
    return null
  }
}
 
export function detectBrandFromUrl(url: string): BrandName | null {
  const info = lookupByUrl(url)
  return info?.brand ?? null
}
 
export function detectBrandInfoFromUrl(url: string): { brand: BrandName; language: string; template: string } | null {
  return lookupByUrl(url)
}