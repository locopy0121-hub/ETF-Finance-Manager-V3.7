const fs=require('fs');
const t=fs.readFileSync('src/v3/monitorTemplates.ts','utf8');
const s=fs.readFileSync('src/v3/screens.tsx','utf8');
const o=fs.readFileSync('src/services/floatingOverlay.ts','utf8');
let failed=0;const check=(ok,msg)=>{if(ok)console.log('PASS',msg);else{console.error('FAIL',msg);failed++}};
const templateRows=[...t.matchAll(/\{id:'([^']+)',name:'([^']+)',fields:\[([^\]]*)\],columns:(\d)(?:,compact:true)?(?:,nativeMode:'([^']+)')?\}/g)];
check(templateRows.length===12,'exactly 12 monitor templates are declared');
check(templateRows.every(x=>x[3].trim().length>0),'every template has composition fields');
check(templateRows.every(x=>x[5]==='table'||x[5]==='puzzle'||x[5]==='strip'),'every template declares nativeMode');
check(t.includes("export const templateDefaultFields=(id:MonitorDisplayMode)=>[...monitorTemplate(id).fields]"),'template default field helper exists');
check(s.includes('function MonitorTemplateEditor'),'template editor component exists');
check(s.includes('模板內容與組合項目'),'template editor exposes composition content');
check(s.includes('套用此模板組合'),'template editor can apply template composition');
check(s.includes('function MonitorChoice'),'monitor control choice is separate from generic editable Choice');
check(s.includes('onPress={()=>{patchMonitor({displayMode:t.id});setMonitorTemplateEdit(t.id)}}'),'template press selects and opens editor');
check(o.includes('mode:template.nativeMode'),'payload uses explicit template nativeMode');
check(o.includes('templateFields:template.fields'),'payload carries template composition for native fallback');
if(failed){console.error(`MONITOR TEMPLATE CONTRACT: FAIL (${failed})`);process.exit(1)}
console.log('MONITOR TEMPLATE CONTRACT: PASS');
