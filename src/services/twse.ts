export type TwseQuote = {
  symbol: string;
  name?: string;
  price: number;
  previousClose?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  quoteDate?: string;
  quoteTime?: string;
  source: 'TWSE';
};

export type QuoteState = {
  quotes: Record<string, TwseQuote>;
  lastSuccessAt?: number;
  lastAttemptAt?: number;
  error?: string;
};

const MIS_URL = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';

const toNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
};

const firstBookPrice = (book: unknown): number | undefined => {
  if (typeof book !== 'string') return undefined;
  for (const part of book.split('_')) {
    const n = toNumber(part);
    if (n && n > 0) return n;
  }
  return undefined;
};

function pickTradingPrice(raw: any): number | undefined {
  const traded = toNumber(raw?.z);
  if (traded && traded > 0) return traded;

  // When an ETF has not traded yet, MIS may return '-'. Prefer the official
  // previous close rather than synthesizing a price from Yahoo or another source.
  const previous = toNumber(raw?.y);
  if (previous && previous > 0) return previous;

  // Final defensive fallback inside the TWSE payload only.
  return firstBookPrice(raw?.b) ?? firstBookPrice(raw?.a);
}

export async function fetchTwseQuotes(symbols: string[]): Promise<Record<string, TwseQuote>> {
  const unique = [...new Set(symbols.filter(Boolean))];
  if (!unique.length) return {};

  const channels = unique.map(symbol => `tse_${symbol}.tw`).join('|');
  const url = `${MIS_URL}?ex_ch=${encodeURIComponent(channels)}&json=1&delay=0&_=${Date.now()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let payload: any;
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json,text/plain,*/*' },
    });
    if (!response.ok) throw new Error(`TWSE HTTP ${response.status}`);
    payload = await response.json();
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('TWSE 連線逾時');
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const result: Record<string, TwseQuote> = {};

  for (const raw of payload?.msgArray ?? []) {
    const symbol = String(raw?.c ?? '').trim();
    const price = pickTradingPrice(raw);
    if (!symbol || !price) continue;

    result[symbol] = {
      symbol,
      name: raw?.n,
      price,
      previousClose: toNumber(raw?.y),
      open: toNumber(raw?.o),
      high: toNumber(raw?.h),
      low: toNumber(raw?.l),
      volume: toNumber(raw?.v),
      quoteDate: raw?.d,
      quoteTime: raw?.t,
      source: 'TWSE',
    };
  }

  if (!Object.keys(result).length) {
    throw new Error('TWSE 未回傳有效行情');
  }

  return result;
}
