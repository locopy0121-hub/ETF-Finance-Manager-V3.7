import React,{useMemo,useState} from 'react';
import {Alert,Image,Platform,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import type {V3Preferences} from './model';
import {getNativeAppIcon,setNativeAppIcon} from '../services/nativeUi';

const ICONS=[
 ['icon-01','經典財富金',require('../../assets/app-icons/icon-01.png')],
 ['icon-02','科技深海藍',require('../../assets/app-icons/icon-02.png')],
 ['icon-03','股利綠芽',require('../../assets/app-icons/icon-03.png')],
 ['icon-04','烈焰損益',require('../../assets/app-icons/icon-04.png')],
 ['icon-05','極簡白金',require('../../assets/app-icons/icon-05.png')],
 ['icon-06','黑曜專業',require('../../assets/app-icons/icon-06.png')],
 ['icon-07','智慧 AI 投資',require('../../assets/app-icons/icon-07.png')],
 ['icon-08','月月配息',require('../../assets/app-icons/icon-08.png')],
 ['icon-09','台股紅綠',require('../../assets/app-icons/icon-09.png')],
 ['icon-10','尊榮旗艦',require('../../assets/app-icons/icon-10.png')],
] as const;
export default function AppIconCenter({prefs,onChange}:{prefs:V3Preferences;onChange:(p:Partial<V3Preferences>)=>void}){
 const native=useMemo(()=>getNativeAppIcon(),[]);const[selected,setSelected]=useState<string>(native||prefs.appIconKey||'icon-01');
 const apply=()=>{if(Platform.OS!=='android'){Alert.alert('目前支援 Android','iOS 的替代 App Icon 需要另一套原生宣告。');return}const ok=setNativeAppIcon(selected);if(ok){onChange({appIconKey:selected as V3Preferences['appIconKey']});Alert.alert('App Icon 已切換','返回手機桌面後圖示會更新；部分 Launcher 可能延遲數秒重新整理。');}else Alert.alert('切換失敗','目前 APK 尚未載入 V3.6.0 Native Icon Center。')};
 return <View><Text style={s.note}>內建 10 組 ETF財務管家圖示。先選取預覽，再按「套用桌面圖示」。此功能只更改本 App 圖示，不會修改其他 App。</Text><View style={s.grid}>{ICONS.map(([key,name,img])=><TouchableOpacity key={key} onPress={()=>setSelected(key)} style={[s.item,selected===key&&s.itemOn]}><Image source={img} style={s.icon}/><Text style={s.name}>{name}</Text><Text style={s.state}>{selected===key?'✓ 已選擇':'點選預覽'}</Text></TouchableOpacity>)}</View><TouchableOpacity style={s.apply} onPress={apply}><Text style={s.applyText}>套用桌面圖示</Text></TouchableOpacity></View>
}
const s=StyleSheet.create({note:{color:'rgba(255,255,255,.58)',fontSize:10,lineHeight:16,marginBottom:12},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},item:{width:'48.5%',borderWidth:1,borderColor:'rgba(255,255,255,.1)',borderRadius:14,padding:10,alignItems:'center',backgroundColor:'rgba(255,255,255,.025)'},itemOn:{borderColor:'#D4AF37',backgroundColor:'rgba(212,175,55,.09)'},icon:{width:72,height:72,borderRadius:16},name:{color:'#fff',fontSize:11,fontWeight:'900',marginTop:8,textAlign:'center'},state:{color:'rgba(255,255,255,.45)',fontSize:8,marginTop:3},apply:{marginTop:14,minHeight:50,borderRadius:13,backgroundColor:'#D4AF37',alignItems:'center',justifyContent:'center'},applyText:{color:'#0B111E',fontWeight:'900'}});
