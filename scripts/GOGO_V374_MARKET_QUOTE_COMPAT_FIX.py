from pathlib import Path

p=Path('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt')
t=p.read_text(encoding='utf-8')

repls=[
    (
        '    val basePayload=payload\n    val positions=basePayload.optJSONArray("positions")?:return',
        '    val basePayload=payload\n    val cashBalance = payload.optDouble("cashBalance", 0.0)\n    val positions=basePayload.optJSONArray("positions")?:return',
    ),
    (
        '        var marketValue=basePayload.optDouble("marketValue",0.0)',
        '        var totalAssets=basePayload.optDouble("marketValue",0.0)',
    ),
    (
        '          instant+=nextPnl-oldPnl;todayTotal+=nextToday-oldToday;marketValue+=nextMarket-oldMarket',
        '          instant+=nextPnl-oldPnl;todayTotal+=nextToday-oldToday;totalAssets+=nextMarket-oldMarket',
    ),
    (
        '        val cashBalance=basePayload.optDouble("cashBalance",0.0)\n        val nextUpdatedAt=',
        '        val nextUpdatedAt=',
    ),
    (
        '            basePayload.put("positions", nextPositions)\n            basePayload.put("instantPnl",instant);basePayload.put("todayPnl",todayTotal);basePayload.put("marketValue",marketValue);basePayload.put("totalAssets",marketValue+cashBalance);basePayload.put("updatedAt",nextUpdatedAt);basePayload.put("healthy",true)\n            getSharedPreferences(PREF,MODE_PRIVATE).edit().putString(PREF_PAYLOAD,basePayload.toString()).apply();updateOverlayText()',
        '            payload.put("positions", nextPositions)\n            payload.put("instantPnl", instant)\n            payload.put("todayPnl", todayTotal)\n            payload.put("marketValue", totalAssets)\n            payload.put("totalAssets", totalAssets + cashBalance)\n            payload.put("updatedAt", nextUpdatedAt)\n            payload.put("healthy", true)\n            getSharedPreferences(PREF,MODE_PRIVATE).edit().putString(PREF_PAYLOAD,payload.toString()).apply();updateOverlayText()',
    ),
]

for old,new in repls:
    if new in t:
        continue
    if old not in t:
        raise SystemExit(f'Compatibility source not found: {old[:120]!r}')
    t=t.replace(old,new,1)

p.write_text(t,encoding='utf-8')
print('Applied V3.7.4 market quote compatibility fix')
