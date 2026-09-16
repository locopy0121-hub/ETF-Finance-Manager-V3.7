from pathlib import Path

p=Path('src/v3/MonitorFieldEditor.tsx')
t=p.read_text(encoding='utf-8')

repls=[
    (
        'const base=(order=1,field?:MonitorField):MonitorFieldStyle=>',
        'const base=(order=1,field?:MonitorField|null):MonitorFieldStyle=>',
    ),
    (
        'const[d,setD]=useState(initial);',
        'const[d,setD]=useState<MonitorFieldStyle>(initial);',
    ),
]
for old,new in repls:
    if new in t:
        continue
    if old not in t:
        raise SystemExit(f'TypeScript fix source not found: {old!r}')
    t=t.replace(old,new,1)
p.write_text(t,encoding='utf-8')
print('Applied V3.7.4 market quote TypeScript fix')
