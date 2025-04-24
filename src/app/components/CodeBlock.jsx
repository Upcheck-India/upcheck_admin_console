'use client';

import { useState, useEffect } from 'react';
import { Check, Copy, Sun, Moon } from 'lucide-react';
import CodeOutput from './CodeOutput';
import { useTheme } from '../utils/ThemeContext';
import 'highlight.js/styles/github-dark.css';
import 'highlight.js/styles/github.css';
import hljs from 'highlight.js';

export default function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const [localTheme, setLocalTheme] = useState('light');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleThemeToggle = () => {
    const newTheme = localTheme === 'light' ? 'dark' : 'light';
    setLocalTheme(newTheme);
    toggleTheme();
  };

  const getHighlightedCode = () => {
    if (!language) return code;
    try {
      return hljs.highlight(code, { language: language.toLowerCase() }).value;
    } catch (e) {
      console.warn(`Failed to highlight for language: ${language}`);
      return code;
    }
  };

  return (
    <div className="relative group">
      <div className={`overflow-hidden rounded-lg transition-colors ${
        localTheme === 'dark' 
          ? 'bg-[#0d1117] border border-gray-700'
          : 'bg-white border border-gray-200'
      } p-4`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            {language && (
              <span className={`text-xs rounded px-2 py-1 ${
                localTheme === 'dark'
                  ? 'text-gray-300 bg-gray-800'
                  : 'text-gray-600 bg-gray-100'
              }`}>
                {language}
              </span>
            )}
            <button
              onClick={handleThemeToggle}
              className={`p-1 rounded transition-colors ${
                localTheme === 'dark'
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {localTheme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            onClick={copyToClipboard}
            className={`transition-colors ${
              localTheme === 'dark'
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
        <pre className={`text-sm sm:text-base overflow-x-auto ${
          localTheme === 'dark' ? 'hljs-dark' : 'hljs-light'
        }`}>
          <code 
            className={`language-${language} ${
              localTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
            }`}
            dangerouslySetInnerHTML={{ __html: getHighlightedCode() }}
          />
        </pre>
      </div>
      
      {[
        'python', 'javascript', 'java', 'js', 'py', 'typescript', 'ts',
        'kotlin', 'c', 'cpp', 'c++', 'cs', 'csharp', 'go', 'rust',
        'ruby', 'rb', 'perl', 'swift', 'dart', 'bash', 'sh',
        'sql', 'sqlite', 'sqlite3', 'basic', 'vb', 'fs', 'fsharp',
        'clojure', 'clj', 'coffee', 'crystal', 'cr', 'deno',
        'elixir', 'erlang', 'forth', 'fortran', 'f90', 'groovy',
        'haskell', 'hs', 'julia', 'jl', 'lisp', 'lua', 'nim',
        'ocaml', 'ml', 'pascal', 'php', 'prolog', 'racket',
        'raku', 'scala', 'smalltalk', 'st', 'zig', 'v'
      ].includes(language?.toLowerCase()) && (
        <CodeOutput code={code} language={language} theme={localTheme} />
      )}

      <style jsx global>{`
        .hljs-dark {
          color: #c9d1d9;
          background: #0d1117;
        }
        .hljs-light {
          color: #24292e;
          background: #ffffff;
        }
        
        .dark .hljs-section {
          color: #7ee787;
        }
        .dark .hljs-string {
          color: #a5d6ff;
        }
        .dark .hljs-keyword {
          color: #ff7b72;
        }
        .dark .hljs-title {
          color: #d2a8ff;
        }
        
        .light .hljs-section {
          color: #22863a;
        }
        .light .hljs-string {
          color: #032f62;
        }
        .light .hljs-keyword {
          color: #d73a49;
        }
        .light .hljs-title {
          color: #6f42c1;
        }
      `}</style>
    </div>
  );
}