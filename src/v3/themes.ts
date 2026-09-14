import type { V3Preferences, OfficialThemeId, NavDisplayMode, CustomThemeSlot } from './model';
export type ThemeIconSet={home:string;ledger:string;portfolio:string;dividend:string;calculator:string;settings:string;pin:string;file:string;calendar:string;money:string;target:string;chart:string;news:string;warning:string;link:string};
export type ThemeTokens={
 id:OfficialThemeId;name:string;description:string;backgroundPreset:V3Preferences['backgroundPreset'];
 primaryTextColor:string;secondaryTextColor:string;accentColor:string;positiveColor:string;negativeColor:string;
 cardOpacity:number;cardRadius:number;overlayOpacity:number;navMode:NavDisplayMode;icons:ThemeIconSet;widgetBackgroundColor:string;
};

const iconLine:ThemeIconSet={home:'⌂',ledger:'▤',portfolio:'▣',dividend:'◫',calculator:'⌁',settings:'⚙',pin:'⌖',file:'▧',calendar:'▦',money:'＄',target:'◎',chart:'⌁',news:'▤',warning:'△',link:'↗'};
const iconSolid:ThemeIconSet={home:'◆',ledger:'▰',portfolio:'▦',dividend:'▣',calculator:'◈',settings:'✦',pin:'●',file:'■',calendar:'▦',money:'＄',target:'◉',chart:'▰',news:'▤',warning:'▲',link:'➜'};
const iconSoft:ThemeIconSet={home:'⌂',ledger:'✎',portfolio:'□',dividend:'♡',calculator:'∿',settings:'⚙',pin:'•',file:'▱',calendar:'▦',money:'$',target:'○',chart:'⌁',news:'≡',warning:'!',link:'↗'};

export const OFFICIAL_THEMES:ThemeTokens[]=[
 {id:'obsidianGold',name:'曜石黑金',description:'精品金融儀表板，黑金高對比。',backgroundPreset:'deepFinance',primaryTextColor:'#FFF8E7',secondaryTextColor:'#B8A989',accentColor:'#D4AF37',positiveColor:'#32D583',negativeColor:'#FF6B61',cardOpacity:86,cardRadius:6,overlayOpacity:30,navMode:'iconText',icons:iconLine,widgetBackgroundColor:'#11100D'},
 {id:'deepSeaTech',name:'深海科技藍',description:'深藍科技資料中心，強調即時資訊。',backgroundPreset:'tealCity',primaryTextColor:'#F2FBFF',secondaryTextColor:'#8FB7C8',accentColor:'#4CC9F0',positiveColor:'#35D399',negativeColor:'#FF6B6B',cardOpacity:84,cardRadius:8,overlayOpacity:32,navMode:'iconText',icons:iconSolid,widgetBackgroundColor:'#071827'},
 {id:'classicFinance',name:'經典金融藍',description:'專業券商感，資料辨識優先。',backgroundPreset:'glassTech',primaryTextColor:'#FFFFFF',secondaryTextColor:'#A9BDD0',accentColor:'#4DA3FF',positiveColor:'#28C76F',negativeColor:'#EA5455',cardOpacity:92,cardRadius:4,overlayOpacity:24,navMode:'text',icons:iconLine,widgetBackgroundColor:'#0A1A2A'},
 {id:'forestEye',name:'森林護眼綠',description:'墨綠低刺激，適合長時間查看。',backgroundPreset:'greenGrowth',primaryTextColor:'#F3FFF8',secondaryTextColor:'#A6C9B6',accentColor:'#4FD1A5',positiveColor:'#5BD6A2',negativeColor:'#FF7B72',cardOpacity:88,cardRadius:8,overlayOpacity:30,navMode:'iconText',icons:iconSoft,widgetBackgroundColor:'#0B1B16'},
 {id:'amethystNight',name:'紫晶夜色',description:'紫藍 AI 科技風。',backgroundPreset:'futureEarth',primaryTextColor:'#FAF7FF',secondaryTextColor:'#B9A8D5',accentColor:'#A78BFA',positiveColor:'#5EEAD4',negativeColor:'#FB7185',cardOpacity:84,cardRadius:8,overlayOpacity:34,navMode:'icon',icons:iconSolid,widgetBackgroundColor:'#171025'},
 {id:'sunriseOrange',name:'晨曦暖橙',description:'生活理財暖色調，適合帳務與目標。',backgroundPreset:'taipeiDawn',primaryTextColor:'#FFF8F0',secondaryTextColor:'#D5B79D',accentColor:'#FF9F43',positiveColor:'#38D39F',negativeColor:'#FF6B6B',cardOpacity:88,cardRadius:8,overlayOpacity:26,navMode:'iconText',icons:iconSoft,widgetBackgroundColor:'#27160B'},
 {id:'glacierLight',name:'冰川藍白',description:'明亮清爽，白天高亮度環境。',backgroundPreset:'mistyGrowth',primaryTextColor:'#F7FBFF',secondaryTextColor:'#A5BDCF',accentColor:'#67B7FF',positiveColor:'#30C78D',negativeColor:'#F05D5E',cardOpacity:80,cardRadius:6,overlayOpacity:18,navMode:'text',icons:iconLine,widgetBackgroundColor:'#E9F4FC'},
 {id:'mistMinimal',name:'霧灰極簡',description:'弱裝飾、低圓角、資訊密度優先。',backgroundPreset:'emeraldGlass',primaryTextColor:'#F6F7F8',secondaryTextColor:'#A3AAB3',accentColor:'#D1D5DB',positiveColor:'#6EE7B7',negativeColor:'#FDA4AF',cardOpacity:82,cardRadius:4,overlayOpacity:34,navMode:'text',icons:iconSoft,widgetBackgroundColor:'#151719'},
 {id:'copperRed',name:'曜石紅銅',description:'黑灰與銅紅，沉穩市場風格。',backgroundPreset:'goldenValley',primaryTextColor:'#FFF7F2',secondaryTextColor:'#C7A69A',accentColor:'#C9785A',positiveColor:'#55D6A8',negativeColor:'#FF6F61',cardOpacity:88,cardRadius:5,overlayOpacity:32,navMode:'iconText',icons:iconSolid,widgetBackgroundColor:'#20110D'},
 {id:'neonNight',name:'星夜霓虹',description:'V3.3.7 藍圖科技感，圖表與 Widget 高亮。',backgroundPreset:'neonCity',primaryTextColor:'#F7FAFF',secondaryTextColor:'#96A9C9',accentColor:'#00D4FF',positiveColor:'#4ADE80',negativeColor:'#FF5A7D',cardOpacity:78,cardRadius:8,overlayOpacity:38,navMode:'icon',icons:iconSolid,widgetBackgroundColor:'#070B1A'},
];

export function officialTheme(id?:string){return OFFICIAL_THEMES.find(x=>x.id===id)??OFFICIAL_THEMES[0];}
export function applyThemeTokens(prefs:V3Preferences,theme:ThemeTokens):Partial<V3Preferences>{return {themeId:theme.id,backgroundPreset:theme.backgroundPreset,primaryTextColor:theme.primaryTextColor,secondaryTextColor:theme.secondaryTextColor,accentColor:theme.accentColor,positiveColor:theme.positiveColor,negativeColor:theme.negativeColor,cardOpacity:theme.cardOpacity,cardRadius:theme.cardRadius,overlayOpacity:theme.overlayOpacity,navDisplayMode:theme.navMode};}
export function currentIcons(prefs:Pick<V3Preferences,'themeId'|'customThemes'>):ThemeIconSet{
 const custom=/^custom([1-5])$/.exec(String(prefs.themeId??''));
 if(custom){const slot=Number(custom[1]);const saved=prefs.customThemes?.find(x=>x.slot===slot);if(saved)return officialTheme(saved.baseThemeId).icons;}
 return officialTheme(String(prefs.themeId)).icons;
}

export function widgetAppearance(prefs:Pick<V3Preferences,'themeId'|'customThemes'|'primaryTextColor'|'secondaryTextColor'|'accentColor'|'positiveColor'|'negativeColor'|'iconDisplay'|'cardRadius'|'editorNodes'>){
 const custom=/^custom([1-5])$/.exec(String(prefs.themeId??''));
 const saved=custom?prefs.customThemes?.find(x=>x.slot===Number(custom[1])):undefined;
 const base=officialTheme(saved?.baseThemeId??String(prefs.themeId));
 const icons=currentIcons(prefs);
 return {widgetBackgroundColor:base.widgetBackgroundColor,widgetPrimaryTextColor:prefs.primaryTextColor,widgetSecondaryTextColor:prefs.secondaryTextColor,widgetAccentColor:prefs.accentColor,widgetPositiveColor:prefs.positiveColor,widgetNegativeColor:prefs.negativeColor,widgetIcon:icons.chart,showWidgetIcon:prefs.iconDisplay?.enabled!==false&&prefs.iconDisplay?.widget!==false,widgetRadius:Math.max(0,Math.min(18,Number(prefs.cardRadius??6))),universalNodes:prefs.editorNodes};
}
