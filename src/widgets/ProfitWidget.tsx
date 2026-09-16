'use no memo';
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { Holding } from '../data/portfolio';
import type { WidgetAlign, WidgetField } from '../storage/appStorage';
import type { ETFSummary, PortfolioSummary } from '../types/etf';
import { rendererNode, resolveRendererColor } from '../ui/universalRegistry';
import type { UniversalEditorNode } from '../ui/editorSchema';

export type WidgetHolding = Holding & { price:number; previousClose?:number };
export type WidgetExtras = {
  portfolioSummary?: PortfolioSummary;
  cumulativeDividend?:number; monthDividend?:number; monthContribution?:number; holdingCount?:number; cashBalance?:number;
  totalPnl?:number; totalRoi?:number; totalAssets?:number; historicalTradeCost?:number; historicalBuyFees?:number; historicalCashOutflow?:number;
  currentTradeCost?:number; currentCashBasis?:number; pricePnl?:number; cashUnrealizedPnl?:number; realizedPnl?:number; todayPnl?:number; todayPnlPct?:number;
  trendValues?:number[]; trendLabel?:string;
  widgetBackgroundColor?:string; widgetPrimaryTextColor?:string; widgetSecondaryTextColor?:string; widgetAccentColor?:string; widgetPositiveColor?:string; widgetNegativeColor?:string; widgetIcon?:string; showWidgetIcon?:boolean; widgetRadius?:number;
  universalNodes?:Record<string,UniversalEditorNode>;
};
type Props = {
  holdings:WidgetHolding[]; opacity?:number; width?:number; height?:number; isActive?:boolean; updatedAt?:number; displayFields?:WidgetField[]; selectedSymbols?:string[]; fontScale?:number; align?:WidgetAlign; extras?:WidgetExtras;
  showStatusLight?:boolean; showTrendChart?:boolean; trendChartType?:'line'|'area'|'bar'|'sparkline'|'step'; trendShowLastValue?:boolean; trendShowPercent?:boolean; trendHeight?:number; trendLineWidth?:number; trendShowGrid?:boolean; trendShowAxis?:boolean; trendShowUpdatedAt?:boolean; compactChart?:boolean; status?:'live'|'afterHours'|'delayed'|'error'|'stopped';
};

const signedMoney=(n:number)=>`${n>=0?'+':'-'}${Math.round(Math.abs(n)).toLocaleString('zh-TW')}`;
const plainMoney=(n:number)=>Math.round(Number(n)||0).toLocaleString('zh-TW');
const cleanTrend=(values:unknown)=>Array.isArray(values)?values.map(Number).filter(Number.isFinite).slice(-720):[];
function colorWithAlpha(color:string,alpha:number){const c=String(color||'').trim();const m=/^#([0-9a-f]{6})$/i.exec(c);if(!m)return c||`rgba(15,23,42,${alpha})`;const n=parseInt(m[1],16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;}
function sparklineSvg(values:number[],color:string,type:'line'|'area'|'bar'|'sparkline'|'step'='area',lineWidth=3,showGrid=true,showAxis=false){
  const w=180,h=64,p=4;if(values.length<2)return '';
  const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(1e-9,hi-lo);
  const pts=values.map((v,i)=>({x:p+i*(w-p*2)/Math.max(1,values.length-1),y:h-p-(v-lo)/span*(h-p*2)}));
  const line=pts.map(q=>`${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');
  const stepLine=pts.map((q,i)=>i===0?`${q.x.toFixed(2)},${q.y.toFixed(2)}`:`${q.x.toFixed(2)},${pts[i-1].y.toFixed(2)} ${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');
  const area=`M ${pts[0].x.toFixed(2)} ${h-p} L ${pts.map(q=>`${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' L ')} L ${pts[pts.length-1].x.toFixed(2)} ${h-p} Z`;
  const bars=pts.map(q=>`<rect x="${(q.x-1.5).toFixed(2)}" y="${q.y.toFixed(2)}" width="3" height="${Math.max(1,h-p-q.y).toFixed(2)}" rx="1" fill="${color}" fill-opacity="0.72"/>`).join('');
  const grid=showGrid?[.25,.5,.75].map(r=>`<line x1="${p}" x2="${w-p}" y1="${(p+(h-p*2)*r).toFixed(2)}" y2="${(p+(h-p*2)*r).toFixed(2)}" stroke="rgba(255,255,255,.12)" stroke-width="0.7"/>`).join(''):'';
  const axis=showAxis?`<line x1="${p}" x2="${p}" y1="${p}" y2="${h-p}" stroke="rgba(255,255,255,.22)" stroke-width="0.8"/><line x1="${p}" x2="${w-p}" y1="${h-p}" y2="${h-p}" stroke="rgba(255,255,255,.22)" stroke-width="0.8"/>`:'';
  const body=type==='bar'?bars:`${type==='area'?`<path d="${area}" fill="${color}" fill-opacity="0.12"/>`:''}<polyline points="${type==='step'?stepLine:line}" fill="none" stroke="${color}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}${axis}${body}</svg>`;
}

const emptyPortfolioSummary:PortfolioSummary={totalMarketValue:0,totalInvestmentCost:0,totalNetLiquidationValue:0,totalEstimatedSellCommission:0,totalEstimatedSellTax:0,totalUnrealizedProfit:0,totalUnrealizedROI:0,totalDividendsReceived:0,nextEstimatedDividendTotal:0,etfSummaries:[]};
function pickSummary(summary:PortfolioSummary,selectedSymbols:string[]):PortfolioSummary|ETFSummary{if(selectedSymbols.length===1){const single=summary.etfSummaries.find(x=>x.etfCode===selectedSymbols[0]);if(single)return single;}return summary;}

export function ProfitWidget({holdings: _holdings,opacity=85,width=320,height=140,isActive=true,updatedAt,fontScale=100,align='left',displayFields=['totalPnl','totalPnlPct','todayPnl','totalAssets','marketValue','updatedAt','marketState'],selectedSymbols=[],extras={},showStatusLight=true,showTrendChart=true,trendChartType='area',trendShowLastValue=true,trendShowPercent=true,trendHeight=64,trendLineWidth=3,trendShowGrid=true,trendShowAxis=false,trendShowUpdatedAt=true,compactChart=true,status='live'}:Props){
  const canonical=extras.portfolioSummary??emptyPortfolioSummary;
  const active=pickSummary(canonical,selectedSymbols);
  const single='etfCode' in active;
  const unrealizedProfit=single?active.unrealizedProfit:active.totalUnrealizedProfit;
  const unrealizedROI=single?active.unrealizedROI:active.totalUnrealizedROI;
  const netLiquidationValue=single?active.netLiquidationValue:active.totalNetLiquidationValue;
  const marketValue=single?active.currentMarketValue:active.totalMarketValue;
  const investmentCost=single?active.totalInvestmentCost:active.totalInvestmentCost;
  const estimatedSellCommission=single?active.estimatedSellCommission:active.totalEstimatedSellCommission;
  const estimatedSellTax=single?active.estimatedSellTax:active.totalEstimatedSellTax;
  const rows=canonical.etfSummaries.filter(x=>!selectedSymbols.length||selectedSymbols.includes(x.etfCode)).slice(0,height>=180?4:height>=140?2:0);
  const has=(f:WidgetField)=>f==='totalPnl'||displayFields.includes(f);
  const alpha=Math.max(.12,Math.min(1,opacity/100));
  const primaryTheme=extras.widgetPrimaryTextColor??'#E2E8F0',secondary=extras.widgetSecondaryTextColor??'#94A3B8',accent=extras.widgetAccentColor??'#D4AF37',positive=extras.widgetPositiveColor??'#FCA5A5',negative=extras.widgetNegativeColor??'#86EFAC',neutral=secondary;
  const rootNode=rendererNode(extras.universalNodes,'widget:root:title','ETF財務管家'),pnlNode=rendererNode(extras.universalNodes,'widget:pnl:label','未實現損益');
  const primary=resolveRendererColor(rootNode.textColorMode,rootNode.textColor,primaryTheme,unrealizedProfit,positive,negative,neutral);
  const rootBg=resolveRendererColor(rootNode.backgroundColorMode,rootNode.backgroundColor,extras.widgetBackgroundColor??'#0F172A',unrealizedProfit,positive,negative,neutral);
  const bg=colorWithAlpha(rootBg,alpha);
  const pnlColor=resolveRendererColor(pnlNode.textColorMode,pnlNode.textColor,unrealizedProfit>=0?positive:negative,unrealizedProfit,positive,negative,neutral);
  const timeText=updatedAt?new Date(updatedAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--:--:--';
  const lamp=status==='error'?'🔴':status==='stopped'?'⚪':status==='delayed'?'🟡':status==='afterHours'?'🔵':'🟢';
  const scale=Math.max(.7,Math.min(1.8,fontScale/100));
  const trend=cleanTrend(extras.trendValues),trendColor=trend.length>=2&&trend[trend.length-1]>=trend[0]?positive:negative;
  const graph=showTrendChart&&width>=240&&trend.length>=2?sparklineSvg(trend,trendColor,trendChartType,trendLineWidth,trendShowGrid,trendShowAxis):'';
  const graphW=Math.max(96,Math.min(180,Math.round(width*(compactChart?.38:.46)))),graphH=Math.max(40,Math.min(100,trendHeight));
  const trendLast=trend.length?trend[trend.length-1]:0,trendFirst=trend.length?trend[0]:0,trendPct=Math.abs(trendFirst)>1e-9?(trendLast-trendFirst)/Math.abs(trendFirst)*100:0;
  const extra:string[]=[];
  if(has('marketValue'))extra.push(`目前市值 ${plainMoney(marketValue)}`);
  if(has('totalAssets'))extra.push(`淨清算價值 ${plainMoney(netLiquidationValue)}`);
  if(has('currentCashBasis')||has('totalCost'))extra.push(`目前含費成本 ${plainMoney(investmentCost)}`);
  if(has('historicalBuyFees'))extra.push(`預估賣出手續費 ${plainMoney(estimatedSellCommission)}`);
  if(has('cashUnrealizedPnl')||has('pricePnl')||has('costPnl'))extra.push(`未實現損益 ${signedMoney(unrealizedProfit)}`);
  if(has('cumulativeDividend'))extra.push(`累積配息 ${plainMoney(extras.cumulativeDividend??canonical.totalDividendsReceived)}`);
  if(has('holdingCount'))extra.push(`持有 ${extras.holdingCount??canonical.etfSummaries.length} 檔`);
  if(has('monthDividend'))extra.push(`本月配息 ${plainMoney(extras.monthDividend??0)}`);
  if(has('monthContribution'))extra.push(`本月投入 ${plainMoney(extras.monthContribution??0)}`);
  return <FlexWidget clickAction="ETF_WIDGET_TAP" clickActionData={{target:'dashboard'}} style={{width:'match_parent',height:'match_parent',backgroundColor:bg,borderColor:accent,borderWidth:1,borderRadius:Math.max(0,Number(extras.widgetRadius??8)),padding:12,flexDirection:'column'}} accessibilityLabel={`${rootNode.displayName}，${pnlNode.displayName} ${signedMoney(unrealizedProfit)}`}>
    <FlexWidget style={{width:'match_parent',flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><TextWidget text={`${extras.showWidgetIcon!==false&&extras.widgetIcon?`${extras.widgetIcon} `:''}${single?active.etfCode:rootNode.displayName}`} style={{fontSize:12*scale,fontWeight:'bold',color:primary,textAlign:align}}/><TextWidget text={`${showStatusLight?lamp+' ':''}${isActive?'盤中':'盤後'}`} style={{fontSize:9*scale,color:secondary}}/></FlexWidget>
    <FlexWidget style={{width:'match_parent',flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><FlexWidget style={{flexDirection:'column'}}><TextWidget text={pnlNode.displayName} style={{fontSize:10*scale,color:secondary,marginTop:7,textAlign:align}}/><TextWidget text={signedMoney(unrealizedProfit)} style={{fontSize:26*scale,fontWeight:'bold',color:pnlColor}}/>{has('totalPnlPct')?<TextWidget text={`${unrealizedROI>=0?'+':''}${unrealizedROI.toFixed(2)}%`} style={{fontSize:11*scale,fontWeight:'bold',color:pnlColor}}/>:null}</FlexWidget>{graph?<FlexWidget style={{width:graphW,flexDirection:'column',alignItems:'flex-end'}}><TextWidget text={`${extras.trendLabel??'走勢'}${trendShowLastValue?` ${signedMoney(trendLast)}`:''}${trendShowPercent?` ${trendPct>=0?'+':''}${trendPct.toFixed(2)}%`:''}`} style={{fontSize:8*scale,color:trendColor,textAlign:'right'}}/><SvgWidget svg={graph} style={{width:graphW,height:graphH}}/></FlexWidget>:null}</FlexWidget>
    {extra.slice(0,height>=180?5:2).map((text,i)=><TextWidget key={`x-${i}`} text={text} style={{fontSize:9*scale,color:secondary,marginTop:3,textAlign:align}}/>)}
    {rows.map(row=><FlexWidget key={row.etfCode} clickAction="ETF_WIDGET_SELECT" clickActionData={{symbol:row.etfCode}} style={{width:'match_parent',flexDirection:'row',justifyContent:'space-between',marginTop:4}}><TextWidget text={`${row.etfCode} ${row.currentPrice.toFixed(2)}`} style={{fontSize:9*scale,color:primary}}/><TextWidget text={`${signedMoney(row.unrealizedProfit)}｜淨值 ${plainMoney(row.netLiquidationValue)}`} style={{fontSize:9*scale,color:row.unrealizedProfit>=0?positive:negative}}/></FlexWidget>)}
    {has('updatedAt')?<TextWidget text={`${trendShowUpdatedAt?'更新 ':''}${timeText}｜費 ${plainMoney(estimatedSellCommission)}｜稅 ${plainMoney(estimatedSellTax)}`} style={{fontSize:8*scale,color:secondary,marginTop:4,textAlign:align}}/>:null}
  </FlexWidget>;
}
