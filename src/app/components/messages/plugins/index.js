'use client';

import ProjectManagementConfig from './ProjectManagementConfig';

// Client-side registry of per-plugin config editors, keyed by plugin id —
// mirrors the server-side plugin registry (src/lib/plugins/index.js) so
// adding a plugin's settings UI is a one-line addition here, not a change
// to PluginsPanel itself. Plugins with no entry here simply show no
// "Configure" affordance (most won't need one).
const CONFIG_EDITORS = {
  'project-management': ProjectManagementConfig,
};

export function getPluginConfigEditor(pluginId) {
  return CONFIG_EDITORS[pluginId] || null;
}
