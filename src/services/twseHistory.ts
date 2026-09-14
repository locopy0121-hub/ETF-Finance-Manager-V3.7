export type TwseOhlcvPoint={date:string;open:number;high:number;low:number;close:number;volume:number};

const toNum=(v:unknown)=>{const n=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(n)?n:undefined};
const rocDateToIso=(v:unknown)=>{const m=String(v??'').match(/^(\d{2,3})\/(\d{2})\/(\d{2})$/);return m?`${Number(m[1])+1911}-${m[2]}-${m[3]}`:''};
const monthKey=(d:Date)=>`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}01`;

async function fetchMonth(symbol:string,dateKey:string):Promise<TwseOhlcvPoint[]>{
 const url=`https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateKey}&stockNo=${encodeURIComponent(symbol)}`;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
 try{
  const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json,text/plain,*/*'}});
  if(!r.ok)throw new Error(`TWSE STOCK_DAY HTTP ${r.status}`);
  const j:any=await r.json();
  const rows:Array<any[]>=Array.isArray(j?.data)?j.data:[];
  return rows.map(row=>({date:rocDateToIso(row?.[0]),volume:toNum(row?.[1])??0,open:toNum(row?.[3])??0,high:toNum(row?.[4])??0,low:toNum(row?.[5])??0,close:toNum(row?.[6])??0})).filter(x=>x.date&&x.open>0&&x.high>0&&x.low>0&&x.close>0);
 }finally{clearTimeout(timer)}
}

export async function fetchTwseOhlcvHistory(symbol:string,days=60):Promise<TwseOhlcvPoint[]>{
 const months=Math.max(1,Math.min(18,Math.ceil(Math.max(10,days)/20)+1));
 const now=new Date();const keys:string[]=[];
 for(let i=0;i<months;i++){const d=new Date(now.getFullYear(),now.getMonth()-i,1);keys.push(monthKey(d));}
 const all=(await Promise.allSettled(keys.map(k=>fetchMonth(symbol,k)))).flatMap(r=>r.status==='fulfilled'?r.value:[]);
 const dedup=new Map<string,TwseOhlcvPoint>();for(const x of all)dedup.set(x.date,x);
 return [...dedup.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-Math.max(10,days));
}
