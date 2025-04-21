'use client';

import { useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';

const languageNames = {
  javascript: 'JavaScript',
  python: 'Python',
  jsx: 'React JSX',
  tsx: 'React TSX',
  typescript: 'TypeScript',
  bash: 'Bash',
  json: 'JSON',
  css: 'CSS',
  markdown: 'Markdown',
};

export default function CodeBlock({ code, language }) {
  useEffect(() => {
    Prism.highlightAll();
  }, [code]);

  // Try to detect language from first line if not provided
  const detectLanguage = (code) => {
    const firstLine = code.trim().split('\n')[0].toLowerCase();
    if (firstLine.includes('python')) return 'python';
    if (firstLine.includes('javascript') || firstLine.includes('js')) return 'javascript';
    if (firstLine.includes('typescript') || firstLine.includes('ts')) return 'typescript';
    if (firstLine.includes('jsx')) return 'jsx';
    if (firstLine.includes('tsx')) return 'tsx';
    if (firstLine.includes('bash') || firstLine.includes('shell')) return 'bash';
    if (firstLine.includes('json')) return 'json';
    if (firstLine.includes('css')) return 'css';
    if (firstLine.includes('markdown') || firstLine.includes('md')) return 'markdown';
    return 'javascript'; // default to javascript
  };

  const lang = language || detectLanguage(code);
  const displayName = languageNames[lang] || 'Code Block';

  return (
    <div className="relative group rounded-lg overflow-hidden my-4">
      <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
        <span className="text-gray-300 text-sm font-mono">{displayName}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
          }}
          className="text-gray-400 hover:text-white text-sm transition-colors"
          title="Copy code"
        >
          Copy
        </button>
      </div>
      <pre className="!m-0 !bg-gray-900 !p-4 !rounded-t-none overflow-x-auto">
        <code className={`language-${lang}`}>{code}</code>
      </pre>
    </div>
  );
}