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
write(p,t)

print('[DEBUG1] V3.7.5 TypeScript integration repair applied')
