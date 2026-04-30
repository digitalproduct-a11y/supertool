export const RSS_FEEDS_BY_BRAND: Record<string, string[]> = {
  // MBNS
  'Gempak':          ['https://gempak.com/rss.xml'],
  'XUAN':            ['https://xuan.com.my/rss.xml'],
  'Hotspot':         [], // Derived from XUAN feed — articles under /hotspot/ path
  'Astro Ulagam':    ['https://astroulagam.com.my/rss.xml'],
  'Stadium Astro':   ['https://stadiumastro.com/rss.xml'],
  'Astro Arena':     ['https://english.stadiumastro.com/rss.xml'],
  'Astro Awani':     ['https://www.astroawani.com/rss/latest/public', 'https://www.astroawani.com/rss/latest/en/public'],
  // NISB
  'Impiana':         ['https://www.impiana.my/feed/nisb'],
  'Media Hiburan':   ['https://www.mediahiburan.my/feed/nisb'],
  'Majalah Pama':    ['https://www.majalahpama.my/feed/nisb'],
  'Mingguan Wanita': ['https://www.mingguanwanita.my/feed/nisb'],
  'Rasa':            ['https://www.rasa.my/feed/nisb'],
  'Remaja':          ['https://www.remaja.my/feed/nisb'],
  'Nona':            ['https://www.nona.my/feed/nisb'],
}

export const BRAND_GROUPS: { label: string; brands: string[] }[] = [
  {
    label: 'MBNS',
    brands: ['Gempak', 'XUAN', 'Hotspot', 'Astro Ulagam', 'Stadium Astro', 'Astro Arena', 'Astro Awani'],
  },
  {
    label: 'NISB',
    brands: ['Impiana', 'Media Hiburan', 'Majalah Pama', 'Mingguan Wanita', 'Rasa', 'Remaja', 'Nona'],
  },
]
