const fs=require('fs');
const checks=[
 ['src/v3/MonitorFieldEditor.tsx','個別編輯'],['src/v3/MonitorFieldEditor.tsx','即時預覽'],['src/v3/MonitorFieldEditor.tsx','損益色'],
 ['src/v3/screens.tsx','桌面版面鎖'],['src/v3/screens.tsx','浮動監視器排程'],['src/v3/screens.tsx','顯示順序'],['src/v3/screens.tsx','跨 App BOT 已移除'],
 ['src/v3/monitoring.ts','fieldStyles'],['src/v3/monitoring.ts','schedule'],['src/services/floatingOverlay.ts','fieldStyles'],['App.tsx','scheduleAllows'],['App.tsx','if(!monitor?.enabled)']
];let fail=0;for(const [f,k] of checks){const ok=fs.existsSync(f)&&fs.readFileSync(f,'utf8').includes(k);console.log(ok?'PASS':'FAIL',f,k);if(!ok)fail++}process.exitCode=fail?1:0;
