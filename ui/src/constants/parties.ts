// Party / coalition lookup for the Government State Election Results tool.
//
// Source of truth: n8n data table "Awani - Party Name"
//   https://astroproduct.app.n8n.cloud/projects/FAqnoIGG9IK6ZkDY/datatables/a7CvoG4mZcK5k5G6
// The live results feed (data.pru.astroawani.com) references parties by numeric
// `party` id only; this map reattaches name / abbreviation / colour / type.
// Re-pull via n8n MCP `n8n_manage_datatable` (tableId a7CvoG4mZcK5k5G6) when the
// table changes — do not hand-edit without updating the table first.

export type PartyType = "party" | "coalition";

export interface Party {
  name: string;
  abbreviation: string;
  color: string;
  type: PartyType;
}

export const PARTIES: Record<number, Party> = {
  1: { name: "BARISAN NASIONAL", abbreviation: "BN", color: "#000080", type: "coalition" },
  2: { name: "PARTI ISLAM SEMALAYSIA", abbreviation: "PAS", color: "#008800", type: "party" },
  3: { name: "PARTI TINDAKAN DEMOKRATIK", abbreviation: "DAP", color: "#ed1c24", type: "party" },
  4: { name: "BARISAN JEMAAH ISLAMIAH SE MALAYSIA", abbreviation: "BERJASA", color: "#005121", type: "party" },
  5: { name: "PARTI KONGRES INDIAN MUSLIM MALAYSIA", abbreviation: "KIMMA", color: "#DE8801", type: "party" },
  6: { name: "PARTI RAKYAT MALAYSIA", abbreviation: "PRM", color: "#FE8591", type: "party" },
  7: { name: "PARTI REFORMASI NEGERI SARAWAK", abbreviation: "STAR", color: "#CC3399", type: "party" },
  8: { name: "PARTI PUNJABI MALAYSIA", abbreviation: "PPM", color: "#CC9900", type: "party" },
  9: { name: "BEBAS", abbreviation: "BEBAS", color: "#ff3fab", type: "coalition" },
  10: { name: "PARTI MAJU SABAH", abbreviation: "SAPP", color: "#8a9a5a", type: "party" },
  11: { name: "PARTI BARISAN INDIA SE-MALAYSIA", abbreviation: "IPF", color: "#E30300", type: "party" },
  12: { name: "PARTI KEADILAN RAKYAT", abbreviation: "PKR", color: "#00adef", type: "party" },
  13: { name: "PENANG FRONT PARTY", abbreviation: "PFP", color: "#ffffff", type: "party" },
  14: { name: "PARTI GENERASI BARU", abbreviation: "NEWGEN", color: "#ffffff", type: "party" },
  15: { name: "PARTI PERTUBUHAN KEBANGSAAN SABAH BERSATU", abbreviation: "USNO", color: "#361650", type: "party" },
  16: { name: "PARTI RAKYAT BERSATU", abbreviation: "UPP", color: "#ffffff", type: "party" },
  17: { name: "PARTI MAKKALSAKTI MALAYSIA", abbreviation: "MMSP", color: "#ffffff", type: "party" },
  18: { name: "PARTI KESEJAHTERAAN INSAN TANAH AIR", abbreviation: "KITA", color: "#F58220", type: "party" },
  19: { name: "PARTI CINTA MALAYSIA", abbreviation: "PCM", color: "#F4E50E", type: "party" },
  20: { name: "PARTI PEKERJA SARAWAK", abbreviation: "SWP", color: "#FCF9A8", type: "party" },
  21: { name: "PARTI SOSIALIS MALAYSIA", abbreviation: "PSM", color: "#921a1c", type: "party" },
  22: { name: "PARTI KONGRES CEYLONESE MALAYSIA", abbreviation: "MCC", color: "#ed0602", type: "party" },
  23: { name: "PARTI AMANAH NEGARA", abbreviation: "AMANAH", color: "#f79220", type: "party" },
  24: { name: "PARTI PERPADUAN RAKYAT SABAH", abbreviation: "PPRS", color: "#ffb400", type: "party" },
  25: { name: "PARTI KERJASAMA ANAK NEGERI", abbreviation: "ANAKNEGERI", color: "#ba0401", type: "party" },
  26: { name: "PARTI RAKYAT GABUNGAN JAKSA PENDAMAI", abbreviation: "PEACE", color: "#ffffff", type: "party" },
  27: { name: "PARTI TENAGA RAKYAT SARAWAK", abbreviation: "TERAS", color: "#ffffff", type: "party" },
  28: { name: "PARTI KEBANGSAAN SABAH", abbreviation: "PKS", color: "#8eb26a", type: "party" },
  29: { name: "PARTI SEJAHTERA ANGKATAN PERPADUAN SABAH", abbreviation: "SAPU", color: "#ffffff", type: "party" },
  30: { name: "PARTI BANSA DAYAK SARAWAK BARU", abbreviation: "PBDS", color: "#246a72", type: "party" },
  31: { name: "PARTI ALTERNATIF RAKYAT", abbreviation: "PAP", color: "#ffffff", type: "party" },
  32: { name: "PARTI CINTA SABAH", abbreviation: "PCS", color: "#fd7777", type: "party" },
  33: { name: "PARTI WARISAN SABAH", abbreviation: "WARISAN", color: "#5faac3", type: "party" },
  34: { name: "PARTI PRIBUMI BERSATU MALAYSIA", abbreviation: "PPBM", color: "#ff0517", type: "party" },
  35: { name: "PARTI SOLIDARITI TANAH AIRKU", abbreviation: "STARSABAH", color: "#d0b000", type: "party" },
  36: { name: "PARTI HARAPAN RAKYAT SABAH", abbreviation: "HR", color: "#6f91be", type: "party" },
  37: { name: "PARTI BUMI KENYALANG", abbreviation: "PBK", color: "#0d57e8", type: "party" },
  38: { name: "PARTI IKATAN BANGSA MALAYSIA", abbreviation: "IKATAN", color: "#ffffff", type: "party" },
  39: { name: "PARTI BERSAMA MALAYSIA", abbreviation: "MU", color: "#ffffff", type: "party" },
  40: { name: "PERTUBUHAN PERPADUAN RAKYAT KEBANGSAAN SABAH", abbreviation: "PERPADUAN", color: "#976b3a", type: "party" },
  41: { name: "PARTI DAMAI SABAH", abbreviation: "SPP", color: "#ff7f00", type: "party" },
  42: { name: "PAKATAN HARAPAN", abbreviation: "PH", color: "#d8232b", type: "coalition" },
  43: { name: "PARTI PERTUBUHAN KEBANGSAAN MELAYU BERSATU", abbreviation: "UMNO", color: "#c00000", type: "party" },
  44: { name: "PARTI PERSATUAN CINA MALAYSIA", abbreviation: "MCA", color: "#102a7e", type: "party" },
  45: { name: "PARTI KONGRES INDIA MALAYSIA", abbreviation: "MIC", color: "#01a45e", type: "party" },
  46: { name: "PARTI SEDAR RAKYAT SARAWAK", abbreviation: "SEDAR", color: "#7f8000", type: "party" },
  47: { name: "PARTI GERAKAN RAKYAT MALAYSIA", abbreviation: "GERAKAN", color: "#16a959", type: "party" },
  48: { name: "GABUNGAN PARTI SARAWAK", abbreviation: "GPS", color: "#b148d2", type: "coalition" },
  49: { name: "PARTI SARAWAK BERSATU", abbreviation: "PSB", color: "#545971", type: "party" },
  50: { name: "PARTI ASPIRASI RAKYAT SARAWAK", abbreviation: "ASPIRASI", color: "#00adab", type: "party" },
  51: { name: "PARTI PESAKA BUMIPUTERA BERSATU SARAWAK", abbreviation: "PBB", color: "#FF0000", type: "party" },
  52: { name: "SARAWAK UNITED PEOPLE’S PARTY", abbreviation: "SUPP", color: "#FF0000", type: "party" },
  53: { name: "PARTI RAKYAT SARAWAK", abbreviation: "PRS", color: "#FF0000", type: "party" },
  54: { name: "PARTI BUMIPUTERA PERKASA MALAYSIA", abbreviation: "PUTRA", color: "#d7c500", type: "party" },
  55: { name: "PERIKATAN NASIONAL", abbreviation: "PN", color: "#003152", type: "coalition" },
  56: { name: "PARTI KEMAJUAN MALAYSIA", abbreviation: "KEMAJUAN", color: "#763199", type: "party" },
  57: { name: "PARTI PEJUANG TANAHAIR", abbreviation: "PEJUANG", color: "#00678a", type: "coalition" },
  58: { name: "PROGRESSIVE DEMOCRATICE PARTY", abbreviation: "PDP", color: "#010042", type: "party" },
  59: { name: "PARTI DEMOKRATIK PROGRESIF SARAWAK", abbreviation: "SPDP", color: "#0000fe", type: "party" },
  61: { name: "DLL", abbreviation: "DLL", color: "#733223", type: "coalition" },
  65: { name: "IKATAN DEMOKRATIK MALAYSIA", abbreviation: "MUDA", color: "#000000", type: "party" },
  69: { name: "PARTI BANGSA MALAYSIA", abbreviation: "PBM", color: "#613c99", type: "party" },
  71: { name: "PAKATAN HARAPAN + MUDA", abbreviation: "PH + MUDA", color: "#d8232b", type: "coalition" },
  73: { name: "PAKATAN HARAPAN (DAP)", abbreviation: "PH-DAP", color: "#d8232b", type: "party" },
  75: { name: "PAKATAN HARAPAN (AMANAH)", abbreviation: "PH-AMANAH", color: "#d8232b", type: "party" },
  77: { name: "PARTI PERIKATAN INDIA MUSLIM NASIONAL", abbreviation: "IMAN", color: "#ec2023", type: "party" },
  79: { name: "GERAKAN TANAH AIR", abbreviation: "GTA", color: "#cd516a", type: "party" },
  81: { name: "PARTI BERSATU RAKYAT SABAH", abbreviation: "PBRS", color: "#b4b571", type: "party" },
  83: { name: "PARTI GABUNGAN RAKYAT SABAH", abbreviation: "GRS", color: "#55768c", type: "party" },
  87: { name: "PARTI UTAMA RAKYAT", abbreviation: "PUR", color: "#00b478", type: "party" },
  89: { name: "KESEJAHTERAAN DEMOKRATIK MASYARAKAT", abbreviation: "KDM", color: "#7e0000", type: "party" },
  91: { name: "PERTUBUHAN KINABALU PROGRESIF BERSATU", abbreviation: "UPKO", color: "#204343", type: "party" },
  93: { name: "PARTI LIBERAL DEMOKRATIK", abbreviation: "LDP", color: "#ce7612", type: "party" },
  95: { name: "PARTI GAGASAN RAKYAT SABAH", abbreviation: "GAGASAN", color: "#FF0000", type: "party" },
  97: { name: "PARTI BERSATU SABAH", abbreviation: "PBS", color: "#5ca5f3", type: "party" },
  99: { name: "GERAKAN BERSATU SABAH", abbreviation: "GBS", color: "#0a0d6b", type: "coalition" },
  101: { name: "PARTI IMPIAN SABAH", abbreviation: "PIS", color: "#c97676", type: "party" },
  103: { name: "PARTI RUMPUN SABAH", abbreviation: "RUMPUN", color: "#e888ed", type: "party" },
  105: { name: "PARTI GEMILANG ANAK SABAH", abbreviation: "GAS", color: "#0e6cbf", type: "party" },
  107: { name: "PERJUANGAN RAKYAT", abbreviation: "PR", color: "#5d3b1f", type: "party" },
  109: { name: "PARTI BERSATU SASA MALAYSIA", abbreviation: "MUPP", color: "#636a3a", type: "party" },
  110: { name: "PARTI BERSAMA MALAYSIA", abbreviation: "BERSAMA", color: "#eebd00", type: "party" },
  112: { name: "PARTI ORANG ASLI MALAYSIA", abbreviation: "ASLI", color: "#ffffff", type: "party" },
};

// Fallback for a party id that isn't in the table (or is null). Kept neutral —
// it must NOT masquerade as BEBAS (id 9); an unmapped id is just "lain-lain".
const UNKNOWN_PARTY: Party = {
  name: "LAIN-LAIN",
  abbreviation: "DLL",
  color: "#9ca3af",
  type: "party",
};

export function getParty(id: number | null | undefined): Party {
  if (id == null) return UNKNOWN_PARTY;
  return PARTIES[id] ?? UNKNOWN_PARTY;
}

/**
 * Total elected DUN (state assembly) seats per state, keyed by the English state
 * name as it appears in the feed's `state` field. Used to show "X / total
 * declared" and the seats-to-govern line. Standard pre-redelineation totals;
 * verify against the official count for the active season if these drift.
 */
export const STATE_TOTAL_SEATS: Record<string, number> = {
  Perlis: 15,
  Kedah: 36,
  Kelantan: 45,
  Terengganu: 32,
  "Pulau Pinang": 40,
  Penang: 40,
  Perak: 59,
  Pahang: 42,
  Selangor: 56,
  "Negeri Sembilan": 36,
  Melaka: 28,
  Johor: 56,
  Sabah: 73,
  Sarawak: 82,
};

export function getStateTotalSeats(state: string): number | undefined {
  return STATE_TOTAL_SEATS[state];
}

/** Seats needed for a simple majority given a state's total seat count. */
export function seatsToGovern(totalSeats: number): number {
  return Math.floor(totalSeats / 2) + 1;
}

/**
 * Some party colours in the table are white (#ffffff) or near-white, which is
 * invisible on a light card. Returns a display-safe colour, falling back to a
 * neutral grey so chips/bars stay legible.
 */
export function safePartyColor(color: string): string {
  const c = color.trim().toLowerCase();
  if (c === "#ffffff" || c === "#fff" || c === "white" || c === "#fcf9a8") {
    return "#9ca3af";
  }
  return color;
}
