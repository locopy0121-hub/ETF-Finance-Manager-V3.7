import type {MonitorSnapshot,PulseStatus} from '../types/monitor';

type SnapshotListener=(snapshot:MonitorSnapshot)=>void;
type StatusListener=(status:PulseStatus)=>void;
export type SnapshotProducer=()=>Promise<MonitorSnapshot>;

const freezeSnapshot=(snapshot:MonitorSnapshot):MonitorSnapshot=>Object.freeze({
 ...snapshot,
 etfSummaries:Object.freeze({...snapshot.etfSummaries}),
 rawQuotes:Object.freeze({...snapshot.rawQuotes}),
});

export class MonitorRefreshEngine{
 private timer:ReturnType<typeof setTimeout>|null=null;
 private intervalMs=3000;
 private running=false;
 private inFlight:Promise<MonitorSnapshot|null>|null=null;
 private producer:SnapshotProducer|null=null;
 private pulseStatus:PulseStatus='PAUSED';
 private snapshotListeners=new Set<SnapshotListener>();
 private statusListeners=new Set<StatusListener>();

 configure(producer:SnapshotProducer){this.producer=producer;return this;}
 getStatus(){return this.pulseStatus;}
 isRunning(){return this.running;}
 getIntervalSeconds(){return this.intervalMs/1000;}

 setIntervalSeconds(seconds:number){
  this.intervalMs=Math.max(1,Number.isFinite(seconds)?seconds:3)*1000;
  if(this.running)this.scheduleNext();
 }

 start(){
  if(this.running)return;
  this.running=true;
  this.setStatus('IDLE');
  void this.refresh();
 }

 stop(){
  this.running=false;
  if(this.timer){clearTimeout(this.timer);this.timer=null;}
  this.setStatus('PAUSED');
 }

 async triggerManualRefresh(){return this.refresh(true);}

 async refresh(manual=false):Promise<MonitorSnapshot|null>{
  if(!manual&&!this.running)return null;
  if(this.inFlight)return this.inFlight;
  if(!this.producer){this.setStatus('ERROR');return null;}
  if(this.timer){clearTimeout(this.timer);this.timer=null;}
  this.setStatus('REFRESHING');
  this.inFlight=(async()=>{
   try{
    const snapshot=freezeSnapshot(await this.producer!());
    this.snapshotListeners.forEach(listener=>listener(snapshot));
    this.setStatus('SUCCESS');
    return snapshot;
   }catch(error){
    console.error('[MonitorRefreshEngine] Refresh failed:',error);
    this.setStatus('ERROR');
    return null;
   }finally{
    this.inFlight=null;
    if(this.running)this.scheduleNext();
   }
  })();
  return this.inFlight;
 }

 private scheduleNext(){
  if(this.timer)clearTimeout(this.timer);
  if(!this.running)return;
  this.timer=setTimeout(()=>{void this.refresh();},this.intervalMs);
 }

 private setStatus(status:PulseStatus){
  this.pulseStatus=status;
  this.statusListeners.forEach(listener=>listener(status));
 }

 subscribeSnapshot(listener:SnapshotListener){this.snapshotListeners.add(listener);return()=>{this.snapshotListeners.delete(listener);};}
 subscribeStatus(listener:StatusListener){this.statusListeners.add(listener);return()=>{this.statusListeners.delete(listener);};}
}

export const monitorRefreshEngine=new MonitorRefreshEngine();
