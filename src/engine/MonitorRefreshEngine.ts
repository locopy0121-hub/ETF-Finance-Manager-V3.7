import type { MonitorSnapshot, PulseStatus } from '../types/monitor';

type SnapshotListener = (snapshot: Readonly<MonitorSnapshot>) => void;
type StatusListener = (status: PulseStatus) => void;
export type MonitorSnapshotFactory = () => Promise<MonitorSnapshot>;

const freezeSnapshot = (snapshot: MonitorSnapshot): Readonly<MonitorSnapshot> => Object.freeze({
  ...snapshot,
  portfolioSummary: Object.freeze({ ...snapshot.portfolioSummary }),
  etfSummaries: Object.freeze({ ...snapshot.etfSummaries }),
  rawQuotes: Object.freeze({ ...snapshot.rawQuotes }),
});

export class MonitorRefreshEngine {
  private static instance: MonitorRefreshEngine | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private intervalMs = 3000;
  private isRunning = false;
  private inFlight = false;
  private pulseStatus: PulseStatus = 'PAUSED';
  private snapshotFactory: MonitorSnapshotFactory | null = null;
  private snapshotListeners = new Set<SnapshotListener>();
  private statusListeners = new Set<StatusListener>();

  private constructor() {}

  public static getInstance(): MonitorRefreshEngine {
    if (!MonitorRefreshEngine.instance) MonitorRefreshEngine.instance = new MonitorRefreshEngine();
    return MonitorRefreshEngine.instance;
  }

  public configure(factory: MonitorSnapshotFactory): void {
    this.snapshotFactory = factory;
  }

  public setInterval(seconds: number): void {
    this.intervalMs = Math.max(1, Number.isFinite(seconds) ? seconds : 3) * 1000;
    if (this.isRunning) this.scheduleNext();
  }

  public getIntervalMs(): number { return this.intervalMs; }
  public getStatus(): PulseStatus { return this.pulseStatus; }
  public running(): boolean { return this.isRunning; }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.setStatus('IDLE');
    void this.refresh().finally(() => this.scheduleNext());
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.setStatus('PAUSED');
  }

  public async triggerManualRefresh(): Promise<void> {
    await this.refresh(true);
  }

  public async refresh(force = false): Promise<void> {
    if ((!this.isRunning && !force) || this.inFlight) return;
    if (!this.snapshotFactory) {
      this.setStatus('ERROR');
      throw new Error('[MonitorRefreshEngine] Snapshot factory is not configured');
    }

    this.inFlight = true;
    this.setStatus('REFRESHING');
    try {
      const snapshot = freezeSnapshot(await this.snapshotFactory());
      this.snapshotListeners.forEach(listener => listener(snapshot));
      this.setStatus('SUCCESS');
    } catch (error) {
      console.error('[MonitorRefreshEngine] Refresh failed:', error);
      this.setStatus('ERROR');
    } finally {
      this.inFlight = false;
    }
  }

  private scheduleNext(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.isRunning) return;
    this.timer = setTimeout(async () => {
      await this.refresh();
      this.scheduleNext();
    }, this.intervalMs);
  }

  private setStatus(status: PulseStatus): void {
    if (this.pulseStatus === status) return;
    this.pulseStatus = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  public subscribeSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    return () => { this.snapshotListeners.delete(listener); };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  }
}

export const monitorRefreshEngine = MonitorRefreshEngine.getInstance();
