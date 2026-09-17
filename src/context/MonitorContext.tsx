import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {monitorRefreshEngine,type SnapshotProducer} from '../engine/MonitorRefreshEngine';
import type {MonitorSnapshot,PulseStatus} from '../types/monitor';

interface MonitorContextValue{
 snapshot:MonitorSnapshot|null;
 pulseStatus:PulseStatus;
 refresh:()=>Promise<MonitorSnapshot|null>;
}

const MonitorContext=createContext<MonitorContextValue|undefined>(undefined);

export function MonitorProvider({producer,refreshSeconds,paused=false,children}:{producer:SnapshotProducer;refreshSeconds:number;paused?:boolean;children:React.ReactNode}){
 const[snapshot,setSnapshot]=useState<MonitorSnapshot|null>(null);
 const[pulseStatus,setPulseStatus]=useState<PulseStatus>('PAUSED');
 useEffect(()=>monitorRefreshEngine.subscribeSnapshot(setSnapshot),[]);
 useEffect(()=>monitorRefreshEngine.subscribeStatus(setPulseStatus),[]);
 useEffect(()=>{monitorRefreshEngine.configure(producer);},[producer]);
 useEffect(()=>{monitorRefreshEngine.setIntervalSeconds(refreshSeconds);},[refreshSeconds]);
 useEffect(()=>{if(paused)monitorRefreshEngine.stop();else monitorRefreshEngine.start();return()=>monitorRefreshEngine.stop();},[paused]);
 const value=useMemo<MonitorContextValue>(()=>({snapshot,pulseStatus,refresh:()=>monitorRefreshEngine.triggerManualRefresh()}),[snapshot,pulseStatus]);
 return <MonitorContext.Provider value={value}>{children}</MonitorContext.Provider>;
}

export function useMonitorSnapshot(){
 const value=useContext(MonitorContext);
 if(!value)throw new Error('useMonitorSnapshot must be used inside MonitorProvider');
 return value;
}
