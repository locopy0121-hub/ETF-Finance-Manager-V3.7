import type { MoneyPreferences, V3Preferences } from './model';

export function clampDigits(value:number,min=0,max=12){
  if(!Number.isFinite(value))return min;
  return Math.max(min,Math.min(max,Math.round(value)));
}

export function smartNumber(value:number,digits:number,smart=true){
  const n=Number.isFinite(value)?value:0;
  const d=clampDigits(digits);
  return n.toLocaleString('zh-TW',{
    minimumFractionDigits:smart?0:d,
    maximumFractionDigits:d,
  });
}

export function priceNumber(value:number){
  const n=Number.isFinite(value)?value:0;
  return n.toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});
}

export function moneyNumber(value:number,money?:MoneyPreferences){
  const cfg=money;
  const digits=cfg?.moneyMode==='custom'?clampDigits(cfg.customMoneyDigits??cfg.moneyDigits??2):clampDigits(cfg?.moneyDigits??2);
  return smartNumber(value,digits,(cfg?.moneyMode??'smart')==='smart');
}

export function percentNumber(value:number,money?:MoneyPreferences,withSign=true){
  const cfg=money;
  const digits=cfg?.percentMode==='custom'?clampDigits(cfg.customPercentDigits??cfg.percentDigits??2):clampDigits(cfg?.percentDigits??2);
  const body=smartNumber(value,digits,(cfg?.percentMode??'smart')==='smart');
  return `${withSign&&value>0?'+':''}${body}%`;
}

export function signedMoney(value:number,money?:MoneyPreferences){
  const n=Number.isFinite(value)?value:0;
  return `${n>0?'+':n<0?'-':''}${moneyNumber(Math.abs(n),money)}`;
}

export function displayByKind(value:number,kind:'price'|'money'|'percent'|'plain',prefs?:V3Preferences){
  if(kind==='price')return priceNumber(value);
  if(kind==='percent')return percentNumber(value,prefs?.money);
  if(kind==='money')return moneyNumber(value,prefs?.money);
  return smartNumber(value,prefs?.money?.plainDigits??0,(prefs?.money?.plainMode??'smart')==='smart');
}
