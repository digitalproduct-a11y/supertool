export const BRANDS = [
  "Astro Awani",
  "Astro Arena",
  "Astro Ulagam",
  "Era",
  "Era Sabah",
  "Era Sarawak",
  "Gegar",
  "Gempak",
  "Goxuan",
  "Hitz",
  "Hotspot",
  "Impiana",
  "Keluarga",
  "Lite",
  "Maskulin",
  "Media Hiburan",
  "Meletop",
  "Melody",
  "Mingguan Wanita",
  "Mix",
  "MY",
  "Nona",
  "Pa&Ma",
  "Raaga",
  "Rasa",
  "Remaja",
  "Roda Panas",
  "Rojak Daily",
  "Sinar",
  "Stadium Astro",
  "XUAN",
  "Zayan",
] as const;

export type BrandName = (typeof BRANDS)[number];

export const DOMAIN_TO_BRAND: Record<
  string,
  { brand: BrandName; language: string; template: string }
> = {
  "astroawani.com": {
    brand: "Astro Awani",
    language: "BM",
    template: "Astro Awani",
  },
  "international.astroawani.com": {
    brand: "Astro Awani",
    language: "EN",
    template: "Astro Awani",
  },
  "stadiumastro.com": {
    brand: "Astro Arena",
    language: "BM",
    template: "Astro Arena",
  },
  "english.stadiumastro.com": {
    brand: "Stadium Astro",
    language: "EN",
    template: "Astro Arena",
  },
  "astroulagam.com.my": {
    brand: "Astro Ulagam",
    language: "BM",
    template: "Astro Ulagam",
  },
  "gempak.com": { brand: "Gempak", language: "BM", template: "Gempak" },
  "xuan.com.my": { brand: "XUAN", language: "BM", template: "XUAN" },
  "mediahiburan.my": {
    brand: "Media Hiburan",
    language: "BM",
    template: "Media Hiburan",
  },
  "mingguanwanita.my": {
    brand: "Mingguan Wanita",
    language: "BM",
    template: "Mingguan Wanita",
  },
  "nona.my": { brand: "Nona", language: "BM", template: "Nona" },
  "rasa.my": { brand: "Rasa", language: "BM", template: "Rasa" },
  "remaja.my": { brand: "Remaja", language: "BM", template: "Remaja" },
  "majalahpama.my": { brand: "Pa&Ma", language: "BM", template: "Pa&Ma" },
  "era.je": { brand: "Era", language: "BM", template: "Era" },
  "era.je/sabah": { brand: "Era Sabah", language: "BM", template: "Era Sabah" },
  "era.je/sarawak": {
    brand: "Era Sarawak",
    language: "BM",
    template: "Era Sarawak",
  },
  "zayan.my": { brand: "Zayan", language: "BM", template: "Zayan" },
  "gegar.my": { brand: "Gegar", language: "BM", template: "Gegar" },
  "lite.my": { brand: "Lite", language: "BM", template: "Lite" },
  "hitz.com.my": { brand: "Hitz", language: "BM", template: "Hitz" },
  "mix.my": { brand: "Mix", language: "BM", template: "Mix" },
  "raaga.my": { brand: "Raaga", language: "BM", template: "Raaga" },
  "sinar.my": { brand: "Sinar", language: "BM", template: "Sinar" },
  "impiana.my": { brand: "Impiana", language: "BM", template: "Impiana" },
};

export function extractDomainFromUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname.replace("www.", "");
  } catch {
    return null;
  }
}

function lookupByUrl(
  url: string,
): { brand: BrandName; language: string; template: string } | null {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace("www.", "");
    const firstSegment = pathname.split("/").filter(Boolean)[0];

    // Check path-qualified key first (e.g., 'era.je/sabah')
    if (firstSegment) {
      const pathKey = `${host}/${firstSegment}`;
      if (DOMAIN_TO_BRAND[pathKey]) return DOMAIN_TO_BRAND[pathKey];
    }

    // Fall back to hostname-only key
    return DOMAIN_TO_BRAND[host] ?? null;
  } catch {
    return null;
  }
}

export function detectBrandFromUrl(url: string): BrandName | null {
  const info = lookupByUrl(url);
  return info?.brand ?? null;
}

export function detectBrandInfoFromUrl(
  url: string,
): { brand: BrandName; language: string; template: string } | null {
  return lookupByUrl(url);
}

// Source of truth: https://astroproduct.app.n8n.cloud/projects/FAqnoIGG9IK6ZkDY/datatables/WrA94W8RTzSvEhyS
// Re-pull via n8n MCP `n8n_manage_datatable` (tableId: WrA94W8RTzSvEhyS) when brands change.
// Values mirror the data table — do not edit by hand without updating the table first.
export const BRAND_HEX: Record<BrandName, string> = {
  "Astro Awani": "#ff4500",
  "Astro Arena": "#1473e6",
  "Astro Ulagam": "#000000",
  Era: "#000000",
  "Era Sabah": "#000000",
  "Era Sarawak": "#000000",
  Gegar: "#000000",
  Gempak: "#e50448",
  Goxuan: "#000000",
  Hitz: "#000000",
  Hotspot: "#CB2029",
  Impiana: "#000000",
  Keluarga: "#000000",
  Lite: "#000000",
  Maskulin: "#000000",
  "Media Hiburan": "#000000",
  Meletop: "#000000",
  Melody: "#000000",
  "Mingguan Wanita": "#000000",
  Mix: "#000000",
  MY: "#000000",
  Nona: "#000000",
  "Pa&Ma": "#000000",
  Raaga: "#000000",
  Rasa: "#000000",
  Remaja: "#000000",
  "Roda Panas": "#000000",
  "Rojak Daily": "#e50448",
  Sinar: "#000000",
  "Stadium Astro": "#1473e6",
  XUAN: "#8900f2",
  Zayan: "#000000",
};

export function getBrandHex(brand: string): string {
  return (BRAND_HEX as Record<string, string>)[brand] ?? "#000000";
}

export const BRAND_LOGO_IDS: Record<BrandName, string> = {
  "Astro Awani": "astro_awani_logo",
  "Astro Arena": "astro_arena_logo",
  "Astro Ulagam": "astro_ulagam_logo",
  Era: "era_logo",
  "Era Sabah": "era_sabah_logo",
  "Era Sarawak": "era_sarawak_logo",
  Gegar: "gegar_logo",
  Gempak: "gempak_logo",
  Goxuan: "goxuan_logo",
  Hitz: "hitz_logo",
  Hotspot: "hotspot_logo",
  Impiana: "impiana_logo",
  Keluarga: "keluarga_logo",
  Lite: "lite_logo",
  Maskulin: "maskulin_logo",
  "Media Hiburan": "media_hiburan_logo",
  Meletop: "meletop_logo",
  Melody: "melody_logo",
  "Mingguan Wanita": "mingguan_wanita_logo",
  Mix: "mix_logo",
  MY: "my_logo",
  Nona: "nona_logo",
  "Pa&Ma": "pa_ma_logo",
  Raaga: "raaga_logo",
  Rasa: "rasa_logo",
  Remaja: "remaja_logo",
  "Roda Panas": "roda_panas_logo",
  "Rojak Daily": "rojak_daily_logo",
  Sinar: "sinar_logo",
  "Stadium Astro": "stadium_astro_logo",
  XUAN: "xuan_logo",
  Zayan: "zayan_logo",
};
