export type FormulaContext=Record<string,number>;

type Token={t:'n'|'id'|'op'|'lp'|'rp'|'comma';v:string};
const FUNCS=new Set(['SUM','AVG','MIN','MAX','IF','ROUND','FLOOR','CEIL','ABS']);

function tokenize(src:string):Token[]{
 const out:Token[]=[];let i=0;
 while(i<src.length){
  const c=src[i];
  if(/\s/.test(c)){i++;continue}
  if(/[0-9.]/.test(c)){let j=i+1;while(j<src.length&&/[0-9.]/.test(src[j]))j++;out.push({t:'n',v:src.slice(i,j)});i=j;continue}
  if(c==='['){const j=src.indexOf(']',i+1);if(j<0)throw new Error('公式欄位缺少 ]');out.push({t:'id',v:src.slice(i+1,j).trim()});i=j+1;continue}
  if(/[A-Za-z_\u4e00-\u9fff]/.test(c)){let j=i+1;while(j<src.length&&/[A-Za-z0-9_.\u4e00-\u9fff]/.test(src[j]))j++;out.push({t:'id',v:src.slice(i,j)});i=j;continue}
  if(c==='('){out.push({t:'lp',v:c});i++;continue}
  if(c===')'){out.push({t:'rp',v:c});i++;continue}
  if(c===','){out.push({t:'comma',v:c});i++;continue}
  const two=src.slice(i,i+2);
  if(['>=','<=','==','!='].includes(two)){out.push({t:'op',v:two});i+=2;continue}
  if('+-*/%><'.includes(c)){out.push({t:'op',v:c});i++;continue}
  throw new Error(`不支援的符號：${c}`);
 }
 return out;
}
export function evaluateFormula(src:string,ctx:FormulaContext):number{
 const t=tokenize(src);let p=0;
 const peek=()=>t[p];const take=()=>t[p++];
 const expr=():number=>compare();
 const compare=()=>{let v=add();while(peek()?.t==='op'&&['>','<','>=','<=','==','!='].includes(peek().v)){const op=take().v,r=add();v=op==='>'?+(v>r):op==='<'?+(v<r):op==='>='?+(v>=r):op==='<='?+(v<=r):op==='=='?+(v===r):+(v!==r)}return v};
 const add=()=>{let v=mul();while(peek()?.t==='op'&&['+','-'].includes(peek().v)){const op=take().v,r=mul();v=op==='+'?v+r:v-r}return v};
 const mul=()=>{let v=unary();while(peek()?.t==='op'&&['*','/','%'].includes(peek().v)){const op=take().v,r=unary();if((op==='/'||op==='%')&&r===0)throw new Error('除數不能為 0');v=op==='*'?v*r:op==='/'?v/r:v%r}return v};
 const unary=():number=>{if(peek()?.t==='op'&&peek().v==='-'){take();return -unary()}if(peek()?.t==='op'&&peek().v==='+'){take();return unary()}return primary()};
 const primary=():number=>{
  const x=take();if(!x)throw new Error('公式不完整');
  if(x.t==='n'){const n=Number(x.v);if(!Number.isFinite(n))throw new Error('數字格式錯誤');return n}
  if(x.t==='lp'){const v=expr();if(take()?.t!=='rp')throw new Error('缺少 )');return v}
  if(x.t==='id'){
   const name=x.v;
   if(peek()?.t==='lp'){
    take();const args:number[]=[];if(peek()?.t!=='rp'){while(true){args.push(expr());if(peek()?.t==='comma'){take();continue}break}}if(take()?.t!=='rp')throw new Error('函數缺少 )');
    const f=name.toUpperCase();if(!FUNCS.has(f))throw new Error(`不支援函數：${name}`);
    if(f==='SUM')return args.reduce((a,b)=>a+b,0);if(f==='AVG')return args.length?args.reduce((a,b)=>a+b,0)/args.length:0;
    if(f==='MIN')return Math.min(...args);if(f==='MAX')return Math.max(...args);if(f==='ABS')return Math.abs(args[0]??0);
    if(f==='FLOOR')return Math.floor(args[0]??0);if(f==='CEIL')return Math.ceil(args[0]??0);
    if(f==='ROUND'){const d=Math.max(0,Math.min(8,Math.trunc(args[1]??0))),m=10**d;return Math.round((args[0]??0)*m)/m}
    if(f==='IF')return (args[0]??0)!==0?(args[1]??0):(args[2]??0);
   }
   if(!(name in ctx))throw new Error(`找不到資料欄位：${name}`);
   const n=Number(ctx[name]);if(!Number.isFinite(n))throw new Error(`資料欄位無效：${name}`);return n;
  }
  throw new Error('公式格式錯誤');
 };
 const result=expr();if(p!==t.length)throw new Error(`公式尾端無法解析：${peek()?.v??''}`);if(!Number.isFinite(result))throw new Error('公式結果不是有效數字');return result;
}
