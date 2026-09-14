import React from 'react';
import { StyleSheet, Text as RNText, TextProps } from 'react-native';
import { useAppTheme } from './Ui';

export function ScaledText(props:TextProps){
  const t=useAppTheme();
  const flat=StyleSheet.flatten(props.style)||{};
  const scale=Math.max(.8,Math.min(1.6,t.fontScale/100));
  const fontSize=typeof flat.fontSize==='number'?flat.fontSize*scale:14*scale;
  const lineHeight=typeof flat.lineHeight==='number'?Math.max(fontSize*1.15,flat.lineHeight*scale):undefined;
  const wrap=t.wrapText;
  const align=flat.textAlign??t.textAlign; const color=flat.color??t.text; return <RNText {...props} numberOfLines={wrap?undefined:props.numberOfLines} ellipsizeMode={wrap?undefined:props.ellipsizeMode} style={[props.style,{fontSize,lineHeight,flexShrink:1,textAlign:align,color}]}/>;
}
