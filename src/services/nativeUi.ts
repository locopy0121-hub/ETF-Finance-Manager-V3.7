import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeBridge={
  setImmersiveEditor?:(enabled:boolean)=>boolean;
  setAppIcon?:(key:string)=>boolean;
  getCurrentAppIcon?:()=>string;
};
const Native:NativeBridge|null=Platform.OS==='android'?requireOptionalNativeModule<NativeBridge>('FloatingInvestmentBot'):null;
export function setImmersiveEditor(enabled:boolean){try{return !!Native?.setImmersiveEditor?.(enabled)}catch{return false}}
export function setNativeAppIcon(key:string){try{return !!Native?.setAppIcon?.(key)}catch{return false}}
export function getNativeAppIcon(){try{return Native?.getCurrentAppIcon?.()||'icon-01'}catch{return 'icon-01'}}
