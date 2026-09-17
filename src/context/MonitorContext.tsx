import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { monitorRefreshEngine } from '../engine/MonitorRefreshEngine';
import { monitorStorageAdapter } from '../adapters/MonitorStorageAdapter';
import {
  DEFAULT_COLOR_SETTINGS,
  DEFAULT_MINI_LAYOUT,
  DEFAULT_NORMAL_LAYOUT,
  type LayoutMode,
  type MonitorInstanceState,
  type MonitorPersistedSettings,
  type MonitorSnapshot,
  type MonitorTemplate,
  type PulseStatus,
  type WindowRect,
} from '../types/monitor';

interface MonitorState {
  instance: MonitorInstanceState;
  templates: MonitorTemplate[];
  snapshot: Readonly<MonitorSnapshot> | null;
  pulseStatus: PulseStatus;
  refreshInterval: number;
}

type MonitorAction =
  | { type: 'SET_LAYOUT'; mode: LayoutMode; layout: WindowRect }
  | { type: 'SET_MINIMIZED'; minimized: boolean }
  | { type: 'RESTORE_NORMAL_LAYOUT' }
  | { type: 'APPLY_TEMPLATE'; templateId: string }
  | { type: 'SET_TEMPLATES'; templates: MonitorTemplate[] }
  | { type: 'RESET_TEMPLATE_TO_DEFAULT'; template: MonitorTemplate }
  | { type: 'SET_SNAPSHOT'; snapshot: Readonly<MonitorSnapshot> }
  | { type: 'SET_PULSE_STATUS'; status: PulseStatus }
  | { type: 'SET_REFRESH_INTERVAL'; seconds: number };

const defaultInstance: MonitorInstanceState = {
  instanceId: 'overlay-primary',
  activeTemplateId: 'mini-pnl',
  isMinimized: false,
  normalLayout: DEFAULT_NORMAL_LAYOUT,
  miniLayout: DEFAULT_MINI_LAYOUT,
};

const reducer = (state: MonitorState, action: MonitorAction): MonitorState => {
  switch (action.type) {
    case 'SET_LAYOUT':
      return {
        ...state,
        instance: action.mode === 'NORMAL'
          ? { ...state.instance, normalLayout: { ...action.layout } }
          : { ...state.instance, miniLayout: { ...action.layout } },
      };
    case 'SET_MINIMIZED': return { ...state, instance: { ...state.instance, isMinimized: action.minimized } };
    case 'RESTORE_NORMAL_LAYOUT': return { ...state, instance: { ...state.instance, isMinimized: false } };
    case 'APPLY_TEMPLATE': return { ...state, instance: { ...state.instance, activeTemplateId: action.templateId } };
    case 'SET_TEMPLATES': return { ...state, templates: action.templates };
    case 'RESET_TEMPLATE_TO_DEFAULT': return {
      ...state,
      templates: state.templates.map(template => template.id === action.template.id ? action.template : template),
    };
    case 'SET_SNAPSHOT': return { ...state, snapshot: action.snapshot };
    case 'SET_PULSE_STATUS': return { ...state, pulseStatus: action.status };
    case 'SET_REFRESH_INTERVAL': return { ...state, refreshInterval: Math.max(1, action.seconds) };
    default: return state;
  }
};

interface MonitorContextValue extends MonitorState {
  activeLayout: WindowRect;
  activeTemplate: MonitorTemplate | null;
  updateActiveLayout: (layout: WindowRect) => void;
  minimize: () => void;
  restoreNormalLayout: () => void;
  applyTemplate: (templateId: string) => void;
  resetTemplateToDefault: (template: MonitorTemplate) => void;
  setRefreshInterval: (seconds: number) => void;
  refreshNow: () => Promise<void>;
}

const MonitorContext = createContext<MonitorContextValue | null>(null);

export function MonitorProvider({ children, templates = [] }: React.PropsWithChildren<{ templates?: MonitorTemplate[] }>) {
  const [hydrated, setHydrated] = useState(false);
  const [state, dispatch] = useReducer(reducer, {
    instance: defaultInstance,
    templates,
    snapshot: null,
    pulseStatus: 'PAUSED',
    refreshInterval: 3,
  });

  useEffect(() => {
    let alive = true;
    void monitorStorageAdapter.load().then(saved => {
      if (!alive || !saved) return;
      dispatch({ type: 'SET_LAYOUT', mode: 'NORMAL', layout: saved.instance.normalLayout });
      dispatch({ type: 'SET_LAYOUT', mode: 'MINI', layout: saved.instance.miniLayout });
      dispatch({ type: 'SET_MINIMIZED', minimized: saved.instance.isMinimized });
      dispatch({ type: 'APPLY_TEMPLATE', templateId: saved.instance.activeTemplateId });
      dispatch({ type: 'SET_TEMPLATES', templates: saved.templates });
      dispatch({ type: 'SET_REFRESH_INTERVAL', seconds: saved.refreshInterval });
    }).finally(() => { if (alive) setHydrated(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => monitorRefreshEngine.subscribeSnapshot(snapshot => dispatch({ type: 'SET_SNAPSHOT', snapshot })), []);
  useEffect(() => monitorRefreshEngine.subscribeStatus(status => dispatch({ type: 'SET_PULSE_STATUS', status })), []);
  useEffect(() => { monitorRefreshEngine.setInterval(state.refreshInterval); }, [state.refreshInterval]);

  useEffect(() => {
    if (!hydrated) return;
    const activeTemplate = state.templates.find(t => t.id === state.instance.activeTemplateId) ?? state.templates[0];
    if (!activeTemplate) return;
    const persisted: MonitorPersistedSettings = {
      schemaVersion: 3,
      instance: state.instance,
      templates: state.templates,
      templateOverrides: {},
      miniConfig: activeTemplate.miniConfig,
      refreshInterval: state.refreshInterval,
      colorSettings: DEFAULT_COLOR_SETTINGS,
    };
    const timer = setTimeout(() => { void monitorStorageAdapter.save(persisted); }, 120);
    return () => clearTimeout(timer);
  }, [hydrated, state.instance, state.templates, state.refreshInterval]);

  const activeLayout = state.instance.isMinimized ? state.instance.miniLayout : state.instance.normalLayout;
  const activeTemplate = state.templates.find(t => t.id === state.instance.activeTemplateId) ?? null;
  const updateActiveLayout = useCallback((layout: WindowRect) => dispatch({ type: 'SET_LAYOUT', mode: state.instance.isMinimized ? 'MINI' : 'NORMAL', layout }), [state.instance.isMinimized]);
  const minimize = useCallback(() => dispatch({ type: 'SET_MINIMIZED', minimized: true }), []);
  const restoreNormalLayout = useCallback(() => dispatch({ type: 'RESTORE_NORMAL_LAYOUT' }), []);
  const applyTemplate = useCallback((templateId: string) => dispatch({ type: 'APPLY_TEMPLATE', templateId }), []);
  const resetTemplateToDefault = useCallback((template: MonitorTemplate) => dispatch({ type: 'RESET_TEMPLATE_TO_DEFAULT', template }), []);
  const setRefreshInterval = useCallback((seconds: number) => dispatch({ type: 'SET_REFRESH_INTERVAL', seconds }), []);
  const refreshNow = useCallback(() => monitorRefreshEngine.triggerManualRefresh(), []);

  const value = useMemo<MonitorContextValue>(() => ({
    ...state, activeLayout, activeTemplate, updateActiveLayout, minimize, restoreNormalLayout,
    applyTemplate, resetTemplateToDefault, setRefreshInterval, refreshNow,
  }), [state, activeLayout, activeTemplate, updateActiveLayout, minimize, restoreNormalLayout, applyTemplate, resetTemplateToDefault, setRefreshInterval, refreshNow]);

  return <MonitorContext.Provider value={value}>{children}</MonitorContext.Provider>;
}

export const useMonitor = (): MonitorContextValue => {
  const value = useContext(MonitorContext);
  if (!value) throw new Error('useMonitor must be used inside MonitorProvider');
  return value;
};
