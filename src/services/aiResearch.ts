export type ResearchNewsItem={title:string;link:string;publishedAt:string;source:string;description:string};
export type ResearchSectionKey='highlights'|'profile'|'dates'|'income'|'strategy'|'selection'|'news'|'risk'|'sources';
export type ResearchSection={key:ResearchSectionKey;title:string;lines:string[]};
export type AiResearchResult={symbol:string;name:string;query:string;searchedAt:number;sections:ResearchSection[];news:ResearchNewsItem[];gatewayUsed:boolean};

const decode=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const tag=(block:string,name:string)=>decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]??'');
const sourceTag=(block:string)=>decode(block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1]??block.match(/<(?:News:Source|news:source)[^>]*>([\s\S]*?)<\/(?:News:Source|news:source)>/i)?.[1]??'');
function parseRss(xml:string):ResearchNewsItem[]{return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>{const b=m[1];return {title:tag(b,'title'),link:tag(b,'link'),publishedAt:tag(b,'pubDate'),source:sourceTag(b)||'Google News',description:tag(b,'description')}}).filter(x=>x.title&&x.link);}
const compact=(items:ResearchNewsItem[],keywords:RegExp,max=4)=>items.filter(x=>keywords.test(`${x.title} ${x.description}`)).slice(0,max).map(x=>`${x.title}${x.source?`｜${x.source}`:''}`);
const unique=(xs:string[])=>[...new Set(xs.filter(Boolean))];
const safeDate=(s:string)=>{try{return new Date(s).toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return s}};
const sourceClass=(source:string)=>/(臺灣證券交易所|台灣證券交易所|TWSE|投信|基金公司|公開資訊觀測站|MOPS)/i.test(source)?'官方':/(Facebook|Instagram|YouTube|社群)/i.test(source)?'社群':'新聞';

async function fetchGoogleNews(query:string){const url=`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;const r=await fetch(url,{headers:{Accept:'application/rss+xml, application/xml, text/xml'}});if(!r.ok)throw new Error(`Google News HTTP ${r.status}`);return parseRss(await r.text()).slice(0,16);}
async function fetchBingNews(query:string){const url=`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&setlang=zh-hant`;const r=await fetch(url,{headers:{Accept:'application/rss+xml, application/xml, text/xml'}});if(!r.ok)throw new Error(`Bing News HTTP ${r.status}`);return parseRss(await r.text()).slice(0,16);}

async function optionalGateway(query:string,symbol:string,name:string,news:ResearchNewsItem[]):Promise<ResearchSection[]|null>{
 const endpoint=(process.env.EXPO_PUBLIC_AI_RESEARCH_URL??process.env.EXPO_PUBLIC_AI_GATEWAY_URL??process.env.EXPO_PUBLIC_AI_URL)?.trim(); if(!endpoint)return null;
 const evidence=news.slice(0,12).map((x,i)=>`${i+1}. ${x.title}｜${x.source}｜${x.publishedAt}｜${x.link}`).join('\n');
 const prompt=`你是 ETF 財務管家的研究整理器。只可依照下列即時搜尋證據整理 ${symbol} ${name}，不可自行杜撰尚未被來源支持的日期、價格、配息、成分股或績效。\n使用者問題：${query}\n即時來源：\n${evidence}\n請只回傳 JSON，格式 {"sections":[{"key":"highlights|profile|dates|income|strategy|selection|news|risk|sources","title":"標題","lines":["內容"]}]}。來源衝突時明確標示，官方來源優先。`;
 const normalize=(raw:any):ResearchSection[]|null=>{
  const obj=raw&&typeof raw==='object'&&Array.isArray(raw.sections)?raw:null;
  if(obj)return obj.sections.filter((x:any)=>x&&typeof x.title==='string'&&Array.isArray(x.lines)).map((x:any)=>({key:x.key??'highlights',title:x.title,lines:x.lines.map(String)}));
  const text=typeof raw==='string'?raw:typeof raw?.text==='string'?raw.text:typeof raw?.answer==='string'?raw.answer:typeof raw?.response==='string'?raw.response:raw?.candidates?.[0]?.content?.parts?.[0]?.text;
  if(typeof text!=='string'||!text.trim())return null;
  try{const cleaned=text.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();return normalize(JSON.parse(cleaned));}catch{return null;}
 };
 try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'etf_research',query,prompt,symbol,name,news:news.slice(0,12)})});if(!r.ok)return null;return normalize(await r.json());}catch{return null;}
}

export async function researchEtf(symbol:string,name:string,rawQuery:string):Promise<AiResearchResult>{
 const terms=unique([rawQuery,`${symbol} ${name}`,`${symbol} ETF`,`${symbol} 募集 掛牌 配息`,`${name} 投資策略`,`${symbol} 投信 公開說明書`,`${symbol} TWSE 掛牌 上市`,`${symbol} site:capitalfund.com.tw OR site:twse.com.tw`,`${symbol} site:ctee.com.tw OR site:money.udn.com OR site:tw.stock.yahoo.com`]);
 const jobs=terms.flatMap(q=>[fetchGoogleNews(q),fetchBingNews(q)]); const batches=await Promise.allSettled(jobs);
 const map=new Map<string,ResearchNewsItem>(); for(const b of batches)if(b.status==='fulfilled')for(const n of b.value)if(!map.has(n.title))map.set(n.title,n); const news=[...map.values()].sort((a,b)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime()).slice(0,24);
 const gw=await optionalGateway(rawQuery,symbol,name,news); if(gw)return {symbol,name,query:rawQuery,searchedAt:Date.now(),sections:gw,news,gatewayUsed:true};
 const highlights=news.slice(0,4).map(x=>`${x.title}${x.source?`｜${x.source}`:''}`);
 const profile=compact(news,/(基金|ETF|投信|經理人|主動式|指數|發行)/i,4);
 const dates=compact(news,/(募集|掛牌|上市|成立|申購|日期|\d{1,2}[\/月]\d{1,2})/i,5);
 const income=compact(news,/(發行價|募集價|10元|配息|季配|月配|股利|收益分配)/i,4);
 const strategy=compact(news,/(策略|主動|布局|投資|AI|市值|選股|題材)/i,5);
 const selection=compact(news,/(選股|成分|持股|產業|龍頭|千金|市值)/i,5);
 const risk=[`新募集或主動式 ETF 尚未有完整市場交易歷史時，不應以假歷史績效推估未來報酬。`,`配息政策、募集與掛牌日期可能調整，正式操作前以投信公司、TWSE 或公開說明書最新公告為準。`];
 const sections:ResearchSection[]=[
  {key:'highlights',title:'最新重點',lines:highlights.length?highlights:['目前沒有取得可辨識的即時新聞摘要。']},
  {key:'profile',title:'ETF 基本檔案',lines:profile.length?profile:[`${symbol} ${name}｜基本資料仍需以發行投信 / TWSE 官方公告確認。`]},
  {key:'dates',title:'募集 / 成立 / 掛牌重要日期',lines:dates.length?dates:['目前新聞搜尋未擷取到可確認的重要日期，請查看官方募集 / 掛牌公告。']},
  {key:'income',title:'發行價格與配息機制',lines:income.length?income:['目前未從即時來源擷取到可確認的發行價格或配息機制。']},
  {key:'strategy',title:'投資策略',lines:strategy.length?strategy:['目前未從即時來源擷取到足夠的策略說明。']},
  {key:'selection',title:'選股方向',lines:selection.length?selection:['目前未從即時來源擷取到足夠的選股資訊。']},
  {key:'news',title:'最新新聞',lines:news.slice(0,8).map(x=>`${safeDate(x.publishedAt)}｜${x.title}｜${x.source}`)},
  {key:'risk',title:'投資風險',lines:risk},
  {key:'sources',title:'資料來源',lines:news.slice(0,10).map(x=>`【${sourceClass(x.source)}】${x.source}｜${x.link}`)},
 ];
 return {symbol,name,query:rawQuery,searchedAt:Date.now(),sections,news,gatewayUsed:false};
}
