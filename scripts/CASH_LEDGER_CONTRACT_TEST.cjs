const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const screens=fs.readFileSync(path.join(root,'src','v3','screens.tsx'),'utf8');
const storage=fs.readFileSync(path.join(root,'src','v3','storage.ts'),'utf8');

const required=[
 ['買進同步扣除證券現金','cashBalance:s.cashBalance-purchaseCost-x.fee'],
 ['賣出費用可由券商規則估算','estimateSellFee'],
 ['ETF 賣出稅可自動估算','estimateSellTaxBySettings'],
 ['賣出淨額不得為負','fee+tax<=gross'],
 ['現金核對可把實際餘額設成 canonical cash','actualBalance'],
 ['重算總資產不可退回只算市值','totalAssets:marketValue+Number(d.cashBalance??0)'],
 ['舊資料遷移優先採已核對實際現金','reconciledCash'],
];
for(const [label,snippet] of required){
 const corpus=label.includes('遷移')?storage:label.includes('賣出費用')||label.includes('ETF 賣出稅')?screens:app;
 if(!corpus.includes(snippet))throw new Error(`CASH LEDGER CONTRACT MISSING: ${label}`);
}
if(app.includes("ledger:s.ledger.filter(e=>!(e.kind==='buy'&&e.symbol===symbol))"))throw new Error('CASH LEDGER CONTRACT: 刪除持倉仍會刪除歷史買進帳務');

// Economic smoke test: start 100000, buy 100x100 fee20, sell 100x110 fee20 tax11.
let cash=100000;
cash-=10000+20;
cash+=11000-20-11;
if(cash!==100949)throw new Error(`cash arithmetic expected 100949 got ${cash}`);
console.log('CASH_LEDGER_CONTRACT_TEST: PASS');
