declare module 'expo-notifications';
declare module 'expo-background-task';
declare module 'expo-task-manager';
declare module 'expo-file-system';
declare module 'expo-sharing';
declare module 'expo-secure-store';
declare module '@react-native-community/netinfo';
declare module 'react-native-svg';
declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: { getItem(key:string):Promise<string|null>; setItem(key:string,value:string):Promise<void>; removeItem(key:string):Promise<void> };
  export default AsyncStorage;
}
declare module 'react-native-android-widget' {
  import * as React from 'react';
  export const FlexWidget: React.ComponentType<any>;
  export const TextWidget: React.ComponentType<any>;
  export const SvgWidget: React.ComponentType<any>;
  export function registerWidgetTaskHandler(handler:any): void;
  export function requestWidgetUpdate(options:any): Promise<any>;
  export function requestPinWidget(options:any): Promise<boolean>;
  export type WidgetTaskHandlerProps = { widgetInfo:any; widgetAction:string; clickAction?:string; clickActionData?:any; renderWidget:(node:any)=>void };
}

declare module 'expo-document-picker';
declare module 'expo-local-authentication';
declare module 'expo-clipboard';
declare module 'expo-application';
declare module 'expo-device';
declare module 'expo-intent-launcher';
declare module 'expo-sqlite';
declare module 'expo-print';

declare module 'expo-image-picker';

declare module '@react-native-community/datetimepicker';
declare module 'expo-file-system/legacy';
