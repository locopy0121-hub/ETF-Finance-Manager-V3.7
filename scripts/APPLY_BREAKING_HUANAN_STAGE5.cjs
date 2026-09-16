const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');
const write=(f,s)=>fs.writeFileSync(f,s);
const rep=(f,re,to)=>{let s=read(f);write(f,s.replace(re,to));};
const must=(f,re,to,label)=>{let s=read(f);if(!re.test(s))throw new Error(`${f}: missing ${label}`);write(f,s.replace(re,to));};

// Expose a canonical portfolio-summary adapter that delegates directly to calculatePortfolioSummary().
must('src/v3/engine.ts',/export function calculatePortfolioView\(holdings:Holding\[],quotes:Record<string,QuoteLike>,cashBalance:number,ledger:LedgerEntry\[],dividends:DividendEvent\[]\)\{\n const items=holdings\.map\(h=>toETFItem\(h,quotes,ledger,dividends\)\);\n const canonical=calculatePortfolioSummary\(items\);/,`export function calculatePortfolioCoreSummary(holdings:Holding[],quotes:Record<string,QuoteLike>,ledger:LedgerEntry[],dividends:DividendEvent[],selectedSymbols:string[]=[]){\n const selected=selectedSymbols.length?holdings.filter(h=>selectedSymbols.includes(h.symbol)):holdings;\n return calculatePortfolioSummary(selected.map(h=>toETFItem(h,quotes,ledger,dividends)));\n}\n\nexport function calculatePortfolioView(holdings:Holding[],quotes:Record<string,QuoteLike>,cashBalance:number,ledger:LedgerEntry[],dividends:DividendEvent[]){\n const canonical=calculatePortfolioCoreSummary(holdings,quotes,ledger,dividends);`,'portfolio core adapter');
rep('src/v3/engine.ts',/ return \{\n  historicalTradeCost,/,` return {\n  canonicalSummary:canonical,\n  historicalTradeCost,`);

// App -> Widget payload carries the exact canonical summary.
rep('App.tsx',/configureDisplayPreferences, calculateDividendIncome, calculateHoldingView, calculatePortfolioView, sharesOnDate, money, pct/,`configureDisplayPreferences, calculateDividendIncome, calculateHoldingView, calculatePortfolioView, calculatePortfolioCoreSummary, sharesOnDate, money, pct`);
rep('App.tsx',/const ws=state\.appSettings\.widget;const trendMetric=/g,`const ws=state.appSettings.widget;const widgetSummary=calculatePortfolioCoreSummary(state.holdings,quotes.quotes as any,state.ledger,state.dividends,ws.selectedSymbols??[]);const trendMetric=`);
rep('App.tsx',/const extras=\{cumulativeDividend:metrics\.cumulativeDividends,/g,`const extras={portfolioSummary:widgetSummary,cumulativeDividend:metrics.cumulativeDividends,`);

// Background writer forwards the canonical summary already produced by the canonical view.
rep('src/services/backgroundQuoteTask.tsx',/const extras=metrics\?\{\.\.\.\(previousPayload\?\.extras\?\?\{\}\),/g,`const extras=metrics?{...(previousPayload?.extras??{}),portfolioSummary:metrics.canonicalSummary,`);

// Widget task handler may run with App closed; data adapter recomputes through canonical core only.
rep('src/widgets/widgetTaskHandler.tsx',/import \{ calculatePortfolioView \} from '\.\.\/v3\/engine';/,`import { calculatePortfolioView, calculatePortfolioCoreSummary } from '../v3/engine';`);
rep('src/widgets/widgetTaskHandler.tsx',/cashBalance,\n      totalPnl:m\.totalPnl/g,`cashBalance,\n      portfolioSummary:calculatePortfolioCoreSummary(holdingsSource,quotes as any,ledger,dividends,ws.selectedSymbols??[]),\n      totalPnl:m.totalPnl`);
rep('src/widgets/widgetTaskHandler.tsx',/holdingCount:rawHoldings\.length,cashBalance,totalPnl:m\.totalPnl/g,`holdingCount:rawHoldings.length,cashBalance,portfolioSummary:calculatePortfolioCoreSummary(rawHoldings,fresh as any,ledger,dividends,ws.selectedSymbols??[]),totalPnl:m.totalPnl`);

// Physical deletion. No compatibility shells and no empty re-exports.
for(const f of ['src/data/tradeSettings.ts','src/v3/engineBase.ts']){if(fs.existsSync(f))fs.unlinkSync(f);}

console.log('APPLY_BREAKING_HUANAN_STAGE5 complete');
