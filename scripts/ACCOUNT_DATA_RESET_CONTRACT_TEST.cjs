const fs=require('fs');
const assert=require('assert');

const resetPath='src/v3/accountDataReset.ts';
assert(fs.existsSync(resetPath),'missing centralized accountDataReset.ts');
const reset=fs.readFileSync(resetPath,'utf8');
const app=fs.readFileSync('App.tsx','utf8');
const screens=fs.readFileSync('src/v3/screensBase.tsx','utf8');

for(const token of ['ledger:[]','holdings:[]','cashBalance:0','dailySnapshots:[]','intradayPnlPoints:[]']){
  assert(reset.includes(token),`reset contract missing ${token}`);
}
assert(/actualAmount:\s*undefined/.test(reset),'paid dividend amount must be cleared');
assert(/paidAt:\s*undefined/.test(reset),'paid dividend date must be cleared');
assert(reset.includes('preferences:state.preferences'),'preferences must be explicitly preserved');
assert(reset.includes('appSettings:state.appSettings'),'app settings must be explicitly preserved');
assert(reset.includes('savingsPlans:state.savingsPlans'),'savings plans must be explicitly preserved');
assert(app.includes("safeMutate('all','清除全部帳務資料'"),'settings reset must use all-scope safety backup');
assert(app.includes('resetAccountingData('),'App must delegate clear-all to centralized reset function');
assert(screens.includes('清除全部帳務資料'),'settings label must describe full accounting-data reset');
assert(screens.includes('備份失敗即停止清除'),'settings must disclose backup fail-safe');
console.log('ACCOUNT_DATA_RESET_CONTRACT_TEST PASS');
