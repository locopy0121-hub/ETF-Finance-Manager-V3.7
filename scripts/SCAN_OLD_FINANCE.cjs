const fs=require('fs');
const path=require('path');

const roots=['App.tsx','src'];
const needles=[
  'tradeSettings',
  'engineBase',
  'configureBrokerProfiles',
  'defaultBrokerProfile',
  'resolveBrokerProfile',
  'estimateBuyFee',
  'estimateSellFee',
  'estimateSellTaxBySettings',
  'holdingMetrics',
  'portfolioMetrics',
  'pricePnl',
  'cashPnl',
  'cashUnrealized',
];

const files=[];
function walk(p){
  if(!fs.existsSync(p))return;
  const st=fs.statSync(p);
  if(st.isDirectory())for(const n of fs.readdirSync(p))walk(path.join(p,n));
  else if(/\.(ts|tsx)$/.test(p))files.push(p);
}
for(const r of roots)walk(r);

for(const f of files){
  if(f==='src/utils/etfCalculators.ts')continue;
  const lines=fs.readFileSync(f,'utf8').split(/\r?\n/);
  const hits=[];
  lines.forEach((line,i)=>{
    if(needles.some(n=>line.includes(n)))hits.push(`${i+1}: ${line.trim().slice(0,260)}`);
  });
  if(hits.length){
    console.log(`\n### ${f}`);
    console.log(hits.join('\n'));
  }
}
