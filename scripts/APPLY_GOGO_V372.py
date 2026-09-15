from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def replace(path, old, new, count=1):
    p=ROOT/path
    text=p.read_text(encoding='utf-8')
    actual=text.count(old)
    if actual==0:
        if new in text:
            print(f'OK already patched: {path}')
            return
        raise SystemExit(f'PATCH MISS {path}: {old[:120]!r}')
    if count is not None and actual!=count:
        raise SystemExit(f'PATCH AMBIGUOUS {path}: expected {count}, found {actual}: {old[:120]!r}')
    p.write_text(text.replace(old,new,count if count is not None else -1),encoding='utf-8')
    print(f'PATCHED {path}')

# App.tsx — one cash truth: every economic event changes state cash symmetrically.
replace(Path('App.tsx'),
"import { preciseTradeAmount } from './src/v3/financeFormat';",
"import { preciseTradeAmount } from './src/v3/financeFormat';\nimport { estimateSellFee, estimateSellTaxBySettings } from './src/data/tradeSettings';")
replace(Path('App.tsx'),
"const e:LedgerEntry={id:id(),kind:'buy',symbol:x.symbol,name:x.name,date:x.date,shares:x.shares,price:x.price,amount:purchaseCost,fee:x.fee,strategy:x.strategy,broker:x.broker,account:x.account,purchaseRecordId:r.id};return {...s,holdings,ledger:[...s.ledger,e]};",
"const e:LedgerEntry={id:id(),kind:'buy',symbol:x.symbol,name:x.name,date:x.date,shares:x.shares,price:x.price,amount:purchaseCost,fee:x.fee,strategy:x.strategy,broker:x.broker,account:x.account,purchaseRecordId:r.id};return {...s,holdings,cashBalance:s.cashBalance-purchaseCost-x.fee,ledger:[...s.ledger,e]};")
replace(Path('App.tsx'),
"const addSell=(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number})=>patch(s=>{const h=s.holdings.find(z=>z.symbol===x.symbol);if(!h||x.shares<=0||x.shares>h.shares){Alert.alert('賣出失敗','賣出股數不可超過目前持有股數。');return s;}const remaining=h.shares-x.shares;const holdings=remaining===0?s.holdings.filter(z=>z.symbol!==x.symbol):s.holdings.map(z=>z.symbol!==x.symbol?z:{...z,shares:remaining});const gross=preciseTradeAmount(x.price,x.shares),proceeds=gross-x.fee-x.tax;const e:LedgerEntry={id:id(),kind:'sell',symbol:x.symbol,name:h.name,date:x.date,shares:x.shares,price:x.price,amount:gross,fee:x.fee,tax:x.tax,broker:h.broker,account:h.account};return {...s,holdings,cashBalance:s.cashBalance+proceeds,ledger:[...s.ledger,e]};});",
"const addSell=(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number})=>patch(s=>{const h=s.holdings.find(z=>z.symbol===x.symbol);if(!h||x.shares<=0||x.shares>h.shares){Alert.alert('賣出失敗','賣出股數不可超過目前持有股數。');return s;}const remaining=h.shares-x.shares;const holdings=remaining===0?s.holdings.filter(z=>z.symbol!==x.symbol):s.holdings.map(z=>z.symbol!==x.symbol?z:{...z,shares:remaining});const gross=preciseTradeAmount(x.price,x.shares);const fee=x.fee>0?x.fee:estimateSellFee(gross,s.feeSettings);const tax=x.tax>0?x.tax:estimateSellTaxBySettings(gross,s.feeSettings);if(fee<0||tax<0||!(fee+tax<=gross)){Alert.alert('賣出失敗','手續費與交易稅不可為負，且合計不可超過成交金額。');return s;}const proceeds=gross-fee-tax;const e:LedgerEntry={id:id(),kind:'sell',symbol:x.symbol,name:h.name,date:x.date,shares:x.shares,price:x.price,amount:gross,fee,tax,broker:h.broker,account:h.account};return {...s,holdings,cashBalance:s.cashBalance+proceeds,ledger:[...s.ledger,e]};});")
replace(Path('App.tsx'),
"const saveCashReconciliation=(x:any)=>patch(s=>({...s,cashReconciliation:{...s.cashReconciliation,...x}}));",
"const saveCashReconciliation=(x:any)=>patch(s=>{const actualBalance=Number(x?.actualBalance);return {...s,cashBalance:Number.isFinite(actualBalance)?actualBalance:s.cashBalance,cashReconciliation:{...s.cashReconciliation,...x}}});")
replace(Path('App.tsx'),
"const ledger=[...s.ledger.filter(e=>!(e.kind==='buy'&&e.symbol===x.symbol)),...buyEntries].sort((a,b)=>a.date.localeCompare(b.date));return {...s,holdings:s.holdings.map(h=>h.symbol===x.symbol?updated:h),ledger};",
"const ledger=[...s.ledger.filter(e=>!(e.kind==='buy'&&e.symbol===x.symbol)),...buyEntries].sort((a,b)=>a.date.localeCompare(b.date));const baseline=s.cashBalance-ledgerCash(s.ledger);return {...s,holdings:s.holdings.map(h=>h.symbol===x.symbol?updated:h),ledger,cashBalance:baseline+ledgerCash(ledger)};")
replace(Path('App.tsx'),
",ledger:s.ledger.filter(e=>!(e.kind==='buy'&&e.symbol===symbol)),preferences:",
",preferences:")
replace(Path('App.tsx'),
"const symbols=Array.from(new Set([...s.holdings.map(h=>h.symbol),...s.ledger.map(e=>e.symbol).filter(Boolean) as string[]]));",
"const symbols=Array.from(new Set(s.holdings.map(h=>h.symbol))); // explicit current holdings only; archived ledger rows never recreate a deleted holding")
replace(Path('App.tsx'),
"totalAssets:marketValue,todayPnl,totalPnl,todayPnlPct:",
"totalAssets:marketValue+Number(d.cashBalance??0),todayPnl,totalPnl,todayPnlPct:")

# Ledger UI — auto-estimate BOTH sell commission and ETF tax, while allowing manual override.
replace(Path('src/v3/screens.tsx'),
"import { estimateBuyFee, FeeSettings } from '../data/tradeSettings';",
"import { estimateBuyFee, estimateSellFee, estimateSellTaxBySettings, FeeSettings } from '../data/tradeSettings';")
replace(Path('src/v3/screens.tsx'),
"const tradeAmount=preciseTradeAmount(Number(price||0),Number(shares||0)); const calcFee=kind==='buy'&&autoFee?estimateBuyFee(tradeAmount,common.feeSettings):Number(fee||0);",
"const tradeAmount=preciseTradeAmount(Number(price||0),Number(shares||0)); const calcFee=(kind==='buy'||kind==='sell')&&autoFee?(kind==='buy'?estimateBuyFee(tradeAmount,common.feeSettings):estimateSellFee(tradeAmount,common.feeSettings)):Number(fee||0); const calcTax=kind==='sell'&&autoFee?estimateSellTaxBySettings(tradeAmount,common.feeSettings):Number(tax||0);")
replace(Path('src/v3/screens.tsx'),
"}else if(kind==='sell'){if(!symbol||tradeAmount<=0)return Alert.alert('資料不足','請輸入 ETF、賣出股數與實際成交價格。');onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),fee:Number(fee||0),tax:Number(tax||0)});}",
"}else if(kind==='sell'){if(!symbol||tradeAmount<=0)return Alert.alert('資料不足','請輸入 ETF、賣出股數與實際成交價格。');if(calcFee<0||calcTax<0||!(calcFee+calcTax<=tradeAmount))return Alert.alert('費稅錯誤','手續費與交易稅不可為負，且合計不可超過成交金額。');onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,tax:calcTax});}")
replace(Path('src/v3/screens.tsx'),
"}:<><Field label=\"賣出手續費\" value={fee} onChange={setFee} keyboard=\"number-pad\" suffix=\"元\"/><Field label=\"證交稅\" value={tax} onChange={setTax} keyboard=\"number-pad\" suffix=\"元\"/><View style={s.calcBox}><Text style={s.muted}>實際現金流入</Text><Text style={s.calcVal}>{money(tradeAmount-Number(fee||0)-Number(tax||0))}</Text></View></>}",
"}:<><View style={s.switchRow}><View><Text style={s.etfName}>自動計算賣出手續費與 ETF 交易稅</Text><Text style={s.muted}>{common.feeSettings.brokerName} · 依全局券商費用設定與 ETF 稅率</Text></View><Switch value={autoFee} onValueChange={setAutoFee}/></View>{autoFee?<><View style={s.calcBox}><Text style={s.muted}>賣出手續費</Text><Text style={s.calcVal}>{money(calcFee)}</Text></View><View style={s.calcBox}><Text style={s.muted}>ETF 交易稅</Text><Text style={s.calcVal}>{money(calcTax)}</Text></View></>:<><Field label=\"賣出手續費\" value={fee} onChange={setFee} keyboard=\"number-pad\" suffix=\"元\"/><Field label=\"證交稅\" value={tax} onChange={setTax} keyboard=\"number-pad\" suffix=\"元\"/></>}<View style={s.calcBox}><Text style={s.muted}>實際現金流入</Text><Text style={s.calcVal}>{money(tradeAmount-calcFee-calcTax)}</Text></View></>}")
replace(Path('src/v3/screens.tsx'),
"現金資金為獨立帳目流水，用於核對證券 / 交割帳戶實際金額；不會自行修改 ETF 成本或損益，也不會因手動存入而直接把投資總資產加大。",
"現金資金為獨立帳目流水，用於核對證券 / 交割帳戶實際金額；不會修改 ETF 成本或損益，但會正確反映在證券帳戶總資產。")

# Migration — never guess an old opening balance; an explicit reconciliation wins.
replace(Path('src/v3/storage.ts'),"const SCHEMA=14;","const SCHEMA=15;")
replace(Path('src/v3/storage.ts'),
" return {\n  schemaVersion:SCHEMA,",
" const reconciledCash=Number((p as any).cashReconciliation?.actualBalance);\n return {\n  schemaVersion:SCHEMA,")
replace(Path('src/v3/storage.ts'),
"  cashBalance:Number(p.cashBalance??0),",
"  cashBalance:Number.isFinite(reconciledCash)?reconciledCash:Number(p.cashBalance??0),")

print('APPLY_GOGO_V372: PASS')
