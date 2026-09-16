const fs=require('fs');
const bridgePath='src/v3/screens.tsx';
const implementationPath='src/v3/screensBase.tsx';
const bridge=fs.readFileSync(bridgePath,'utf8');
const s=fs.readFileSync(implementationPath,'utf8');
const checks=[
 ['screens bridge re-exports shared implementation', /export \* from ['"]\.\/screensBase['"]/.test(bridge)],
 ['portfolioListTemplate helper exists', /const portfolioListTemplate=/],
 ['chartTypeLabel helper exists', /const chartTypeLabel=/],
 ['no 5-arg holdingMetrics sort call', !/holdingMetrics\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)/.test(s)],
 ['focus sort uses canonical 4-arg holdingMetrics', /holdingMetrics\(a,quotes,ledger,dividends\)/],
 ['portfolio list template resolves from pageLayouts', /pageLayouts\?\.portfolio\?\.cards\?\.find/],
];
let failed=0;
for(const [name,test] of checks){const ok=typeof test==='boolean'?test:test.test(s);console.log(`${ok?'PASS':'FAIL'}: ${name}`);if(!ok)failed++;}
if(failed){console.error(`V340 FIX1 regression audit failed: ${failed}`);process.exit(1);}
console.log(`V340 FIX1 REGRESSION AUDIT PASS (${checks.length} checks)`);
