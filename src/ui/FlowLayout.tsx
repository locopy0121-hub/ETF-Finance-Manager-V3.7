import React from 'react';
import {StyleSheet,View,useWindowDimensions,type ViewStyle} from 'react-native';
import type {V3CardSpan} from '../v3/model';

const ratio:Record<V3CardSpan,number>={12:1,9:.75,8:2/3,6:.5,4:1/3,3:.25};
export function flowItemWidth(span:V3CardSpan,available:number,gap=8){const columns=Math.max(1,Math.round(1/ratio[span]));return Math.max(0,(available-gap*(columns-1))*ratio[span])}
export function FlowLayout({children,gap=8,style}:{children:React.ReactNode;gap?:number;style?:ViewStyle}){const {width}=useWindowDimensions();return <View style={[s.flow,{gap,maxWidth:width},style]}>{children}</View>}
export function FlowItem({span=12,gap=8,minWidth=72,children,style}:{span?:V3CardSpan;gap?:number;minWidth?:number;children:React.ReactNode;style?:ViewStyle}){const {width}=useWindowDimensions();const available=Math.max(0,width-32);const target=flowItemWidth(span,available,gap);return <View style={[{width:Math.min(available,Math.max(minWidth,target)),maxWidth:'100%',flexGrow:span===12?1:0},style]}>{children}</View>}
const s=StyleSheet.create({flow:{width:'100%',flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start',overflow:'hidden'}});
