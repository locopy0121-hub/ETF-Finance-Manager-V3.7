import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Base from './screensBase';
import {
  huananYongchangFeeSettings,
  isHuananBroker,
  type FeeSettings,
} from '../data/tradeSettings';
import { BROKER_COST_WRITEOFF_PREFIX, holdingMetrics } from './engine';

export * from './screensBase';

const localDateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/**
 * Keep the existing settings UI, but turn the existing broker-name selection into
 * an accounting-strategy switch. Selecting/typing Huanan activates the Huanan profile;
 * changing to another broker returns to the custom profile without touching history.
 */
export function SettingsModal(props:any){
  const original=props.onFeeChange as ((patch:Partial<FeeSettings>)=>void)|undefined;
  const onFeeChange=(patch:Partial<FeeSettings>)=>{
    if(!original)return;
    if(patch.brokerName!==undefined){
      const brokerName=String(patch.brokerName);
      if(isHuananBroker(brokerName)){
        original({...huananYongchangFeeSettings,brokerName});
        return;
      }
      original({...patch,brokerProfileId:'custom'});
      return;
    }
    original(patch);
  };
  return <Base.SettingsModal {...props} onFeeChange={onFeeChange}/>;
}

function HuananWriteOffModal({visible,onClose,common,onCash}:{visible:boolean;onClose:()=>void;common:any;onCash:(x:{amount:number;date:string;broker:string;account:string;note?:string})=>void}){
  const holdings=Array.isArray(common?.holdings)?common.holdings:[];
  const globalHuanan=common?.feeSettings?.brokerProfileId==='huanan-yongchang'||isHuananBroker(common?.feeSettings?.brokerName);
  const eligible=useMemo(()=>holdings.filter((h:any)=>{
    const broker=String(h?.broker??'').trim();
    return isHuananBroker(broker)||(!broker&&globalHuanan);
  }),[holdings,globalHuanan]);
  const [symbol,setSymbol]=useState('');
  const [amount,setAmount]=useState('');
  const [memo,setMemo]=useState('');
  useEffect(()=>{if(visible&&!eligible.some((h:any)=>h.symbol===symbol))setSymbol(eligible[0]?.symbol??'')},[visible,eligible,symbol]);
  const holding=eligible.find((h:any)=>h.symbol===symbol);
  const metrics=holding?holdingMetrics(holding,common?.quotes??{},common?.ledger??[],common?.dividends??[],common?.feeSettings):null;
  const available=Math.max(0,Number(metrics?.totalFees??0));
  const submit=()=>{
    const value=Math.floor(Number(amount));
    if(!holding)return Alert.alert('無法沖銷','請先選擇華南永昌證券的持有 ETF。');
    if(!(value>0))return Alert.alert('金額錯誤','沖銷金額必須大於 0 元。');
    if(value>available+1e-9)return Alert.alert('金額過大',`目前可調整的持有買進手續費為 ${available.toLocaleString('zh-TW',{maximumFractionDigits:2})} 元。`);
    const note=`${BROKER_COST_WRITEOFF_PREFIX}${holding.symbol}:${memo.trim()||'券商核平'}`;
    onCash({
      amount:value,
      date:localDateKey(),
      broker:holding.broker||common?.feeSettings?.brokerName||'華南永昌證券',
      account:holding.account||'',
      note,
    });
    setAmount('');setMemo('');onClose();
    Alert.alert('沖銷完成',`現金 +${value} 元；${holding.symbol} 有效持有成本 -${value} 元。原始成交、股數、成交價與手續費紀錄均保留不變。`);
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={{flex:1,backgroundColor:'rgba(0,0,0,.66)',justifyContent:'flex-end'}}>
      <View style={{backgroundColor:'#111827',borderTopLeftRadius:20,borderTopRightRadius:20,padding:16,paddingBottom:28,maxHeight:'72%'}}>
        <Text style={{color:'#fff',fontSize:19,fontWeight:'900'}}>券商成本沖銷</Text>
        <Text style={{color:'#94a3b8',fontSize:12,lineHeight:18,marginTop:6}}>只建立核平調整：現金增加同額、有效持有成本降低同額；原始買進紀錄完全不修改。</Text>
        <Text style={{color:'#cbd5e1',fontSize:12,fontWeight:'800',marginTop:14,marginBottom:7}}>選擇 ETF</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
          {eligible.map((h:any)=><TouchableOpacity key={h.symbol} onPress={()=>setSymbol(h.symbol)} style={{paddingHorizontal:12,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:symbol===h.symbol?'#22d3ee':'#334155',backgroundColor:symbol===h.symbol?'rgba(34,211,238,.13)':'#0f172a'}}><Text style={{color:symbol===h.symbol?'#67e8f9':'#cbd5e1',fontWeight:'900'}}>{h.symbol}</Text><Text style={{color:'#64748b',fontSize:10,marginTop:2}} numberOfLines={1}>{h.name}</Text></TouchableOpacity>)}
        </ScrollView>
        {!eligible.length?<Text style={{color:'#fca5a5',marginTop:8}}>目前沒有可辨識為華南永昌證券的持有部位。</Text>:null}
        <Text style={{color:'#cbd5e1',fontSize:12,fontWeight:'800',marginTop:14}}>可沖銷持有買進費用：{available.toLocaleString('zh-TW',{maximumFractionDigits:2})} 元</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="例如 3" placeholderTextColor="#64748b" style={{marginTop:8,borderWidth:1,borderColor:'#334155',borderRadius:10,paddingHorizontal:12,paddingVertical:11,color:'#fff',backgroundColor:'#0f172a'}}/>
        <TextInput value={memo} onChangeText={setMemo} placeholder="備註（選填，例如：三筆手續費核平）" placeholderTextColor="#64748b" style={{marginTop:8,borderWidth:1,borderColor:'#334155',borderRadius:10,paddingHorizontal:12,paddingVertical:11,color:'#fff',backgroundColor:'#0f172a'}}/>
        <View style={{flexDirection:'row',gap:10,marginTop:16}}>
          <TouchableOpacity onPress={onClose} style={{flex:1,padding:12,borderRadius:10,borderWidth:1,borderColor:'#475569',alignItems:'center'}}><Text style={{color:'#cbd5e1',fontWeight:'800'}}>取消</Text></TouchableOpacity>
          <TouchableOpacity onPress={submit} style={{flex:1,padding:12,borderRadius:10,backgroundColor:'#0891b2',alignItems:'center'}}><Text style={{color:'#fff',fontWeight:'900'}}>確認沖銷</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>;
}

/**
 * The normal ledger screen is retained. Huanan gets one explicit write-off entry point;
 * it uses the existing cashIn ledger action so cash persistence/backup stays canonical.
 */
export function LedgerScreen(props:any){
  const [open,setOpen]=useState(false);
  const common=props.common;
  const globalHuanan=(common?.feeSettings?.brokerProfileId==='huanan-yongchang')||isHuananBroker(common?.feeSettings?.brokerName);
  const hasHuananHolding=common?.holdings?.some((h:any)=>isHuananBroker(h?.broker)||(!String(h?.broker??'').trim()&&globalHuanan));
  return <View style={{flex:1}}>
    <Base.LedgerScreen {...props}/>
    {hasHuananHolding?<TouchableOpacity onPress={()=>setOpen(true)} style={{position:'absolute',right:14,bottom:86,paddingHorizontal:13,paddingVertical:10,borderRadius:18,backgroundColor:'#0e7490',borderWidth:1,borderColor:'#67e8f9',elevation:8}}><Text style={{color:'#fff',fontWeight:'900',fontSize:12}}>現金沖銷</Text></TouchableOpacity>:null}
    <HuananWriteOffModal visible={open} onClose={()=>setOpen(false)} common={common} onCash={props.onCash}/>
  </View>;
}
