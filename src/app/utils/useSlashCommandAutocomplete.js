'use client';

import { useState, useEffect, useCallback } from 'react';
import { detectSlashTrigger } from './slashCommands';

// Shared "/" autocomplete state machine for the web console's DM/Team/
// Group composers. Unlike the "#task" mention hook, the full command list
// for a chat rarely changes mid-session, so it's fetched once per chat
// (chatType/chatId) rather than debounced per keystroke — filtering by the
// typed prefix happens client-side.
export function useSlashCommandAutocomplete({ chatType, chatId }) {
  const [allCommands, setAllCommands] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState(null);

  useEffect(() => {
    setAllCommands([]);
    setLoaded(false);
    if (!chatId) return;
    let active = true;
    fetch(`/api/chat-plugins/installed?chatType=${chatType}&chatId=${encodeURIComponent(chatId)}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        const commands = (data.installed || []).flatMap(plugin =>
          (plugin.commands || []).map(cmd => ({ ...cmd, pluginName: plugin.name, pluginIcon: plugin.icon }))
        );
        setAllCommands(commands);
      })
      .catch(() => { if (active) setAllCommands([]); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [chatType, chatId]);

  const handleComposerChange = useCallback((text) => {
    const trigger = detectSlashTrigger(text);
    setQuery(trigger ? trigger.query : null);
  }, []);

  const results = query === null
    ? []
    : allCommands.filter(c => c.name.toLowerCase().startsWith(query.toLowerCase()));

  const close = useCallback(() => setQuery(null), []);

  return { query, results, loading: query !== null && !loaded, handleComposerChange, close };
}
