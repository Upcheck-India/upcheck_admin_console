'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { detectHashTrigger, insertTaskMentionToken } from './taskMentions';

// Shared "#task" autocomplete state machine for the web console's DM/Team/
// Group composers. One implementation instead of three near-identical
// copies — each page just wires its textarea's onChange/selectionStart
// into handleComposerChange and renders <TaskMentionDropdown> when
// `query` is non-null.
export function useTaskMentionAutocomplete({ chatType, chatId }) {
  const [query, setQuery] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const cursorRef = useRef(0);
  const debounceRef = useRef(null);

  const handleComposerChange = useCallback((text, cursorPos) => {
    cursorRef.current = cursorPos;
    const trigger = detectHashTrigger(text, cursorPos);
    setQuery(trigger ? trigger.query : null);
  }, []);

  useEffect(() => {
    if (query === null) {
      setResults([]);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/chat-plugins/task-search?chatType=${chatType}&chatId=${encodeURIComponent(chatId)}&q=${encodeURIComponent(query)}`,
          { credentials: 'include' }
        );
        const data = await res.json();
        setResults(data.tasks || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, chatType, chatId]);

  const selectTask = useCallback((task, text) => {
    const { newText } = insertTaskMentionToken(text, cursorRef.current, task);
    setQuery(null);
    setResults([]);
    return newText;
  }, []);

  const close = useCallback(() => {
    setQuery(null);
    setResults([]);
  }, []);

  return { query, results, loading, handleComposerChange, selectTask, close };
}
