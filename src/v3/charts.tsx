import React, { useMemo } from 'react';
import { Animated, Modal, Pressable, ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

export type WealthPoint={label:string;invested:number;value:number;pnl:number;roi?:number;cumulativeDividend?:number;monthlyDividend?:number;monthlyContribution?:number};
type WealthStyle='area'|'line'|'smooth'|'step'|'bar'|'mixed'|'difference'|'growth'|'roi'|'dividend';
const WEALTH_STYLES:Array<{id:WealthStyle;label:string}>=[
  {id:'area',label:'資產區間'},{id:'line',label:'雙線比較'},{id:'smooth',label:'平滑趨勢'},{id:'step',label:'階梯成長'},
  {id:'bar',label:'群組柱狀'},{id:'mixed',label:'柱線混合'},{id:'difference',label:'投入差額'},{id:'growth',label:'資產成長'},
  {id:'roi',label:'報酬率'},{id:'dividend',label:'股息累積'},
];
const fmt=(n:number)=>Math.abs(n)>=10000?`${(n/10000).toFixed(Math.abs(n)>=100000?0:1)}萬`:Math.round(n).toLocaleString('zh-TW');
const fmtFull=(n:number)=>Number.isFinite(n)?n.toLocaleString('zh-TW',{maximumFractionDigits:2}):'0';
const smoothPath=(pts:Array<{x:number;y:number}>)=>{if(!pts.length)return '';if(pts.length===1)return `M ${pts[0].x} ${pts[0].y}`;let d=`M ${pts[0].x} ${pts[0].y}`;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],mx=(a.x+b.x)/2;d+=` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}return d};
const stepPath=(pts:Array<{x:number;y:number}>)=>pts.map((p,i)=>i===0?`M ${p.x} ${p.y}`:`H ${p.x} V ${p.y}`).join(' ');

function WealthPlot({data,height=190,style,interactive=false,zoom=1,onPick}:{data:WealthPoint[];height?:number;style:WealthStyle;interactive?:boolean;zoom?:number;onPick?:(p:WealthPoint)=>void}){
  const baseWidth=340,width=Math.max(baseWidth,Math.round(baseWidth*zoom)),pad=30,plotW=width-pad*2,plotH=Math.max(76,height-48);
  const values=style==='roi'?data.map(d=>Number(d.roi??(d.invested?d.pnl/d.invested*100:0))):style==='dividend'?data.map(d=>Number(d.cumulativeDividend??0)):data.flatMap(d=>[d.invested,d.value]);
  const minRaw=Math.min(0,...values),maxRaw=Math.max(1,...values),span=Math.max(1,maxRaw-minRaw),min=minRaw-span*.04,max=maxRaw+span*.08;
  const xFor=(i:number)=>pad+(data.length<=1?plotW/2:i/(data.length-1)*plotW); const yFor=(v:number)=>10+plotH-((v-min)/(max-min))*plotH;
  const pts=data.map((d,i)=>({x:xFor(i),yV:yFor(d.value),yI:yFor(d.invested),yR:yFor(Number(d.roi??(d.invested?d.pnl/d.invested*100:0))),yD:yFor(Number(d.cumulativeDividend??0)),...d}));
  const line=(key:'yV'|'yI'|'yR'|'yD')=>pts.map((p,i)=>`${i?'L':'M'} ${p.x} ${p[key]}`).join(' ');
  const smooth=(key:'yV'|'yI')=>smoothPath(pts.map(p=>({x:p.x,y:p[key]}))); const step=(key:'yV'|'yI')=>stepPath(pts.map(p=>({x:p.x,y:p[key]})));
  const valuePath=line('yV'),investPath=line('yI'); const area=pts.length?`${valuePath} ${[...pts].reverse().map(p=>`L ${p.x} ${p.yI}`).join(' ')} Z`:'';
  const barW=Math.max(3,Math.min(15,plotW/Math.max(1,data.length)/3));
  const pick=(e:any)=>{if(!interactive||!data.length||!onPick)return;const lx=Number(e?.nativeEvent?.locationX??0);const idx=Math.max(0,Math.min(data.length-1,Math.round(((lx-pad)/Math.max(1,plotW))*(data.length-1))));onPick(data[idx])};
  return <Pressable disabled={!interactive} onPress={pick} style={{width:interactive?width:'100%'}}>
    <Svg width={interactive?width:'100%'} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0,.25,.5,.75,1].map((r,i)=><Line key={i} x1={pad} x2={width-pad} y1={10+plotH*r} y2={10+plotH*r} stroke="rgba(255,255,255,.07)" strokeWidth="1"/>)}
      {style==='area'||style==='difference'?<Path d={area} fill={style==='difference'?'rgba(212,175,55,.14)':'rgba(76,201,240,.13)'}/>:null}
      {style==='bar'?pts.map((p,i)=><G key={`b-${i}`}><Rect x={p.x-barW-1} y={p.yI} width={barW} height={Math.max(1,10+plotH-p.yI)} rx={2} fill="#d4af37"/><Rect x={p.x+1} y={p.yV} width={barW} height={Math.max(1,10+plotH-p.yV)} rx={2} fill="#4cc9f0"/></G>):null}
      {style==='mixed'?pts.map((p,i)=><Rect key={`m-${i}`} x={p.x-barW/2} y={p.yI} width={barW} height={Math.max(1,10+plotH-p.yI)} rx={2} fill="rgba(212,175,55,.72)"/>):null}
      {style==='line'||style==='area'||style==='difference'||style==='mixed'?<><Path d={investPath} fill="none" stroke="#d4af37" strokeWidth="2.1"/><Path d={valuePath} fill="none" stroke="#4cc9f0" strokeWidth="2.8"/></>:null}
      {style==='smooth'?<><Path d={smooth('yI')} fill="none" stroke="#d4af37" strokeWidth="2.1"/><Path d={smooth('yV')} fill="none" stroke="#4cc9f0" strokeWidth="2.8"/></>:null}
      {style==='step'?<><Path d={step('yI')} fill="none" stroke="#d4af37" strokeWidth="2.1"/><Path d={step('yV')} fill="none" stroke="#4cc9f0" strokeWidth="2.8"/></>:null}
      {style==='growth'?<Path d={valuePath} fill="none" stroke="#4cc9f0" strokeWidth="3.2"/>:null}
      {style==='roi'?<Path d={line('yR')} fill="none" stroke="#30d158" strokeWidth="3"/>:null}
      {style==='dividend'?<Path d={line('yD')} fill="none" stroke="#a78bfa" strokeWidth="3"/>:null}
      {(style!=='bar').valueOf()?pts.map((p,i)=><Circle key={`p-${i}`} cx={p.x} cy={style==='roi'?p.yR:style==='dividend'?p.yD:p.yV} r={interactive?4:2.8} fill="#f8fafc" stroke={style==='roi'?'#30d158':style==='dividend'?'#a78bfa':'#4cc9f0'} strokeWidth="1.8"/>):null}
      {pts.map((p,i)=>{const show=data.length<=8||i===0||i===data.length-1||i%Math.ceil(data.length/6)===0;return show?<SvgText key={`l-${i}`} x={p.x} y={height-7} fontSize="9" fill="rgba(255,255,255,.58)" textAnchor="middle">{p.label}</SvgText>:null})}
      <SvgText x="2" y="18" fontSize="8.5" fill="rgba(255,255,255,.45)">{style==='roi'?`${max.toFixed(1)}%`:fmt(max)}</SvgText>
    </Svg>
  </Pressable>
}

export function WealthAreaChart({data,detailData,height=190}:{data:WealthPoint[];detailData?:WealthPoint[];height?:number}){
  const [styleIdx,setStyleIdx]=React.useState(0),[open,setOpen]=React.useState(false),[zoom,setZoom]=React.useState(1.5),[selected,setSelected]=React.useState<WealthPoint|null>(null),tapRef=React.useRef<{at:number;timer:any}>({at:0,timer:null});
  const style=WEALTH_STYLES[styleIdx%WEALTH_STYLES.length]; const source=detailData?.length?detailData:data;
  const tap=()=>{const now=Date.now();if(now-tapRef.current.at<310){if(tapRef.current.timer)clearTimeout(tapRef.current.timer);tapRef.current.at=0;setSelected(null);setOpen(true);return}tapRef.current.at=now;tapRef.current.timer=setTimeout(()=>{setStyleIdx(i=>(i+1)%WEALTH_STYLES.length);tapRef.current.at=0},250)};
  React.useEffect(()=>()=>{if(tapRef.current.timer)clearTimeout(tapRef.current.timer)},[]);
  return <View style={styles.chartWrap}>
    <View style={styles.legendRow}><Legend dot="#4cc9f0" label="資產價值"/><Legend dot="#d4af37" label="累積投入"/><Text style={styles.chartHint}>單擊換樣式 · 雙擊放大</Text></View>
    <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel="試算圖表，單擊切換樣式，雙擊放大"><WealthPlot data={data} height={height} style={style.id}/></Pressable>
    <Text style={styles.styleLabel}>{style.label}</Text>
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}><View style={styles.zoomBackdrop}><View style={styles.zoomSheet}>
      <View style={styles.zoomHead}><View style={{flex:1}}><Text style={styles.zoomTitle}>付出 VS 未來資產</Text><Text style={styles.zoomSub}>{style.label} · 點資料點查看細部</Text></View><TouchableOpacity style={styles.zoomClose} onPress={()=>setOpen(false)}><Text style={styles.zoomCloseText}>離開</Text></TouchableOpacity></View>
      <View style={styles.zoomTools}><Text style={styles.zoomSub}>縮放 {Math.round(zoom*100)}%</Text><TouchableOpacity style={styles.zoomBtn} onPress={()=>setZoom(z=>Math.max(1,z-.25))}><Text style={styles.zoomBtnText}>－</Text></TouchableOpacity><TouchableOpacity style={styles.zoomBtn} onPress={()=>setZoom(z=>Math.min(4,z+.25))}><Text style={styles.zoomBtnText}>＋</Text></TouchableOpacity></View>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{paddingRight:24}}><WealthPlot data={source} height={270} style={style.id} interactive zoom={zoom} onPick={setSelected}/></ScrollView>
      {selected?<View style={styles.detailBox}><Text style={styles.detailTitle}>{selected.label}</Text><Text style={styles.detailText}>累積投入　{fmtFull(selected.invested)}</Text><Text style={styles.detailText}>預估資產　{fmtFull(selected.value)}</Text><Text style={styles.detailText}>累積損益　{selected.pnl>=0?'+':''}{fmtFull(selected.pnl)}</Text><Text style={styles.detailText}>累積報酬　{Number(selected.roi??(selected.invested?selected.pnl/selected.invested*100:0)).toFixed(2)}%</Text>{selected.monthlyContribution!=null?<Text style={styles.detailText}>當期投入　{fmtFull(selected.monthlyContribution)}</Text>:null}{selected.monthlyDividend!=null?<Text style={styles.detailText}>當期股息　{fmtFull(selected.monthlyDividend)}</Text>:null}{selected.cumulativeDividend!=null?<Text style={styles.detailText}>累積股息　{fmtFull(selected.cumulativeDividend)}</Text>:null}</View>:<Text style={styles.zoomHelp}>左右拖曳檢視時間軸；使用 ＋ / － 放大縮小；點擊圖上資料點顯示數值。</Text>}
    </View></View></Modal>
  </View>
}
export function DonutChart({items,centerLabel,centerValue}:{items:Array<{label:string;value:number}>;centerLabel:string;centerValue:string}){
  const size=174,r=58,c=2*Math.PI*r,total=Math.max(1,items.reduce((s,x)=>s+x.value,0));
  const colors=['#4cc9f0','#30d158','#ff4d8d','#d4af37','#7c3aed','#94a3b8']; let acc=0;
  return <View style={styles.donutRow}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G rotation="-90" origin={`${size/2},${size/2}`}>
        {items.map((it,i)=>{const len=c*(it.value/total),off=-c*acc/total;acc+=it.value;return <Circle key={it.label} cx={size/2} cy={size/2} r={r} fill="transparent" stroke={colors[i%colors.length]} strokeWidth="22" strokeDasharray={`${len} ${c-len}`} strokeDashoffset={off} strokeLinecap="round"/>})}
      </G>
      <SvgText x={size/2} y={size/2-4} fontSize="10" fill="rgba(255,255,255,.55)" textAnchor="middle">{centerLabel}</SvgText>
      <SvgText x={size/2} y={size/2+17} fontSize="16" fontWeight="800" fill="#fff" textAnchor="middle">{centerValue}</SvgText>
    </Svg>
    <View style={{flex:1,gap:8}}>{items.map((it,i)=><View key={it.label} style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:colors[i%colors.length]}]}/><Text style={styles.legendText}>{it.label}</Text><Text style={styles.legendValue}>{(it.value/total*100).toFixed(1)}%</Text></View>)}</View>
  </View>
}

export function StackedDividendBars({months}:{months:Array<{month:string;parts:Array<{symbol:string;amount:number}>}>}){
  const width=340,height=180,pad=24,plotH=126,barW=15,max=Math.max(1,...months.map(m=>m.parts.reduce((s,p)=>s+p.amount,0)))*1.1;
  const colors=['#4cc9f0','#30d158','#ff4d8d','#d4af37','#7c3aed'];
  return <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
    <Line x1={pad} x2={width-10} y1={plotH+12} y2={plotH+12} stroke="rgba(255,255,255,.14)"/>
    {months.map((m,i)=>{const x=pad+i*25;let y=plotH+12;return <G key={m.month}>{m.parts.map((p,j)=>{const h=Math.max(2,p.amount/max*plotH);y-=h;return <Rect key={p.symbol} x={x} y={y} width={barW} height={h} rx={4} fill={colors[j%colors.length]}/>})}<SvgText x={x+barW/2} y={height-16} fontSize="9" fill="rgba(255,255,255,.6)" textAnchor="middle">{m.month}</SvgText></G>})}
  </Svg>
}

export function PremiumGauge({value}:{value:number}){
  const min=-2,max=2,clamped=Math.max(min,Math.min(max,value)); const ratio=(clamped-min)/(max-min); const angle=-180+ratio*180; const cx=120,cy=102,r=76; const rad=angle*Math.PI/180; const x=cx+Math.cos(rad)*58,y=cy+Math.sin(rad)*58;
  return <View style={{alignItems:'center'}}><Svg width="240" height="132" viewBox="0 0 240 132">
    <Path d="M 44 102 A 76 76 0 0 1 196 102" fill="none" stroke="#30d158" strokeWidth="15" strokeLinecap="round"/>
    <Path d="M 120 26 A 76 76 0 0 1 196 102" fill="none" stroke="#ff453a" strokeWidth="15" strokeLinecap="round"/>
    <Line x1={cx} y1={cy} x2={x} y2={y} stroke="#fff" strokeWidth="3"/>
    <Circle cx={cx} cy={cy} r="6" fill="#d4af37"/>
    <SvgText x="34" y="126" fontSize="10" fill="#30d158">-2%</SvgText><SvgText x="120" y="126" fontSize="10" fill="#fff" textAnchor="middle">0%</SvgText><SvgText x="206" y="126" fontSize="10" fill="#ff453a" textAnchor="end">+2%</SvgText>
  </Svg><Text style={[styles.gaugeValue,{color:value>=1?'#ff6b61':value<=-0.5?'#30d158':'#fff'}]}>{value>=0?'+':''}{value.toFixed(2)}%</Text></View>
}

export function LifestyleGauge({icon='↗',label,current,target,showPercent=true,showAmounts=true,fontScale=100,radius=10,opacity=100,animation='none',accentColor='#4cc9f0',textColor='#fff',trackColor='rgba(255,255,255,.12)'}:{icon?:string;label:string;current:number;target:number;showPercent?:boolean;showAmounts?:boolean;fontScale?:number;radius?:number;opacity?:number;animation?:'none'|'pulse'|'shimmer';accentColor?:string;textColor?:string;trackColor?:string}){
  const ratio=Math.max(0,Math.min(1,current/Math.max(1,target))),scale=Math.max(.75,Math.min(1.5,fontScale/100));
  const pulse=React.useRef(new Animated.Value(1)).current;
  React.useEffect(()=>{pulse.stopAnimation();pulse.setValue(1);if(animation==='none')return;const loop=Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:animation==='pulse'?.65:.78,duration:animation==='pulse'?650:900,useNativeDriver:true}),Animated.timing(pulse,{toValue:1,duration:animation==='pulse'?650:900,useNativeDriver:true})]));loop.start();return()=>loop.stop()},[animation,pulse]);
  return <View style={[styles.lifeRow,{opacity:Math.max(.25,Math.min(1,opacity/100))}]}><Text style={[styles.lifeIcon,{fontSize:25*scale,color:accentColor}]}>{icon}</Text><View style={{flex:1}}><View style={styles.lifeTop}><Text style={[styles.lifeLabel,{fontSize:13*scale,color:textColor}]}>{label}</Text>{showPercent?<Text style={[styles.lifePct,{fontSize:12*scale,color:accentColor}]}>{Math.round(ratio*100)}%</Text>:null}</View><View style={[styles.track,{borderRadius:radius,height:Math.max(6,7*scale),backgroundColor:trackColor}]}><Animated.View style={[styles.fill,{width:`${ratio*100}%`,borderRadius:radius,backgroundColor:accentColor,opacity:pulse,transform:[{scaleY:animation==='pulse'?pulse.interpolate({inputRange:[.65,1],outputRange:[.82,1]}):1 as any}]}]} /></View>{showAmounts?<Text style={[styles.lifeSub,{fontSize:9*scale,color:textColor,opacity:.55}]}>{Math.round(current).toLocaleString('zh-TW')} / {Math.round(target).toLocaleString('zh-TW')}</Text>:null}</View></View>
}
function Legend({dot,label}:{dot:string;label:string}){return <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:dot}]}/><Text style={styles.legendText}>{label}</Text></View>}
const styles=StyleSheet.create({chartWrap:{width:'100%'},legendRow:{flexDirection:'row',gap:12,marginBottom:4},legendItem:{flexDirection:'row',alignItems:'center',gap:6},legendDot:{width:8,height:8,borderRadius:4},legendText:{color:'rgba(255,255,255,.68)',fontSize:10},legendValue:{marginLeft:'auto',color:'#fff',fontWeight:'700',fontSize:11},donutRow:{flexDirection:'row',alignItems:'center',gap:4},gaugeValue:{fontSize:26,fontWeight:'900',marginTop:-10,fontVariant:['tabular-nums']},lifeRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:9},lifeIcon:{fontSize:25},lifeTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},lifeLabel:{color:'#fff',fontSize:13,fontWeight:'700'},lifePct:{color:'#d4af37',fontSize:12,fontWeight:'800'},track:{height:7,borderRadius:7,backgroundColor:'rgba(255,255,255,.12)',marginTop:7,overflow:'hidden'},fill:{height:'100%',backgroundColor:'#4cc9f0',borderRadius:7},lifeSub:{fontSize:9,color:'rgba(255,255,255,.45)',marginTop:5},chartHint:{marginLeft:'auto',fontSize:9,color:'rgba(255,255,255,.4)'},styleLabel:{alignSelf:'flex-end',fontSize:9,color:'rgba(255,255,255,.46)',marginTop:-3},zoomBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.78)',justifyContent:'center',padding:12},zoomSheet:{maxHeight:'92%',backgroundColor:'#101a2a',borderRadius:16,borderWidth:1,borderColor:'rgba(255,255,255,.12)',padding:14},zoomHead:{flexDirection:'row',alignItems:'center',gap:10},zoomTitle:{color:'#fff',fontSize:18,fontWeight:'900'},zoomSub:{color:'rgba(255,255,255,.56)',fontSize:10,marginTop:2},zoomClose:{minWidth:58,minHeight:40,borderRadius:9,borderWidth:1,borderColor:'rgba(255,255,255,.2)',alignItems:'center',justifyContent:'center'},zoomCloseText:{color:'#fff',fontSize:12,fontWeight:'800'},zoomTools:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:8,marginTop:10,marginBottom:5},zoomBtn:{width:40,height:36,borderRadius:9,backgroundColor:'rgba(255,255,255,.08)',alignItems:'center',justifyContent:'center'},zoomBtnText:{color:'#fff',fontSize:20,fontWeight:'800'},detailBox:{marginTop:10,borderRadius:12,backgroundColor:'rgba(255,255,255,.06)',padding:12,gap:4},detailTitle:{color:'#f3d675',fontSize:13,fontWeight:'900'},detailText:{color:'#fff',fontSize:11,fontWeight:'600'},zoomHelp:{color:'rgba(255,255,255,.5)',fontSize:10,lineHeight:16,marginTop:8}});
