const fs=require('fs');
const p=fs.readFileSync('src/components/ColorPalettePicker.tsx','utf8');
const u=fs.readFileSync('src/ui/UniversalEditor.tsx','utf8');
const m=fs.readFileSync('src/v3/MonitorFieldEditor.tsx','utf8');
let failed=0;const check=(ok,msg)=>{if(ok)console.log('PASS',msg);else{console.error('FAIL',msg);failed++}};
check(p.includes('const [draft,setDraft]'),'palette keeps a staged draft color');
check(p.includes('const confirmColor=()=>{onChange(draft);setOpen(false)}'),'palette confirms caller change only on explicit confirm');
check(p.includes('const cancel=()=>{setOpen(false)}'),'palette cancel closes without mutating caller value');
check(!/quick\.map\(c=><Pressable key=\{c\} onPress=\{\(\)=>\{onChange\(c\)/.test(p),'quick swatches do not commit immediately');
check(p.includes('確定使用此顏色'),'palette exposes explicit confirm action');
check(u.includes('ColorPalettePicker'),'Universal Editor uses shared palette module');
check((u.match(/ColorPalettePicker/g)||[]).length>=4,'Universal Editor routes multiple color settings through palette module');
check(m.includes('ColorPalettePicker label="文字顏色"')&&m.includes('ColorPalettePicker label="背景底色"'),'Monitor field editor uses shared palette module');
if(failed){console.error(`COLOR PALETTE CONTRACT: FAIL (${failed})`);process.exit(1)}
console.log('COLOR PALETTE CONTRACT: PASS');
