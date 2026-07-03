// Chat Plugins registry.
//
// A plugin is a plain object:
//   {
//     id: string,               // stable identifier, stored in chat_plugin_installs
//     name: string,             // display name
//     description: string,
//     icon: string,             // emoji, kept simple/cross-platform (web + RN)
//     commands: [
//       {
//         name: string,          // without the leading slash, e.g. 'tasks'
//         usage: string,         // e.g. '/tasks [@username]'
//         description: string,
//         handler: async (ctx) => string   // ctx: see dispatch.js; returns the
//                                           // plain-text response to post back
//                                           // into the chat
//       }
//     ]
//   }
//
// Plugins never call an LLM and never make network calls beyond MongoDB —
// every command is a deterministic query/response. This keeps the whole
// path fast (no streaming, single response message) and auditable (the
// same command with the same data always gives the same answer).
//
// To add a new plugin: create a folder under src/lib/plugins/<name>/ with
// an index.js exporting the plugin object (see projectManagement/index.js
// for a full example), then register it below. Nothing else in the app
// needs to change — the install API, RBAC gating, and slash-command
// dispatcher all work generically off this registry.

import projectManagementPlugin from './projectManagement/index.js';

const registry = new Map();

export function registerPlugin(plugin) {
  if (!plugin?.id) throw new Error('Plugin must have an id');
  registry.set(plugin.id, plugin);
}

export function getPlugin(pluginId) {
  return registry.get(pluginId) || null;
}

export function listPlugins() {
  return Array.from(registry.values()).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    icon: p.icon,
    commands: p.commands.map(c => ({ name: c.name, usage: c.usage, description: c.description })),
  }));
}

registerPlugin(projectManagementPlugin);
