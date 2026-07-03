// Client-safe mirror of the constants in src/lib/plugins/dispatch.js (which
// can't be imported directly from 'use client' pages since it pulls in the
// mongodb driver). Keep these two files in sync if the sender identity ever
// changes.
export const PLUGIN_SENDER_ID = '600000000000000000000002';
export const PLUGIN_SENDER_NAME = 'Upcheck Plugins';
