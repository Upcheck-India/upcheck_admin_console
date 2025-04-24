'use client';

import { useState } from 'react';
import { Play, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

const getLanguageConfig = (language) => {
  const configs = {
    // JavaScript and TypeScript
    'js': { language: 'javascript', version: '18.15.0', file: 'main.js' },
    'javascript': { language: 'javascript', version: '18.15.0', file: 'main.js' },
    'ts': { language: 'typescript', version: '5.0.3', file: 'main.ts' },
    'typescript': { language: 'typescript', version: '5.0.3', file: 'main.ts' },
    'deno': { language: 'typescript', version: '1.32.3', file: 'main.ts' },
    'deno-js': { language: 'javascript', version: '1.32.3', file: 'main.js' },
    
    // Python
    'python': { language: 'python', version: '3.10.0', file: 'main.py' },
    'py': { language: 'python', version: '3.10.0', file: 'main.py' },
    'py2': { language: 'python2', version: '2.7.18', file: 'main.py' },
    
    // Java and Kotlin
    'java': { language: 'java', version: '15.0.2', file: 'Main.java' },
    'kotlin': { language: 'kotlin', version: '1.8.20', file: 'Main.kt' },
    
    // C-family
    'c': { language: 'c', version: '10.2.0', file: 'main.c' },
    'cpp': { language: 'cpp', version: '10.2.0', file: 'main.cpp' },
    'c++': { language: 'cpp', version: '10.2.0', file: 'main.cpp' },
    'cs': { language: 'csharp', version: '6.12.0', file: 'Main.cs' },
    'csharp': { language: 'csharp', version: '6.12.0', file: 'Main.cs' },
    'mono': { language: 'csharp', version: '6.12.0', file: 'Main.cs' },
    
    // .NET Languages
    'vb': { language: 'basic', version: '5.0.201', file: 'Main.vb' },
    'basic': { language: 'basic', version: '5.0.201', file: 'Main.vb' },
    'fs': { language: 'fsharp', version: '5.0.201', file: 'main.fs' },
    'fsharp': { language: 'fsharp', version: '5.0.201', file: 'main.fs' },
    
    // System Programming
    'go': { language: 'go', version: '1.16.2', file: 'main.go' },
    'rust': { language: 'rust', version: '1.68.2', file: 'main.rs' },
    'zig': { language: 'zig', version: '0.10.1', file: 'main.zig' },
    'v': { language: 'v', version: '0.3.3', file: 'main.v' },
    
    // Scripting Languages
    'rb': { language: 'ruby', version: '3.0.1', file: 'main.rb' },
    'ruby': { language: 'ruby', version: '3.0.1', file: 'main.rb' },
    'perl': { language: 'perl', version: '5.36.0', file: 'main.pl' },
    'swift': { language: 'swift', version: '5.3.3', file: 'main.swift' },
    'dart': { language: 'dart', version: '2.19.6', file: 'main.dart' },
    'php': { language: 'php', version: '8.2.3', file: 'main.php' },
    
    // Shell Scripting
    'sh': { language: 'bash', version: '5.2.0', file: 'main.sh' },
    'bash': { language: 'bash', version: '5.2.0', file: 'main.sh' },
    
    // Functional Languages
    'clojure': { language: 'clojure', version: '1.10.3', file: 'main.clj' },
    'clj': { language: 'clojure', version: '1.10.3', file: 'main.clj' },
    'elixir': { language: 'elixir', version: '1.11.3', file: 'main.exs' },
    'erlang': { language: 'erlang', version: '23.0.0', file: 'main.erl' },
    'haskell': { language: 'haskell', version: '9.0.1', file: 'main.hs' },
    'hs': { language: 'haskell', version: '9.0.1', file: 'main.hs' },
    'ocaml': { language: 'ocaml', version: '4.12.0', file: 'main.ml' },
    'ml': { language: 'ocaml', version: '4.12.0', file: 'main.ml' },
    
    // Other Languages
    'crystal': { language: 'crystal', version: '0.36.1', file: 'main.cr' },
    'cr': { language: 'crystal', version: '0.36.1', file: 'main.cr' },
    'coffee': { language: 'coffeescript', version: '2.5.1', file: 'main.coffee' },
    'julia': { language: 'julia', version: '1.8.5', file: 'main.jl' },
    'jl': { language: 'julia', version: '1.8.5', file: 'main.jl' },
    'lua': { language: 'lua', version: '5.4.4', file: 'main.lua' },
    'nim': { language: 'nim', version: '1.6.2', file: 'main.nim' },
    'pascal': { language: 'pascal', version: '3.2.2', file: 'main.pas' },
    'prolog': { language: 'prolog', version: '8.2.4', file: 'main.pl' },
    'racket': { language: 'racket', version: '8.3.0', file: 'main.rkt' },
    'raku': { language: 'raku', version: '6.100.0', file: 'main.raku' },
    'scala': { language: 'scala', version: '3.2.2', file: 'main.scala' },
    'sqlite': { language: 'sqlite3', version: '3.36.0', file: 'main.sql' },
    'sqlite3': { language: 'sqlite3', version: '3.36.0', file: 'main.sql' },
    'sql': { language: 'sqlite3', version: '3.36.0', file: 'main.sql' }
  };
  
  const config = configs[language?.toLowerCase()];
  
  if (!config) {
    const supportedLangs = Object.keys(configs)
      .filter(lang => !['js', 'py', 'cpp', 'rb', 'cs', 'sh', 'ts'].includes(lang))
      .sort();
    console.info('Supported languages:', supportedLangs.join(', '));
  }
  
  return config;
};

export default function CodeOutput({ code, language, theme = 'light' }) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);

  const executeCode = async () => {
    setIsExecuting(true);
    setError(null);
    setOutput(null);

    const config = getLanguageConfig(language);
    if (!config) {
      setError(`Language '${language}' is not supported for execution`);
      setIsExecuting(false);
      return;
    }

    try {
      let processedCode = code;
      
      // Language-specific code wrapping
      if (config.language === 'java' && !code.includes('class')) {
        processedCode = `
public class Main {
    public static void main(String[] args) {
${code.split('\n').map(line => '        ' + line).join('\n')}
    }
}`;
      } else if (config.language === 'kotlin' && !code.includes('fun main')) {
        processedCode = `fun main() {\n${code}\n}`;
      } else if ((config.language === 'c' || config.language === 'cpp') && !code.includes('main(')) {
        processedCode = `
#include <stdio.h>
int main() {
${code}
    return 0;
}`;
      } else if (config.language === 'csharp' && !code.includes('class')) {
        processedCode = `
using System;
public class Main {
    public static void Main() {
${code.split('\n').map(line => '        ' + line).join('\n')}
    }
}`;
      }

      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: config.language,
          version: config.version,
          files: [{
            name: config.file,
            content: processedCode
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to execute code: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.run.stderr && !data.run.stdout) {
        setError(data.run.stderr);
      } else {
        setOutput(data.run.stdout || data.run.output);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex justify-between items-center">
        <button
          onClick={executeCode}
          disabled={isExecuting}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            theme === 'dark'
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-blue-600 hover:opacity-90 text-white'
          }`}
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Run Code</span>
            </>
          )}
        </button>
      </div>

      {(output || error) && (
        <div className={`mt-2 rounded-lg border p-3 sm:p-4 text-sm font-mono whitespace-pre-wrap transition-colors ${
          error 
            ? theme === 'dark'
              ? 'bg-red-900/20 border-red-800 text-red-200'
              : 'bg-red-50 border-red-200 text-red-700'
            : theme === 'dark'
              ? 'bg-green-900/20 border-green-800 text-green-200'
              : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <div className="flex items-start gap-2">
            {error ? (
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-medium mb-1">
                {error ? 'Error' : 'Output'}:
              </div>
              <div className="text-xs sm:text-sm">
                {error || output}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}