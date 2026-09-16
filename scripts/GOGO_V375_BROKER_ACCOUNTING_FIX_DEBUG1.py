from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text): (ROOT/path).write_text(text,encoding='utf-8')
def rep(text,old,new,label):
    if old not in text:
        raise SystemExit(f'[DEBUG1] missing anchor: {label}')
    return text.replace(old,new,1)

p=Path('App.tsx'); t=read(p)
t=rep(t,"fee:number;feeRebate:number;strategy:'long'|'swing'","fee:number;feeRebate?:number;strategy:'long'|'swing'",'optional buy rebate for AI draft compatibility')
t=rep(t,"fee:number;feeRebate:number;tax:number","fee:number;feeRebate?:number;tax:number",'optional sell rebate')
write(p,t)

p=Path('src/v3/screens.tsx'); t=read(p)
t=t.replace("fee:number;feeRebate:number;strategy:'long'|'swing'","fee:number;feeRebate?:number;strategy:'long'|'swing'")
t=t.replace("fee:number;feeRebate:number;tax:number","fee:number;feeRebate?:number;tax:number")
t=rep(t,"const {holdings,quotes,cashBalance,ledger,dividends,prefs,dailySnapshots}=common;","const {holdings,quotes,cashBalance,ledger,dividends,prefs,dailySnapshots,feeSettings}=common;",'Dashboard feeSettings scope')
old="function sortFocusHoldings(rows:Holding[],prefs:V3Preferences,quotes:Record<string,QuoteLike>,ledger:LedgerEntry[],dividends:DividendEvent[]){if(prefs.holdingFocusSort==='custom')return rows;return [...rows].sort((a,b)=>{const aa=holdingMetrics(a,quotes,ledger,dividends),bb=holdingMetrics(b,quotes,ledger,dividends);return Number((bb as any)[prefs.holdingFocusSort]??0)-Number((aa as any)[prefs.holdingFocusSort]??0)});}"
new="function sortFocusHoldings(rows:Holding[],prefs:V3Preferences,quotes:Record<string,QuoteLike>,ledger:LedgerEntry[],dividends:DividendEvent[],feeSettings:FeeSettings){if(prefs.holdingFocusSort==='custom')return rows;return [...rows].sort((a,b)=>{const aa=holdingMetrics(a,quotes,ledger,dividends,feeSettings),bb=holdingMetrics(b,quotes,ledger,dividends,feeSettings);return Number((bb as any)[prefs.holdingFocusSort]??0)-Number((aa as any)[prefs.holdingFocusSort]??0)});}"
t=rep(t,old,new,'focus sort fee settings')
t=rep(t,"holdings,prefs,quotes,ledger,dividends)).slice(0,prefs.holdingFocusMax||8)","holdings,prefs,quotes,ledger,dividends,feeSettings)).slice(0,prefs.holdingFocusMax||8)",'dashboard focus sort call')
write(p,t)

# V3.4 audit previously rejected every 5-argument holdingMetrics call because the function
# did not support broker settings then. V3.7.5 intentionally makes FeeSettings the canonical
# fifth argument, so update that legacy regression assertion instead of weakening the new engine.
p=Path('scripts/V340_FIX1_REGRESSION_AUDIT.cjs'); t=read(p)
t=rep(t," ['no 5-arg holdingMetrics sort call', !/holdingMetrics\\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*\\)/.test(s)],\n ['focus sort uses canonical 4-arg holdingMetrics', /holdingMetrics\\(a,quotes,ledger,dividends\\)/],"," ['broker-aware holdingMetrics signature is used', /holdingMetrics\\(a,quotes,ledger,dividends,feeSettings\\)/],\n ['focus sort receives broker fee settings', /sortFocusHoldings\\([^;]*feeSettings/],",'legacy V340 audit signature')
write(p,t)

print('[DEBUG1] V3.7.5 TypeScript + broker-aware focus-sort integration repair applied')
