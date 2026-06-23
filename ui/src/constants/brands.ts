export const BRANDS = [
  "Astro Awani",
  "Astro Arena",
  "Astro Radio News",
  "Astro Radio Traffic",
  "Astro Ulagam",
  "Bintang Kecil",
  "Era",
  "Era Sabah",
  "Era Sarawak",
  "Gegar",
  "Gempak",
  "Goxuan",
  "Hijabista",
  "Hitz",
  "Hotspot",
  "Impiana",
  "Kashoorga",
  "Keluarga",
  "Libur",
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
  "Rapi",
  "Rasa",
  "Remaja",
  "Roda Panas",
  "Rojak Daily",
  "Sinar",
  "Stadium Astro",
  "SYOK BM",
  "SYOK CHI",
  "SYOK EN",
  "Vanilla Kismis",
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
  "Astro Radio News": "#8B2ABF",
  "Astro Radio Traffic": "#000000",
  "Astro Ulagam": "#7B2CBF",
  "Bintang Kecil": "#000000",
  Era: "#000000",
  "Era Sabah": "#000000",
  "Era Sarawak": "#000000",
  Gegar: "#000000",
  Gempak: "#e50448",
  Goxuan: "#000000",
  Hijabista: "#000000",
  Hitz: "#000000",
  Hotspot: "#CB2029",
  Impiana: "#4A2859",
  Kashoorga: "#000000",
  Keluarga: "#5DADE2",
  Libur: "#000000",
  Lite: "#000000",
  Maskulin: "#1A1A1A",
  "Media Hiburan": "#E63946",
  Meletop: "#000000",
  Melody: "#000000",
  "Mingguan Wanita": "#C7161E",
  Mix: "#000000",
  MY: "#000000",
  Nona: "#000000",
  "Pa&Ma": "#FF69B4",
  Raaga: "#000000",
  Rapi: "#000000",
  Rasa: "#E91D26",
  Remaja: "#FF1493",
  "Roda Panas": "#000000",
  "Rojak Daily": "#000000",
  Sinar: "#000000",
  "Stadium Astro": "#1473e6",
  "SYOK BM": "#000000",
  "SYOK CHI": "#000000",
  "SYOK EN": "#000000",
  "Vanilla Kismis": "#000000",
  XUAN: "#8900f2",
  Zayan: "#000000",
};

export function getBrandHex(brand: string): string {
  return (BRAND_HEX as Record<string, string>)[brand] ?? "#000000";
}

// Source of truth: Brand Tone & Voice data table (tableId WrA94W8RTzSvEhyS),
// `font_use` column. Mirrored here so frontends can resolve the brand font
// without depending on each n8n workflow remembering to return it.
//
// Values follow the same two shapes consumed by `loadBrandFont()`:
//   1. Cloudinary asset reference, e.g. "Fonts:LeagueSpartan-Bold.ttf" →
//      mapped to a bundled file under `ui/public/fonts/` via CLOUDINARY_TO_LOCAL.
//   2. Plain Google Fonts / system family name, e.g. "Montserrat", "Rubik",
//      "Times New Roman".
//
// `null` = brand has no canonical display font yet; canvas falls back to its
// configured default (Inter / template default).
//
// Re-pull via n8n MCP `n8n_manage_datatable` (tableId: WrA94W8RTzSvEhyS) when
// brand fonts change. Do not edit by hand without updating the data table first.
export const BRAND_FONT_USE: Record<BrandName, string | null> = {
  "Astro Awani": null,
  "Astro Arena": "Montserrat",
  "Astro Radio News": null,
  "Astro Radio Traffic": null,
  "Astro Ulagam": "fonts:leaguespartan.ttf",
  "Bintang Kecil": null,
  Era: "Fonts:LeagueSpartan-Bold.ttf",
  "Era Sabah": "Archivo Black",
  "Era Sarawak": "Poppins",
  Gegar: "Fonts:LeagueSpartan-Bold.ttf",
  Gempak: "Open Sans",
  Goxuan: "Rubik",
  Hijabista: null,
  Hitz: "Rubik",
  Hotspot: "Fonts:方正兰亭特黑简体.ttf",
  Impiana: null,
  Kashoorga: null,
  Keluarga: null,
  Libur: null,
  Lite: "Fonts:LeagueSpartan-Bold.ttf",
  Maskulin: null,
  "Media Hiburan": "fonts:leaguespartan.ttf",
  Meletop: "Fonts:LeagueSpartan-Bold.ttf",
  Melody: null,
  "Mingguan Wanita": "Times New Roman",
  Mix: "Rubik",
  MY: "Montserrat",
  Nona: "Fonts:canvasans.ttf",
  "Pa&Ma": "Fonts:ITCAvantGardeStdBold.ttf",
  Raaga: "Fonts:LeagueSpartan-Bold.ttf",
  Rapi: null,
  Rasa: "fonts:leaguespartan.ttf",
  Remaja: null,
  "Roda Panas": null,
  "Rojak Daily": null,
  Sinar: "Fonts:Anton-Regular.ttf",
  "Stadium Astro": "Montserrat",
  "SYOK BM": null,
  "SYOK CHI": null,
  "SYOK EN": null,
  "Vanilla Kismis": null,
  XUAN: "Fonts:SourceHanSansCN-Heavy-2.otf",
  Zayan: "Fonts:ArchivoBlack-Regular.ttf",
};

export function getBrandFontUse(brand: string): string | null {
  return (BRAND_FONT_USE as Record<string, string | null>)[brand] ?? null;
}

// Source of truth: Brand Tone & Voice data table (tableId WrA94W8RTzSvEhyS),
// `language` column. Re-pull via n8n MCP `n8n_manage_datatable` when brands
// change. "BM" = Malay, "EN" = English, "ZH" = Chinese Simplified.
export type BrandLanguage = "BM" | "EN" | "ZH";

export const BRAND_LANGUAGE: Record<BrandName, BrandLanguage> = {
  "Astro Awani": "BM",
  "Astro Arena": "BM",
  "Astro Radio News": "BM",
  "Astro Radio Traffic": "BM",
  "Astro Ulagam": "EN",
  "Bintang Kecil": "BM",
  Era: "BM",
  "Era Sabah": "BM",
  "Era Sarawak": "BM",
  Gegar: "BM",
  Gempak: "BM",
  Goxuan: "ZH",
  Hijabista: "BM",
  Hitz: "EN",
  Hotspot: "ZH",
  Impiana: "BM",
  Kashoorga: "BM",
  Keluarga: "BM",
  Libur: "BM",
  Lite: "EN",
  Maskulin: "BM",
  "Media Hiburan": "BM",
  Meletop: "BM",
  Melody: "ZH",
  "Mingguan Wanita": "BM",
  Mix: "EN",
  MY: "ZH",
  Nona: "BM",
  "Pa&Ma": "BM",
  Raaga: "EN",
  Rapi: "BM",
  Rasa: "BM",
  Remaja: "BM",
  "Roda Panas": "BM",
  "Rojak Daily": "EN",
  Sinar: "BM",
  "Stadium Astro": "EN",
  "SYOK BM": "BM",
  "SYOK CHI": "ZH",
  "SYOK EN": "EN",
  "Vanilla Kismis": "BM",
  XUAN: "ZH",
  Zayan: "BM",
};

export function getBrandLanguage(brand: string): BrandLanguage {
  return (BRAND_LANGUAGE as Record<string, BrandLanguage>)[brand] ?? "BM";
}

export const BRAND_LOGO_IDS: Record<BrandName, string> = {
  "Astro Awani": "astro_awani_logo",
  "Astro Arena": "astro_arena_logo",
  "Astro Radio News": "astro_radio_news_logo",
  "Astro Radio Traffic": "",
  "Astro Ulagam": "astro_ulagam_logo",
  "Bintang Kecil": "",
  Era: "era_logo",
  "Era Sabah": "era_sabah_logo",
  "Era Sarawak": "era_sarawak_logo",
  Gegar: "gegar_logo",
  Gempak: "gempak_logo",
  Goxuan: "goxuan_logo",
  Hijabista: "",
  Hitz: "hitz_logo",
  Hotspot: "hotspot_logo",
  Impiana: "impiana_logo",
  Kashoorga: "",
  Keluarga: "keluarga_logo",
  Libur: "",
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
  Rapi: "",
  Rasa: "rasa_logo",
  Remaja: "remaja_logo",
  "Roda Panas": "roda_panas_logo",
  "Rojak Daily": "rojak_daily_logo",
  Sinar: "sinar_logo",
  "Stadium Astro": "stadium_astro_logo",
  "SYOK BM": "syok_bm-logo",
  "SYOK CHI": "syok_chi-logo",
  "SYOK EN": "syok_eng-logo",
  "Vanilla Kismis": "",
  XUAN: "xuan_logo",
  Zayan: "zayan_logo",
};

export const BRAND_LOGO_URLS: Record<BrandName, string> = {
  "Astro Awani":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/astro_awani_logo",
  "Astro Arena":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/astro_arena_logo",
  "Astro Radio News":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/astro_radio_news_logo",
  "Astro Radio Traffic": "",
  "Astro Ulagam":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/astro_ulagam_logo",
  "Bintang Kecil": "",
  Era: "https://res.cloudinary.com/dymmqtqyg/image/upload/era_logo",
  "Era Sabah":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/era_sabah_logo",
  "Era Sarawak":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/era_sarawak_logo",
  Gegar: "https://res.cloudinary.com/dymmqtqyg/image/upload/gegar_logo",
  Gempak: "https://res.cloudinary.com/dymmqtqyg/image/upload/gempak_logo",
  Goxuan: "https://res.cloudinary.com/dymmqtqyg/image/upload/goxuan_logo",
  Hijabista: "",
  Hitz: "https://res.cloudinary.com/dymmqtqyg/image/upload/hitz_logo",
  Hotspot: "https://res.cloudinary.com/dymmqtqyg/image/upload/hotspot_logo",
  Impiana: "https://res.cloudinary.com/dymmqtqyg/image/upload/impiana_logo",
  Kashoorga: "",
  Keluarga: "https://res.cloudinary.com/dymmqtqyg/image/upload/keluarga_logo",
  Libur: "",
  Lite: "https://res.cloudinary.com/dymmqtqyg/image/upload/lite_logo",
  Maskulin: "https://res.cloudinary.com/dymmqtqyg/image/upload/maskulin_logo",
  "Media Hiburan":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/media_hiburan_logo",
  Meletop: "https://res.cloudinary.com/dymmqtqyg/image/upload/meletop_logo",
  Melody: "https://res.cloudinary.com/dymmqtqyg/image/upload/melody_logo",
  "Mingguan Wanita":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/mingguan_wanita_logo",
  Mix: "https://res.cloudinary.com/dymmqtqyg/image/upload/mix_logo",
  MY: "https://res.cloudinary.com/dymmqtqyg/image/upload/my_logo",
  Nona: "https://res.cloudinary.com/dymmqtqyg/image/upload/nona_logo",
  "Pa&Ma": "https://res.cloudinary.com/dymmqtqyg/image/upload/pa_ma_logo",
  Raaga: "https://res.cloudinary.com/dymmqtqyg/image/upload/raaga_logo",
  Rapi: "",
  Rasa: "https://res.cloudinary.com/dymmqtqyg/image/upload/rasa_logo",
  Remaja: "https://res.cloudinary.com/dymmqtqyg/image/upload/remaja_logo",
  "Roda Panas":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/roda_panas_logo",
  "Rojak Daily":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/rojak_daily_logo",
  Sinar: "https://res.cloudinary.com/dymmqtqyg/image/upload/sinar_logo",
  "Stadium Astro":
    "https://res.cloudinary.com/dymmqtqyg/image/upload/stadium_astro_logo",
  "SYOK BM": "https://res.cloudinary.com/dymmqtqyg/image/upload/syok_bm-logo",
  "SYOK CHI": "https://res.cloudinary.com/dymmqtqyg/image/upload/syok_chi-logo",
  "SYOK EN": "https://res.cloudinary.com/dymmqtqyg/image/upload/syok_eng-logo",
  "Vanilla Kismis": "",
  XUAN: "https://res.cloudinary.com/dymmqtqyg/image/upload/xuan_logo",
  Zayan: "https://res.cloudinary.com/dymmqtqyg/image/upload/zayan_logo",
};

export function getBrandLogoUrl(brand: string): string {
  return (BRAND_LOGO_URLS as Record<string, string>)[brand] ?? "";
}

export const BRANDS_WITH_DARK_BG = new Set<BrandName>([
  "Astro Radio News",
  "Astro Ulagam",
  "Rojak Daily",
  "Stadium Astro",
  "Hotspot",
  "Impiana",
  "Keluarga",
  "Maskulin",
  "Media Hiburan",
  "Mingguan Wanita",
  "Nona",
  "Pa&Ma",
  "Rasa",
  "Remaja",
  "Roda Panas",
]);

export function needsDarkBg(brand: string): boolean {
  return BRANDS_WITH_DARK_BG.has(brand as BrandName);
}

export const ENTITY_LABELS: Record<BrandEntity, string> = {
  AASB: "Astro",
  MBNS: "Astro",
  ARSB: "Astro Radio",
  NISB: "Nu Ideaktiv",
};

export function getEntityLabel(brand: string): string {
  const entity = (BRAND_ENTITY as Record<string, BrandEntity>)[brand];
  return ENTITY_LABELS[entity] ?? "—";
}

export type BrandEntity = "AASB" | "MBNS" | "ARSB" | "NISB";

export const BRAND_ENTITY: Record<BrandName, BrandEntity> = {
  "Astro Awani": "AASB",
  "Astro Arena": "MBNS",
  "Astro Radio News": "ARSB",
  "Astro Radio Traffic": "ARSB",
  "Astro Ulagam": "MBNS",
  "Bintang Kecil": "NISB",
  Era: "ARSB",
  "Era Sabah": "ARSB",
  "Era Sarawak": "ARSB",
  Gegar: "ARSB",
  Gempak: "MBNS",
  Goxuan: "ARSB",
  Hijabista: "NISB",
  Hitz: "ARSB",
  Hotspot: "MBNS",
  Impiana: "NISB",
  Kashoorga: "NISB",
  Keluarga: "NISB",
  Libur: "NISB",
  Lite: "ARSB",
  Maskulin: "NISB",
  "Media Hiburan": "NISB",
  Meletop: "MBNS",
  Melody: "ARSB",
  "Mingguan Wanita": "NISB",
  Mix: "ARSB",
  MY: "ARSB",
  Nona: "NISB",
  "Pa&Ma": "NISB",
  Raaga: "ARSB",
  Rapi: "NISB",
  Rasa: "NISB",
  Remaja: "NISB",
  "Roda Panas": "NISB",
  "Rojak Daily": "MBNS",
  Sinar: "ARSB",
  "Stadium Astro": "MBNS",
  "SYOK BM": "ARSB",
  "SYOK CHI": "ARSB",
  "SYOK EN": "ARSB",
  "Vanilla Kismis": "NISB",
  XUAN: "MBNS",
  Zayan: "ARSB",
};

export function getBrandEntity(brand: string): BrandEntity {
  return (BRAND_ENTITY as Record<string, BrandEntity>)[brand] ?? "NISB";
}

export const YT_BRAND_ALIASES: Record<string, string> = {
  "Zayan My": "Zayan",
};

// Normalize brand names from n8n data to canonical BRANDS list
export const N8N_TO_CANONICAL_BRAND: Record<string, string> = {
  "ASTRO AWANI": "Astro Awani",
  "ASTRO ARENA": "Astro Arena",
  "ASTRO ULAGAM": "Astro Ulagam",
  ERA: "Era",
  "ERA SABAH": "Era Sabah",
  "ERA SARAWAK": "Era Sarawak",
  GEGAR: "Gegar",
  "ASTRO GEMPAK": "Gempak",
  GOXUAN: "Goxuan",
  HITZ: "Hitz",
  "热点 HOTSPOT": "Hotspot",
  IMPIANA: "Impiana",
  KELUARGA: "Keluarga",
  LITE: "Lite",
  MASKULIN: "Maskulin",
  "MEDIA HIBURAN": "Media Hiburan",
  MELETOP: "Meletop",
  MELODY: "Melody",
  "MINGGUAN WANITA": "Mingguan Wanita",
  MIX: "Mix",
  "MY (MALAYSIA)": "MY",
  NONA: "Nona",
  "PA&MA": "Pa&Ma",
  RAAGA: "Raaga",
  RASA: "Rasa",
  REMAJA: "Remaja",
  "RODA PANAS": "Roda Panas",
  "ROJAK DAILY": "Rojak Daily",
  SINAR: "Sinar",
  "STADIUM ASTRO": "Stadium Astro",
  XUAN: "XUAN",
  ZAYAN: "Zayan",
  "ASTRO AEC 新闻报报看": "ASTRO AEC 新闻报报看",
  "Astro AEC 新闻报报看": "ASTRO AEC 新闻报报看",
};

export function normalizeN8NBrand(n8nBrand: string): string | null {
  return N8N_TO_CANONICAL_BRAND[n8nBrand] ?? null;
}

// Maps each brand to its exact Facebook page display name as shown in Zernio.
// null = not yet mapped; the filter will fall back to a loose includes() match.
// Update this when FB page names change or new brands are onboarded.
export const BRAND_FB_PAGE_NAME: Partial<Record<BrandName, string | null>> = {
  "Astro Awani": "Astro AWANI",
  "Astro Arena": "Astro Arena",
  "Astro Radio News": "Astro Radio News",
  "Astro Radio Traffic": "Astro Radio Traffic",
  "Astro Ulagam": "Astro Ulagam",
  "Bintang Kecil": "Bintang Kecil",
  Era: "ERA (Malaysia)",
  "Era Sabah": "ERA Sabah",
  "Era Sarawak": "ERA Sarawak",
  Gegar: "GEGAR",
  Gempak: "Astro Gempak",
  Goxuan: "GOXUAN",
  Hijabista: "Hijabista",
  Hitz: "HITZ",
  Hotspot: "热点 Hotspot",
  Impiana: "Impiana",
  Kashoorga: "Kashoorga",
  Keluarga: "Keluarga",
  Libur: "Majalah Libur",
  Lite: "LITE (Malaysia)",
  Maskulin: "Maskulin",
  "Media Hiburan": "MEDIA HIBURAN",
  Meletop: "MeleTop",
  Melody: "MELODY",
  "Mingguan Wanita": "Mingguan Wanita",
  Mix: "MIX (Malaysia)",
  MY: "MY (Malaysia)",
  Nona: "Nona",
  "Pa&Ma": "Pa&Ma",
  Raaga: "Raaga (Malaysia)",
  Rapi: "Rapi",
  Rasa: "Rasa",
  Remaja: "Remaja",
  "Roda Panas": "Roda Panas",
  "Rojak Daily": "Rojak Daily",
  Sinar: "SINAR",
  "Stadium Astro": "Stadium Astro",
  "SYOK BM": "SYOK BM",
  "SYOK CHI": "SYOK CHI",
  "SYOK EN": "SYOK ENG",
  "Vanilla Kismis": "Vanilla Kismis",
  XUAN: "XUAN",
  Zayan: "ZAYAN",
};

export function getBrandFbPageName(brand: string): string | null {
  return (BRAND_FB_PAGE_NAME as Record<string, string | null>)[brand] ?? null;
}
