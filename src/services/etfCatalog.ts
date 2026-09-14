export type EtfCatalogItem = {
  symbol: string;
  name: string;
  source: 'TWSE' | 'fallback';
};

const TWSE_FUND_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap47_L';

// Offline fallback only. Online mode always prefers the TWSE fund master list.
export const fallbackEtfCatalog: EtfCatalogItem[] = [
  { symbol: '0050', name: '元大台灣50', source: 'fallback' },
  { symbol: '0051', name: '元大中型100', source: 'fallback' },
  { symbol: '0052', name: '富邦科技', source: 'fallback' },
  { symbol: '0053', name: '元大電子', source: 'fallback' },
  { symbol: '0055', name: '元大MSCI金融', source: 'fallback' },
  { symbol: '0056', name: '元大高股息', source: 'fallback' },
  { symbol: '00631L', name: '元大台灣50正2', source: 'fallback' },
  { symbol: '00632R', name: '元大台灣50反1', source: 'fallback' },
  { symbol: '006208', name: '富邦台50', source: 'fallback' },
  { symbol: '00685L', name: '群益臺灣加權正2', source: 'fallback' },
  { symbol: '00713', name: '元大台灣高息低波', source: 'fallback' },
  { symbol: '00850', name: '元大臺灣ESG永續', source: 'fallback' },
  { symbol: '00878', name: '國泰永續高股息', source: 'fallback' },
  { symbol: '00915', name: '凱基優選高股息30', source: 'fallback' },
  { symbol: '00918', name: '大華優利高填息30', source: 'fallback' },
  { symbol: '00919', name: '群益台灣精選高息', source: 'fallback' },
  { symbol: '00929', name: '復華台灣科技優息', source: 'fallback' },
  { symbol: '00940', name: '元大台灣價值高息', source: 'fallback' },
  { symbol: '00981A', name: '主動統一台股增長', source: 'fallback' },
  { symbol: '00982A', name: '主動群益台灣強棒', source: 'fallback' },
  { symbol: '00403A', name: '主動統一台股增值', source: 'fallback' },
  { symbol: '00406A', name: '主動中信台灣收益', source: 'fallback' },
];

const SYMBOL_KEYS = ['基金代號', '證券代號', '股票代號', '基金證券代號', '代號', 'Code', 'code', 'symbol', 'Symbol'];
const NAME_KEYS = ['基金簡稱', '基金名稱', '證券簡稱', '證券名稱', '名稱', 'Name', 'name', 'FundName', 'fundName'];
const SYMBOL_RE = /^\d{4,6}[A-Z]?$/i;

function firstString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function inferSymbol(row: Record<string, unknown>) {
  const direct = firstString(row, SYMBOL_KEYS).replace(/\s+/g, '').toUpperCase();
  if (SYMBOL_RE.test(direct)) return direct;
  for (const value of Object.values(row)) {
    if (typeof value !== 'string') continue;
    const candidate = value.trim().replace(/\s+/g, '').toUpperCase();
    if (SYMBOL_RE.test(candidate)) return candidate;
  }
  return '';
}

function inferName(row: Record<string, unknown>, symbol: string) {
  const direct = firstString(row, NAME_KEYS);
  if (direct && direct !== symbol) return direct;
  const values = Object.values(row).filter(v => typeof v === 'string').map(v => String(v).trim());
  const likely = values.find(v => v && v !== symbol && !SYMBOL_RE.test(v) && /[\u4e00-\u9fffA-Za-z]/.test(v));
  return likely || '';
}

export async function fetchTwseEtfCatalog(): Promise<EtfCatalogItem[]> {
  const response = await fetch(TWSE_FUND_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`TWSE ETF 主檔 HTTP ${response.status}`);
  const raw = await response.json();
  if (!Array.isArray(raw)) throw new Error('TWSE ETF 主檔格式不符預期');

  const map = new Map<string, EtfCatalogItem>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const symbol = inferSymbol(row);
    if (!symbol) continue;
    const name = inferName(row, symbol);
    if (!name) continue;
    map.set(symbol, { symbol, name, source: 'TWSE' });
  }
  if (!map.size) throw new Error('TWSE ETF 主檔沒有可辨識資料');
  return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function mergeCatalog(primary: EtfCatalogItem[], fallback = fallbackEtfCatalog) {
  const map = new Map<string, EtfCatalogItem>();
  fallback.forEach(item => map.set(item.symbol, item));
  primary.forEach(item => map.set(item.symbol, item));
  return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function searchEtfCatalog(catalog: EtfCatalogItem[], query: string, limit = 8) {
  const q = query.trim().toUpperCase().replace(/\s+/g, '');
  if (!q) return [];
  const nameQ = query.trim().toLowerCase().replace(/\s+/g, '');
  return catalog
    .map(item => {
      const symbol = item.symbol.toUpperCase();
      const name = item.name.toLowerCase().replace(/\s+/g, '');
      let score = -1;
      if (symbol === q) score = 100;
      else if (symbol.startsWith(q)) score = 80;
      else if (name === nameQ) score = 75;
      else if (name.startsWith(nameQ)) score = 65;
      else if (name.includes(nameQ)) score = 50;
      return { item, score };
    })
    .filter(row => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.symbol.localeCompare(b.item.symbol))
    .slice(0, limit)
    .map(row => row.item);
}
