// Static UI labels for the election result cards, per brand language. Default is
// BM (the existing strings); the Hotspot brand (热点, BRAND_LANGUAGE "ZH") gets
// Chinese equivalents. Seat / candidate / party names are localized separately
// via hotspotNames.ts + partyZh.ts.

export interface ElectionLabels {
  duNegeri: string; // Dewan Undangan Negeri (seat eyebrow)
  parlimen: string; // "Parlimen" prefix on the parliament subline
  official: string; // Keputusan Rasmi (status pill)
  unofficial: string; // Keputusan Tidak Rasmi
  majoriti: string; // Majoriti
  undiSuffix: string; // "undi" after the vote %
  pengundiBerdaftar: string; // Pengundi Berdaftar (footer)
  jumlahUndi: string; // Jumlah Undi (footer)
  peratusKeluar: string; // Peratus Keluar Mengundi (footer)
  kerusiUtama: string; // Kerusi Utama (heavyweight eyebrow)
  lawan: string; // "lawan" divider (heavyweight)
  menang: string; // "Menang" tag (heavyweight winner)
  keputusanTerkini: string; // Keputusan Terkini (scoreboard eyebrow)
  diisytihar: string; // "kerusi diisytihar" (scoreboard declared line)
  toGovern: string; // seats-to-govern callout (scoreboard)
  mendahului: string; // "MENDAHULUI" leader tag (scoreboard)
}

const BM: ElectionLabels = {
  duNegeri: "Dewan Undangan Negeri",
  parlimen: "Parlimen",
  official: "Keputusan Rasmi",
  unofficial: "Keputusan Tidak Rasmi",
  majoriti: "Majoriti",
  undiSuffix: "undi",
  pengundiBerdaftar: "Pengundi Berdaftar",
  jumlahUndi: "Jumlah Undi",
  peratusKeluar: "Peratus Keluar Mengundi",
  kerusiUtama: "Kerusi Utama",
  lawan: "lawan",
  menang: "Menang",
  keputusanTerkini: "Keputusan Terkini",
  diisytihar: "kerusi diisytihar",
  toGovern: "kerusi diperlukan untuk membentuk kerajaan",
  mendahului: "MENDAHULUI",
};

const ZH: ElectionLabels = {
  duNegeri: "州议席",
  parlimen: "国会选区",
  official: "正式成绩",
  unofficial: "非正式成绩",
  majoriti: "多数票",
  undiSuffix: "得票",
  pengundiBerdaftar: "登记选民",
  jumlahUndi: "总投票数",
  peratusKeluar: "投票率",
  kerusiUtama: "焦点议席",
  lawan: "对垒",
  menang: "胜",
  keputusanTerkini: "最新成绩",
  diisytihar: "议席结果已官宣",
  toGovern: "执政所需议席",
  mendahului: "领先",
};

/** True for the Hotspot (Chinese) brand — gates the ZH template + translations. */
export function isHotspot(brand: string): boolean {
  return brand === "Hotspot";
}

export function electionLabels(brand: string): ElectionLabels {
  return isHotspot(brand) ? ZH : BM;
}
