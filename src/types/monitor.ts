export type LayoutMode='NORMAL'|'MINI';
export type MiniLayoutType='SINGLE_ROW'|'DUAL_ROW'|'LIST'|'MINI_CARD'|'GRID';
export type PulseStatus='IDLE'|'REFRESHING'|'SUCCESS'|'ERROR'|'PAUSED';
export type ColorTargetType='PROFIT_LOSS'|'MARKET_QUOTE'|'GENERAL_TEXT';
export type QuoteStatus='UP'|'DOWN'|'FLAT'|'LIMIT_UP'|'LIMIT_DOWN';

export interface WindowRect{x:number;y:number;width:number;height:number;}

export interface MonitorLayoutState{
 normalLayout:WindowRect;
 miniLayout:WindowRect;
 isMinimized:boolean;
}

export interface MonitorColorConfig{
 mode:'CUSTOM'|'THEME_GENERAL'|'THEME_PROFIT_LOSS';
 customColor?:string;
}

export interface TemplateModeConfig{
 displayFields:string[];
 fieldOrder:string[];
 maxDisplayCount:number;
 layoutType:MiniLayoutType;
 fontSize:number;
 textAlign:'left'|'center'|'right';
 itemSpacing:number;
 backgroundColor:string;
 opacity:number;
 borderRadius:number;
 borderWidth:number;
 borderColor:string;
}

export interface MonitorTemplateContract{
 id:string;
 name:string;
 isDefault:boolean;
 normalConfig:TemplateModeConfig;
 miniConfig:TemplateModeConfig;
 colorConfig:Record<string,MonitorColorConfig>;
}

export interface MonitorInstanceState extends MonitorLayoutState{
 instanceId:string;
 activeTemplateId:string;
}

export interface MonitorSnapshot{
 timestamp:number;
 marketStatus:'OPEN'|'CLOSED'|'PRE_MARKET'|'POST_MARKET';
 portfolioSummary:unknown;
 etfSummaries:Readonly<Record<string,unknown>>;
 rawQuotes:Readonly<Record<string,unknown>>;
}

export interface MonitorPersistedSettings extends MonitorLayoutState{
 activeTemplateId:string;
 templateOverrides:Record<string,Partial<MonitorTemplateContract>>;
 miniConfig:TemplateModeConfig;
 refreshInterval:number;
 colorSettings:Record<string,MonitorColorConfig>;
}

export const DEFAULT_NORMAL_LAYOUT:WindowRect={x:18,y:180,width:390,height:240};
export const DEFAULT_MINI_LAYOUT:WindowRect={x:18,y:180,width:180,height:72};
