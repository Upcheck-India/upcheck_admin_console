'use client';

import { useEffect, useState, useRef } from 'react';
import 'prismjs/themes/prism-tomorrow.css';
import { Check, Copy, FileCode, ChevronDown, ChevronUp } from 'lucide-react';

// Language display names mapping
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
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  sql: 'SQL',
  yaml: 'YAML',
  swift: 'Swift',
  kotlin: 'Kotlin',
  html: 'HTML',
  xml: 'XML',
  plaintext: 'Plain Text'
};

export default function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPrismLoaded, setIsPrismLoaded] = useState(false);
  const codeRef = useRef(null);
  const [codeHeight, setCodeHeight] = useState(0);
  
  // Try to detect language from first line if not provided
  const detectLanguage = (code) => {
    const firstLine = code.trim().split('\n')[0].toLowerCase();
    if (firstLine.includes('python')) return 'python';
    if (firstLine.includes('javascript') || firstLine.includes('js')) return 'javascript';
    if (firstLine.includes('typescript') || firstLine.includes('ts')) return 'typescript';
    if (firstLine.includes('jsx')) return 'jsx';
    if (firstLine.includes('tsx')) return 'tsx';
    if (firstLine.includes('java ') || firstLine.includes('.java')) return 'java';
    if (firstLine.includes('cpp') || firstLine.includes('c++')) return 'cpp';
    if (firstLine.includes('csharp') || firstLine.includes('c#')) return 'csharp';
    if (firstLine.includes('golang') || firstLine.includes('go ')) return 'go';
    if (firstLine.includes('rust')) return 'rust';
    if (firstLine.includes('ruby')) return 'ruby';
    if (firstLine.includes('php')) return 'php';
    if (firstLine.includes('sql')) return 'sql';
    if (firstLine.includes('yaml')) return 'yaml';
    if (firstLine.includes('swift')) return 'swift';
    if (firstLine.includes('kotlin')) return 'kotlin';
    if (firstLine.includes('bash') || firstLine.includes('shell')) return 'bash';
    if (firstLine.includes('json')) return 'json';
    if (firstLine.includes('css')) return 'css';
    if (firstLine.includes('markdown') || firstLine.includes('md')) return 'markdown';
    if (firstLine.includes('html')) return 'html';
    if (firstLine.includes('xml')) return 'xml';
    return 'plaintext';
  };

  const lang = language || detectLanguage(code);
  const displayName = languageNames[lang] || 'Code Block';
  const lines = code.split('\n').length;
  
  // Set a threshold for showing the expand button (15 lines)
  const LINE_HEIGHT = 24; // Estimated line height in pixels
  const COLLAPSED_HEIGHT = 350; // Max height when collapsed
  const shouldShowExpand = lines > 15;
  
  // Measure actual code height once it's rendered
  useEffect(() => {
    if (codeRef.current) {
      setCodeHeight(codeRef.current.scrollHeight);
    }
  }, [code, isPrismLoaded]);

  // Safer Prism loading approach
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Dynamic import of Prism and core languages
    const loadPrism = async () => {
      try {
        // Import Prism core first
        const Prism = await import('prismjs');
        
        // Set Prism to manual mode
        Prism.default.manual = true;
        
        // Import core languages in proper sequence (dependencies first)
        await import('prismjs/components/prism-markup'); // HTML/XML (many depend on this)
        await import('prismjs/components/prism-css');
        await import('prismjs/components/prism-javascript');
        
        // Only load additional languages based on detected/specified language
        if (['typescript', 'tsx'].includes(lang)) {
          await import('prismjs/components/prism-typescript');
        }
        
        if (['jsx', 'tsx'].includes(lang)) {
          await import('prismjs/components/prism-jsx');
        }
        
        if (lang === 'python') await import('prismjs/components/prism-python');
        if (lang === 'bash') await import('prismjs/components/prism-bash');
        if (lang === 'json') await import('prismjs/components/prism-json');
        if (lang === 'markdown') await import('prismjs/components/prism-markdown');
        if (lang === 'java') await import('prismjs/components/prism-java');
        if (lang === 'c') await import('prismjs/components/prism-c');
        if (lang === 'cpp') await import('prismjs/components/prism-cpp');
        if (lang === 'csharp') await import('prismjs/components/prism-csharp');
        if (lang === 'go') await import('prismjs/components/prism-go');
        if (lang === 'rust') await import('prismjs/components/prism-rust');
        if (lang === 'ruby') await import('prismjs/components/prism-ruby');
        if (lang === 'sql') await import('prismjs/components/prism-sql');
        if (lang === 'yaml') await import('prismjs/components/prism-yaml');
        if (lang === 'swift') await import('prismjs/components/prism-swift');
        if (lang === 'kotlin') await import('prismjs/components/prism-kotlin');
        
        // Special handling for PHP to avoid the error
        if (lang === 'php') {
          // First make sure its dependencies are loaded
          await import('prismjs/components/prism-markup-templating');
          await import('prismjs/components/prism-php');
        }
        
        setIsPrismLoaded(true);
      } catch (error) {
        console.error('Error loading Prism:', error);
        // Still mark as loaded so we can render code as plaintext
        setIsPrismLoaded(true);
      }
    };
    
    loadPrism();
  }, [lang]);

  // Highlight code after Prism is loaded
  useEffect(() => {
    if (!isPrismLoaded || !codeRef.current) return;
    
    try {
      const Prism = require('prismjs');
      
      // Map language to Prism's expected language name
      const prismLang = lang === 'html' || lang === 'xml' 
        ? 'markup' 
        : lang;
      
      // Check if language is supported
      const isLanguageSupported = Prism.languages[prismLang] !== undefined;
      
      // Apply highlighting
      if (isLanguageSupported) {
        requestAnimationFrame(() => {
          Prism.highlightElement(codeRef.current);
        });
      } else {
        // Fallback for unsupported languages
        codeRef.current.className = 'language-plaintext';
        codeRef.current.textContent = code;
      }
    } catch (error) {
      console.error('Prism highlighting error:', error);
      // Fallback to plaintext
      if (codeRef.current) {
        codeRef.current.className = 'language-plaintext';
        codeRef.current.textContent = code;
      }
    }
  }, [isPrismLoaded, code, lang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  // Toggle expand/collapse
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    
    // Scroll to the top of the code block when collapsing
    if (isExpanded) {
      codeRef.current?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="relative group rounded-lg overflow-hidden my-4 bg-gray-900 border border-gray-800">
      <div className="sticky top-0 z-10 bg-gray-800 px-3 py-2 flex justify-between items-center border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-gray-400" />
          <span className="text-gray-300 text-xs sm:text-sm font-mono flex items-center gap-2">
            {displayName}
            <span className="text-gray-500 text-xs">
              {lines} {lines === 1 ? 'line' : 'lines'}
            </span>
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-white text-xs sm:text-sm transition-colors flex items-center gap-1"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>
      </div>
      
      {/* Code container with conditional max height */}
      <div 
        className={`relative transition-all duration-300 ease-in-out overflow-hidden ${
          !isExpanded && shouldShowExpand ? 'max-h-80' : 'max-h-none'
        }`}
        style={{ 
          maxHeight: !isExpanded && shouldShowExpand ? `${COLLAPSED_HEIGHT}px` : 'none'
        }}
      >
        <pre className="!m-0 !p-0 overflow-visible">
          {/* This div provides the scrollable container */}
          <div className="overflow-x-auto p-3 sm:p-4 max-w-full">
            <code 
              ref={codeRef} 
              className={`language-${lang === 'html' || lang === 'xml' ? 'markup' : lang} block whitespace-pre`}
            >
              {code}
            </code>
          </div>
        </pre>
        
        {/* Gradient overlay when collapsed */}
        {!isExpanded && shouldShowExpand && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none"></div>
        )}
      </div>
      
      {/* Show expand/collapse button if code is long enough */}
      {shouldShowExpand && (
        <div className="flex justify-center py-2 bg-gray-900 border-t border-gray-800">
          <button
            onClick={toggleExpand}
            className="px-4 py-1 bg-gray-800 text-gray-300 rounded-full text-xs hover:bg-gray-700 transition-colors flex items-center gap-1"
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <>
                <span>Show less</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>Show more</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      )}
      
      <style jsx global>{`
        /* Custom scrollbar styling */
        pre::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        
        pre::-webkit-scrollbar-track {
          background: #1f2937;
          border-radius: 4px;
        }
        
        pre::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 4px;
        }
        
        pre::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
        
        /* Line number styling if needed */
        .line-numbers .line-numbers-rows {
          padding-left: 0.75rem;
        }
        
        /* Ensure code doesn't wrap and horizontal scrollbar appears */
        .language-markup,
        .language-javascript,
        .language-python,
        .language-jsx,
        .language-tsx,
        .language-typescript,
        .language-bash,
        .language-json,
        .language-css,
        .language-plaintext,
        .language-java,
        .language-c,
        .language-cpp,
        .language-csharp,
        .language-go,
        .language-rust,
        .language-ruby,
        .language-php,
        .language-sql,
        .language-yaml,
        .language-swift,
        .language-kotlin {
          white-space: pre !important;
          word-wrap: normal !important;
          overflow-x: auto !important;
        }
      `}</style>
    </div>
  );
}