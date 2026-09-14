import type { TwseOhlcvPoint } from '../services/twseHistory';

export type EtfRiskStats={
 observations:number;
 return1w?:number;
 return1m?:number;
 return3m?:number;
 return1y?:number;
 volatility?:number;
 maxDrawdown?:number;
 sharpe?:number;
};

const pctReturn=(rows:TwseOhlcvPoint[],lookback:number)=>{
 if(rows.length<2)return undefined;
 const last=rows[rows.length-1]?.close;
 const base=rows[Math.max(0,rows.length-1-lookback)]?.close;
 return Number.isFinite(last)&&Number.isFinite(base)&&base>0?(last/base-1)*100:undefined;
};

export function calculateEtfRiskStats(history:TwseOhlcvPoint[]):EtfRiskStats{
 const rows=history.filter(x=>Number.isFinite(x.close)&&x.close>0).sort((a,b)=>a.date.localeCompare(b.date));
 const returns:number[]=[];
 for(let i=1;i<rows.length;i++)returns.push(rows[i].close/rows[i-1].close-1);
 let volatility: number|undefined,sharpe:number|undefined;
 if(returns.length>=2){
  const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
  const variance=returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1);
  const sd=Math.sqrt(Math.max(0,variance));
  volatility=sd*Math.sqrt(252)*100;
  sharpe=sd>0?mean/sd*Math.sqrt(252):undefined;
 }
 let peak=0,maxDd=0;
 for(const row of rows){peak=Math.max(peak,row.close);if(peak>0)maxDd=Math.min(maxDd,row.close/peak-1);}
 return {observations:rows.length,return1w:pctReturn(rows,5),return1m:pctReturn(rows,20),return3m:pctReturn(rows,60),return1y:pctReturn(rows,250),volatility,maxDrawdown:rows.length?maxDd*100:undefined,sharpe};
}

export type EtfCategory='all'|'market'|'dividend'|'tech'|'bond'|'leveraged'|'active'|'esg';
export function classifyEtf(symbol:string,name:string):Exclude<EtfCategory,'all'>[]{
 const s=`${symbol} ${name}`.toUpperCase(); const out=new Set<Exclude<EtfCategory,'all'>>();
 if(/高股息|高息|收益|股利|低波/.test(name))out.add('dividend');
 if(/50|市值|台灣|臺灣|大盤|MSCI/.test(name))out.add('market');
 if(/科技|電子|半導體|AI|IC|電動|數位/.test(s))out.add('tech');
 if(/債|BOND|投資級|公債|公司債/.test(s))out.add('bond');
 if(/正2|反1|反向|槓桿|2X|2X/.test(s))out.add('leveraged');
 if(/主動|ACTIVE|[A-Z]$/.test(symbol))out.add('active');
 if(/ESG|永續|低碳|綠能/.test(s))out.add('esg');
 if(!out.size)out.add('market');
 return [...out];
}

export const featuredEtfSymbols=['0050','006208','00878','00919','00713','00929','00940'];
