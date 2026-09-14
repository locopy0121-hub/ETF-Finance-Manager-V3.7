import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { TickerPreferences, V3Preferences } from './model';

type Item={id:string;text:string};
type Props={items:Item[];prefs:V3Preferences;onPress:()=>void};

export default function SmartTicker({items,prefs,onPress}:Props){
  const cfg=prefs.ticker; const {width}=useWindowDimensions(); const [index,setIndex]=useState(0);
  const v=useRef(new Animated.Value(0)).current; const safe=items.length?items:[];
  const item=safe[index%safe.length];
  useEffect(()=>{if(!safe.length)return;setIndex(i=>i%safe.length);const ms=Math.max(700,(Math.max(.2,cfg.speedSeconds)+Math.max(0,cfg.pauseSeconds))*1000);const t=setInterval(()=>setIndex(i=>(i+1)%safe.length),ms);return()=>clearInterval(t)},[safe.length,cfg.speedSeconds,cfg.pauseSeconds]);
  useEffect(()=>{v.stopAnimation();v.setValue(0);if(cfg.reduceMotion||cfg.animation==='center'||!cfg.enabled)return;const dur=Math.max(450,cfg.speedSeconds*1000),strength=Math.max(.1,Math.min(1,cfg.animationStrength/100));let a:Animated.CompositeAnimation;
    if(cfg.animation==='scroll'){v.setValue(cfg.direction==='right'?-1:1);a=Animated.loop(Animated.sequence([Animated.timing(v,{toValue:cfg.direction==='right'?1:-1,duration:dur,easing:Easing.linear,useNativeDriver:true}),Animated.delay(Math.max(0,cfg.pauseSeconds)*1000)]));}
    else if(cfg.animation==='pingpong'){a=Animated.loop(Animated.sequence([Animated.timing(v,{toValue:1,duration:dur/2,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),Animated.timing(v,{toValue:0,duration:dur/2,easing:Easing.inOut(Easing.ease),useNativeDriver:true})]));}
    else if(cfg.animation==='blink'){a=Animated.loop(Animated.sequence([Animated.timing(v,{toValue:1,duration:dur/3,useNativeDriver:true}),Animated.timing(v,{toValue:0,duration:dur/3,useNativeDriver:true})]));}
    else {a=Animated.loop(Animated.sequence([Animated.timing(v,{toValue:1,duration:dur/2,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),Animated.timing(v,{toValue:0,duration:dur/2,easing:Easing.inOut(Easing.ease),useNativeDriver:true})]));}
    a.start();return()=>a.stop();
  },[index,cfg.animation,cfg.reduceMotion,cfg.speedSeconds,cfg.direction,cfg.animationStrength,v]);
  const transform=useMemo(()=>{const s=Math.max(.1,Math.min(1,cfg.animationStrength/100));switch(cfg.animation){
    case'scroll':return [{translateX:v.interpolate({inputRange:[-1,1],outputRange:[-Math.max(180,width*.85),Math.max(180,width*.85)]})}];
    case'pingpong':return [{translateX:v.interpolate({inputRange:[0,1],outputRange:[-Math.min(70,width*.16)*s,Math.min(70,width*.16)*s]})}];
    case'jump':return [{translateY:v.interpolate({inputRange:[0,1],outputRange:[0,-8*s]})}];
    case'bounce':return [{translateY:v.interpolate({inputRange:[0,.5,1],outputRange:[0,-9*s,0]})}];
    case'pulse':case'scale':return [{scale:v.interpolate({inputRange:[0,1],outputRange:[1,1+.12*s]})}];
    case'wave':return [{translateY:v.interpolate({inputRange:[0,1],outputRange:[3*s,-3*s]})},{rotate:v.interpolate({inputRange:[0,1],outputRange:['-1deg','1deg']})}];
    default:return [];
  }},[cfg.animation,cfg.animationStrength,v,width]);
  if(!cfg.enabled||!item)return null; const opacity=cfg.animation==='blink'||cfg.animation==='fade'?v.interpolate({inputRange:[0,1],outputRange:[1,.28]}):1;
  return <TouchableOpacity activeOpacity={.9} onPress={onPress} style={[st.wrap,{borderRadius:cfg.radius,opacity:Math.max(.2,Math.min(1,cfg.opacity/100)),backgroundColor:cfg.followTheme?'rgba(16,28,45,.92)':cfg.backgroundColor??'rgba(16,28,45,.92)'}]}>
    <View style={st.clip}><Animated.View style={[st.inner,(cfg.animation==='scroll'||cfg.animation==='pingpong')&&{width:Math.max(900,width*3)},{opacity,transform}]}><Text numberOfLines={cfg.animation==='center'?2:1} style={[st.text,{fontSize:12*Math.max(.7,cfg.fontScale/100),fontWeight:cfg.fontWeight,color:cfg.followTheme?prefs.primaryTextColor:cfg.textColor??prefs.primaryTextColor,textAlign:cfg.animation==='center'?'center':'left'}]}>{item.text}</Text></Animated.View></View>
  </TouchableOpacity>
}
const st=StyleSheet.create({wrap:{minHeight:34,justifyContent:'center',overflow:'hidden',marginHorizontal:10,marginBottom:4,borderWidth:1,borderColor:'rgba(255,255,255,.08)'},clip:{overflow:'hidden',minHeight:30,justifyContent:'center'},inner:{minHeight:30,justifyContent:'center',paddingHorizontal:12},text:{fontVariant:['tabular-nums']}});
