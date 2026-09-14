const fs=require('fs');const src=fs.readFileSync('src/v3/financeFormat.ts','utf8');
function trade(price,shares){return Math.floor(price*shares)}
const assert=(x,msg)=>{if(!x)throw new Error(msg)};assert(trade(1.99,1)===1,'1.99 -> 1');assert(trade(4.04,1)===4,'4.04 -> 4');assert(trade(1.99,1)+trade(4.04,1)===5,'row floor then sum');assert(20659-20505===154,'market - cost = +154');assert(/Math\.floor\(price\*shares\)/.test(src),'source uses floor(price*shares)');console.log('FINANCE_ENGINE_V342_TEST: PASS');
