import './src/services/backgroundCloseTask';
import React from 'react';
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './src/widgets/widgetTaskHandler';
import { MonitorProvider } from './src/context/MonitorContext';
import { MONITOR_TEMPLATES } from './src/v3/monitorTemplates';

function AppWithMonitorProvider() {
  return React.createElement(
    MonitorProvider,
    { templates: MONITOR_TEMPLATES },
    React.createElement(App),
  );
}

registerRootComponent(AppWithMonitorProvider);
registerWidgetTaskHandler(widgetTaskHandler);
