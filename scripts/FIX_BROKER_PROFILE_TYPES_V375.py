from pathlib import Path


def read(path): return Path(path).read_text(encoding='utf-8')
def write(path,text): Path(path).write_text(text,encoding='utf-8')
def once(text,old,new,label):
    count=text.count(old)
    if count!=1: raise SystemExit(f'[FIX FAIL] {label}: expected 1 match, got {count}')
    return text.replace(old,new,1)

# Root cause 1: SettingsModal declared onBrokerProfilesChange in its props type but
# forgot to destructure the callback into the function scope.
p='src/v3/screensBase.tsx'
s=read(p)
s=once(
    s,
    'onChange,onWidgetChange,onNotifyChange,onOtaChange,onFeeChange,onCheckOta,onRefreshQuotes',
    'onChange,onWidgetChange,onNotifyChange,onOtaChange,onFeeChange,onBrokerProfilesChange,onCheckOta,onRefreshQuotes',
    'SettingsModal callback destructure',
)
write(p,s)

# Root cause 2: AI buy drafts predate brokerProfileId. Accept an optional id at the
# integration boundary, resolve it immediately to a canonical profile, and still
# persist a stable id on every resulting holding/ledger row.
p='App.tsx'
s=read(p)
s=once(
    s,
    "import { estimateSellFee, estimateSellTaxBySettings } from './src/data/tradeSettings';",
    "import { estimateSellFee, estimateSellTaxBySettings, resolveBrokerProfile } from './src/data/tradeSettings';",
    'App profile resolver import',
)
start=s.index(' const addBuy=')
end=s.index(' const addSell=',start)
seg=s[start:end]
seg=once(
    seg,
    "broker:string;brokerProfileId:string;account:string})=>patch(s=>{",
    "broker:string;brokerProfileId?:string;account:string})=>patch(s=>{const selectedBroker=resolveBrokerProfile(x.brokerProfileId,s.brokerProfiles,x.broker);const brokerProfileId=selectedBroker.id;const broker=selectedBroker.name;",
    'addBuy compatible signature and canonical resolution',
)
seg=seg.replace('x.brokerProfileId','brokerProfileId')
seg=seg.replace('x.broker||h.broker','broker||h.broker')
seg=seg.replace('broker:x.broker,','broker,')
seg=seg.replace('broker:x.broker,','broker,')
s=s[:start]+seg+s[end:]
write(p,s)

print('FIX_BROKER_PROFILE_TYPES_V375: PATCHED')
