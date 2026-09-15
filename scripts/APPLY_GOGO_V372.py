from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')


def collapse_exact_duplicate_lines(rel, exact_line):
    text = read(rel)
    lines = text.splitlines()
    out = []
    seen = False
    removed = 0
    for line in lines:
        if line == exact_line:
            if seen:
                removed += 1
                continue
            seen = True
        out.append(line)
    if removed:
        write(rel, '\n'.join(out) + ('\n' if text.endswith('\n') else ''))
        print(f'CLEANED {rel}: removed {removed} duplicate line(s)')
    else:
        print(f'OK unique: {rel}: {exact_line[:70]}')


def require(rel, snippets):
    text = read(rel)
    for label, snippet in snippets:
        if snippet not in text:
            raise SystemExit(f'CONTRACT MISS {rel}: {label}: {snippet[:120]!r}')
        print(f'PASS {rel}: {label}')


# Idempotency repair: previous one-shot runs could reinsert these exact declarations.
collapse_exact_duplicate_lines(
    'App.tsx',
    "import { estimateSellFee, estimateSellTaxBySettings } from './src/data/tradeSettings';",
)
collapse_exact_duplicate_lines(
    'src/v3/storage.ts',
    " const reconciledCash=Number((p as any).cashReconciliation?.actualBalance);",
)

# Repair the compact recalc line if an old //-comment form still exists.
app = read('App.tsx')
bad = "const symbols=Array.from(new Set(s.holdings.map(h=>h.symbol))); // explicit current holdings only; archived ledger rows never recreate a deleted holdingconst holdings="
good = "const symbols=Array.from(new Set(s.holdings.map(h=>h.symbol))); /* explicit current holdings only; archived ledger rows never recreate a deleted holding */const holdings="
if bad in app:
    write('App.tsx', app.replace(bad, good, 1))
    print('CLEANED App.tsx: repaired compact recalc comment')

# At this point V3.7.2 is already integrated. This script is deliberately validation-first
# and safe to rerun any number of times; it never inserts another copy of an existing patch.
require('App.tsx', [
    ('sell fee/tax import', "import { estimateSellFee, estimateSellTaxBySettings } from './src/data/tradeSettings';"),
    ('buy deducts cash', 'cashBalance:s.cashBalance-purchaseCost-x.fee'),
    ('sell fee fallback', 'estimateSellFee(gross,s.feeSettings)'),
    ('sell tax fallback', 'estimateSellTaxBySettings(gross,s.feeSettings)'),
    ('sell net validation', 'fee+tax<=gross'),
    ('sell credits net proceeds', 'cashBalance:s.cashBalance+proceeds'),
    ('cash reconciliation is canonical', 'cashBalance:Number.isFinite(actualBalance)?actualBalance:s.cashBalance'),
    ('buy-history edit rebalances cash', 'cashBalance:baseline+ledgerCash(ledger)'),
    ('current holdings only recalc', 'const symbols=Array.from(new Set(s.holdings.map(h=>h.symbol)))'),
    ('dashboard total assets includes cash', 'totalAssets:marketValue+Number(d.cashBalance??0)'),
])

require('src/v3/screens.tsx', [
    ('sell fee estimator import', 'estimateSellFee'),
    ('sell tax estimator import', 'estimateSellTaxBySettings'),
    ('sell auto fee formula', "kind==='buy'?estimateBuyFee(tradeAmount,common.feeSettings):estimateSellFee(tradeAmount,common.feeSettings)"),
    ('sell auto tax formula', "const calcTax=kind==='sell'&&autoFee?estimateSellTaxBySettings(tradeAmount,common.feeSettings):Number(tax||0)"),
    ('sell UI auto switch', '自動計算賣出手續費與 ETF 交易稅'),
    ('cash asset wording', '但會正確反映在證券帳戶總資產'),
])

require('src/v3/storage.ts', [
    ('schema 15', 'const SCHEMA=15;'),
    ('reconciled cash migration', 'cashBalance:Number.isFinite(reconciledCash)?reconciledCash:Number(p.cashBalance??0)'),
])

# Assert the declarations that caused the earlier TypeScript failure are singular.
app = read('App.tsx')
storage = read('src/v3/storage.ts')
if app.count("import { estimateSellFee, estimateSellTaxBySettings } from './src/data/tradeSettings';") != 1:
    raise SystemExit('IDEMPOTENCY FAIL: sell fee/tax import is not singular')
if storage.count(" const reconciledCash=Number((p as any).cashReconciliation?.actualBalance);") != 1:
    raise SystemExit('IDEMPOTENCY FAIL: reconciledCash declaration is not singular')

print('APPLY_GOGO_V372: PASS (idempotent)')
