from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src/v3/screens.tsx'
s=p.read_text(encoding='utf-8')
old="function normalizeEditorNodeForRender(base:UniversalEditorNode,saved?:UniversalEditorNode):UniversalEditorNode{return withUniversalDefaults({...base,...(saved??{}),text:{...base.text,...(saved?.text??{})},effects:Array.isArray(saved?.effects)?saved.effects:base.effects});}"
new="function normalizeEditorNodeForRender(base:UniversalEditorNode,saved?:UniversalEditorNode):UniversalEditorNode{const text={...defaultTextStyle(),...(base.text??{}),...(saved?.text??{})};return withUniversalDefaults({...base,...(saved??{}),text,effects:Array.isArray(saved?.effects)?saved.effects:base.effects} as UniversalEditorNode);}"
if old not in s: raise SystemExit('normalizeEditorNodeForRender target missing')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('FIX_GOGO_V373_TSC: applied')
