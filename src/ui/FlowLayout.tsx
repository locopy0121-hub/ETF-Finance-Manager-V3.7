import React,{createContext,useContext,useState} from 'react';
import {StyleSheet,View,type ViewStyle} from 'react-native';
import type {V3CardSpan} from '../v3/model';

const ratio:Record<V3CardSpan,number>={12:1,9:.75,8:2/3,6:.5,4:1/3,3:.25};
type FlowMetrics={width:number;gap:number};
const FlowWidthCtx=createContext<FlowMetrics|null>(null);

export function flowItemWidth(span:V3CardSpan,available:number,gap=8){const columns=Math.max(1,Math.round(1/ratio[span]));return Math.max(0,(available-gap*(columns-1))*ratio[span])}

export function FlowLayout({children,gap=8,style}:{children:React.ReactNode;gap?:number;style?:ViewStyle}){
 const [width,setWidth]=useState(0);
 return <View onLayout={e=>{const next=e.nativeEvent.layout.width;if(next>0&&Math.abs(next-width)>.5)setWidth(next)}} style={[s.flow,{gap},style]}><FlowWidthCtx.Provider value={width>0?{width,gap}:null}>{children}</FlowWidthCtx.Provider></View>;
}

export function FlowItem({span=12,gap,minWidth=72,customWidth,children,style}:{span?:V3CardSpan;gap?:number;minWidth?:number;customWidth?:number;children:React.ReactNode;style?:ViewStyle}){
 const parent=useContext(FlowWidthCtx);
 if(!parent)return <View style={[{width:'100%',maxWidth:'100%'},style]}>{children}</View>;
 const available=parent.width;
 const effectiveGap=gap??parent.gap;
 const target=customWidth&&customWidth>0?Math.min(available,customWidth):flowItemWidth(span,available,effectiveGap);
 return <View style={[{width:Math.min(available,Math.max(Math.min(minWidth,available),target)),maxWidth:'100%',flexGrow:span===12&&!customWidth?1:0},style]}>{children}</View>;
}

const s=StyleSheet.create({flow:{width:'100%',flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start',overflow:'hidden'}});
