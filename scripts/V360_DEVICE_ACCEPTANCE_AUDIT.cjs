const fs=require('fs');
const path=require('path');
const manifest=require('./V360_DEVICE_ACCEPTANCE_MANIFEST.cjs');

const ROOT=path.resolve(__dirname,'..');
const VALID_VERIFICATION=new Set(['static','device','hybrid']);
const COLLATOR=new Intl.Collator('en-US',{usage:'sort',sensitivity:'variant',numeric:false});

const nonEmptyString=value=>typeof value==='string'&&value.trim().length>0;
const normalizePath=value=>String(value||'').split(path.sep).join('/').replace(/\\/g,'/');

function validateManifest({version,areas,items}={}){
  const errors=[];
  if(!nonEmptyString(version))errors.push('version must be a non-empty string');
  if(!Array.isArray(areas)||!areas.length)errors.push('areas must be a non-empty array');
  if(!Array.isArray(items)||!items.length){errors.push('items must be a non-empty array');return errors;}
  const areaSet=new Set(Array.isArray(areas)?areas:[]);
  const seen=new Set();
  for(const [index,item] of items.entries()){
    const prefix=`item[${index}]`;
    if(!item||typeof item!=='object'){errors.push(`${prefix} must be an object`);continue;}
    if(!nonEmptyString(item.id))errors.push(`${prefix} id must be non-empty`);
    else if(seen.has(item.id))errors.push(`${prefix} duplicate id: ${item.id}`);
    else seen.add(item.id);
    if(!areaSet.has(item.area))errors.push(`${prefix} unknown area: ${String(item.area)}`);
    if(!VALID_VERIFICATION.has(item.verification))errors.push(`${prefix} invalid verification: ${String(item.verification)}`);
    for(const key of ['title','surface','expected','evidence'])if(!nonEmptyString(item[key]))errors.push(`${prefix} ${key} must be non-empty`);
    if(!Array.isArray(item.staticHooks))errors.push(`${prefix} staticHooks must be an array`);
    if(!Array.isArray(item.deviceSteps))errors.push(`${prefix} deviceSteps must be an array`);
    if((item.verification==='device'||item.verification==='hybrid')&&(!Array.isArray(item.deviceSteps)||item.deviceSteps.length===0||item.deviceSteps.some(x=>!nonEmptyString(x))))errors.push(`${prefix} deviceSteps must contain non-empty steps for ${item.verification}`);
    if((item.verification==='static'||item.verification==='hybrid')&&(!Array.isArray(item.staticHooks)||item.staticHooks.length===0))errors.push(`${prefix} staticHooks must contain at least one hook for ${item.verification}`);
  }
  return errors;
}

function checkStaticHook(hook){
  if(!hook||typeof hook!=='object')return {pass:false,detail:'invalid hook object'};
  if(!['file','contains'].includes(hook.type))return {pass:false,detail:`unsupported hook type: ${String(hook.type)}`};
  if(!nonEmptyString(hook.path))return {pass:false,detail:'hook path must be non-empty'};
  const relative=normalizePath(hook.path);
  const absolute=path.resolve(ROOT,...relative.split('/'));
  if(!absolute.startsWith(ROOT))return {pass:false,detail:`path escapes project root: ${relative}`};
  if(!fs.existsSync(absolute))return {pass:false,detail:`missing file: ${relative}`};
  if(hook.type==='file')return {pass:true,detail:`file exists: ${relative}`};
  if(!nonEmptyString(hook.text))return {pass:false,detail:`contains hook text must be non-empty: ${relative}`};
  const source=fs.readFileSync(absolute,'utf8');
  const pass=source.includes(hook.text);
  return {pass,detail:pass?`contains text: ${relative}`:`missing text in ${relative}: ${hook.text}`};
}

function evaluateItem(item){
  const hookResults=(item.staticHooks||[]).map(hook=>({hook,result:checkStaticHook(hook)}));
  const staticPass=item.verification==='device'?true:hookResults.every(x=>x.result.pass);
  const deviceStatus='pending';
  const status=!staticPass?'static-fail':item.verification==='device'?'device-pending':'static-pass-device-pending';
  return {...item,staticHooks:hookResults.map(x=>({type:x.hook.type,path:normalizePath(x.hook.path),...(x.hook.type==='contains'?{text:x.hook.text}:{}),pass:x.result.pass,detail:x.result.detail})),staticPass,deviceStatus,status};
}

function sortedItems(items){return [...items].sort((a,b)=>COLLATOR.compare(a.area,b.area)||COLLATOR.compare(a.id,b.id));}

function buildReport(input=manifest){
  const errors=validateManifest(input);
  if(errors.length)return {errors,report:null};
  const items=sortedItems(input.items.map(evaluateItem));
  const summary={total:items.length,staticPass:items.filter(x=>x.staticPass).length,staticFail:items.filter(x=>!x.staticPass).length,devicePending:items.filter(x=>x.deviceStatus==='pending').length};
  return {errors:[],report:{generator:'scripts/V360_DEVICE_ACCEPTANCE_AUDIT.cjs',version:input.version,summary,items}};
}

function markdown(report){
  const lines=[
    '# V3.6.0 Device Acceptance Evidence','',
    '> This report is generated deterministically. Static PASS does **not** mean physical-device PASS. Device verification remains pending until explicit evidence is recorded by a separate workflow.','',
    `Generator: \`${report.generator}\`  `,
    `Version: \`${report.version}\`  `,
    `Items: ${report.summary.total}; static pass: ${report.summary.staticPass}; static fail: ${report.summary.staticFail}; device pending: ${report.summary.devicePending}.`,'',
    '| Area | ID | Verification | Static | Device | Status | Expected evidence |','|---|---|---|---|---|---|---|',
    ...report.items.map(item=>`| ${item.area} | ${item.id} | ${item.verification} | ${item.staticPass?'PASS':'FAIL'} | ${item.deviceStatus} | ${item.status} | ${String(item.evidence).replace(/\|/g,'\\|')} |`),
    '','## Device steps','',
    ...report.items.flatMap(item=>[`### ${item.id} — ${item.title}`,'',`Surface: ${item.surface}`,'',...item.deviceSteps.map((step,index)=>`${index+1}. ${step}`),'',`Expected: ${item.expected}`,'',`Evidence required: ${item.evidence}`,''])
  ];
  return lines.join('\n')+'\n';
}

function writeReports(report){
  const outDir=path.join(ROOT,'docs','generated');
  fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'v360-device-acceptance.json'),JSON.stringify(report,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(outDir,'V360_DEVICE_ACCEPTANCE.md'),markdown(report),'utf8');
}

function main(){
  const {errors,report}=buildReport(manifest);
  if(errors.length){for(const error of errors)console.error(`FAIL manifest ${error}`);process.exitCode=1;return;}
  writeReports(report);
  for(const item of report.items)console.log(`${item.staticPass?'PASS':'FAIL'} ${item.id} — ${item.status}`);
  console.log(`V3.6.0 device acceptance: ${report.summary.staticPass}/${report.summary.total} static pass; ${report.summary.devicePending} device pending`);
  if(report.summary.staticFail)process.exitCode=1;
}

module.exports={validateManifest,checkStaticHook,evaluateItem,buildReport,markdown,writeReports};
if(require.main===module)main();
