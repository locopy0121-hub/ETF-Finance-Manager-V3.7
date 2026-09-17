import type { V3State } from './model';

const localDateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/**
 * Return a valid empty-account state while preserving non-accounting app configuration.
 * The caller is responsible for creating a safety backup before applying this state.
 */
export function resetAccountingData(state:V3State,asOfDate=localDateKey()):V3State{
  return {
    ...state,
    holdings:[],
    ledger:[],
    cashBalance:0,
    cashReconciliation:{
      ...state.cashReconciliation,
      actualBalance:undefined,
      checkedAt:undefined,
      note:'全部帳務資料已清除，可由安全備份還原',
    },
    dividends:state.dividends.map(event=>({
      ...event,
      actualAmount:undefined,
      paidAt:undefined,
      status:event.payDate&&event.payDate<=asOfDate?'pending':'planned',
    })),
    dailySnapshots:[],
    intradayPnlPoints:[],
    // These are configuration/planning data, not accounting records.
    preferences:state.preferences,
    appSettings:state.appSettings,
    brokerProfiles:state.brokerProfiles,
    defaultBrokerProfileId:state.defaultBrokerProfileId,
    savingsPlans:state.savingsPlans,
  };
}
