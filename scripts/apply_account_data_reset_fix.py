from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'expected source fragment not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'App.tsx',
    "import { createSafetyBackup, restoreSafetyBackup, type SafetyBackupKind } from './src/v3/safetyBackup';",
    "import { createSafetyBackup, restoreSafetyBackup, type SafetyBackupKind } from './src/v3/safetyBackup';\nimport { resetAccountingData } from './src/v3/accountDataReset';",
)

replace_once(
    'App.tsx',
    " const clearLedgerHistory=async()=>safeMutate('records','清除全部帳務紀錄',s=>({...s,ledger:[],cashReconciliation:{...s.cashReconciliation,checkedAt:undefined,actualBalance:undefined,note:'帳務紀錄已清除，可由安全備份還原'}}));",
    " const clearLedgerHistory=async()=>safeMutate('all','清除全部帳務資料',s=>resetAccountingData(s,today()));",
)

replace_once(
    'src/v3/screensBase.tsx',
    "任何清除／重算前都先建立可還原安全快照；備份失敗會阻止清除。完整匯出仍保留作外部備份。",
    "任何清除／重算前都先建立可還原安全快照；備份失敗即停止清除。完整匯出仍保留作外部備份。",
)

old_button = "<TouchableOpacity style={s.deleteAction} onPress={()=>Alert.alert('清除全部帳務紀錄','此操作風險較高。系統先自動備份；可從下方安全備份還原。',[{text:'取消',style:'cancel'},{text:'再次確認',style:'destructive',onPress:()=>Alert.alert('最後確認','確定清除全部帳務紀錄？',[{text:'取消',style:'cancel'},{text:'清除',style:'destructive',onPress:()=>void onClearLedger()}])}])}><Text style={s.deleteActionText}>清除全部帳務紀錄</Text></TouchableOpacity>"
new_button = "<TouchableOpacity style={s.deleteAction} onPress={()=>Alert.alert('清除全部帳務資料','會先建立完整安全備份；備份失敗即停止清除。成功後會清除買賣／配息入帳／現金帳務、持股庫存、現金餘額與損益快照，但保留主題、版面、Widget／監控器設定、自選清單與試算計畫。',[{text:'取消',style:'cancel'},{text:'再次確認',style:'destructive',onPress:()=>Alert.alert('最後確認','確定清除全部帳務資料？此動作會將帳戶回到合法空白狀態。',[{text:'取消',style:'cancel'},{text:'清除全部帳務資料',style:'destructive',onPress:async()=>{const ok=await onClearLedger();setSafetyBackups(await listSafetyBackups());if(ok)Alert.alert('清除完成','帳務、庫存、現金、配息入帳狀態與損益快照已清空；App 設定與版面均已保留。')}}])}])}><Text style={s.deleteActionText}>清除全部帳務資料</Text></TouchableOpacity>"
replace_once('src/v3/screensBase.tsx', old_button, new_button)

print('account data reset source patch applied')
