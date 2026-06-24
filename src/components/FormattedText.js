import React from 'react';

export default function FormattedText({ text }) {
  if (!text) return null;

  // Regex to match bold (**text**), underline (__text__), italic (*text*), code (`text`), markdown link ([text](url)), and URLs (http/https)
  const regex = /(\*\*.*?\*\*|__.*?__|\[.*?\]\(https?:\/\/[^\s)]+\)|\*.*?\*|`.*?`|https?:\/\/[^\s]+)/g;
  const safeText = typeof text === 'string' ? text : '';
  const parts = safeText.split(regex);

  return (
    <span>
      {parts.map((part, index) => {
        if (!part) return null;
        
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        
        if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
          return <span key={index} className="underline">{part.slice(2, -2)}</span>;
        }
        
        if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
          const matchText = part.match(/\[(.*?)\]/);
          const matchUrl = part.match(/\((.*?)\)/);
          const linkText = matchText ? matchText[1] : 'Link';
          const linkUrl = matchUrl ? matchUrl[1] : '';
          return (
            <a 
              key={index} 
              href={linkUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 underline break-all"
            >
              {linkText}
            </a>
          );
        }
        
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
          return <em key={index} className="italic">{part.slice(1, -1)}</em>;
        }
        
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return <code key={index} className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-sm text-red-600">{part.slice(1, -1)}</code>;
        }
        
        if (part.startsWith('http://') || part.startsWith('https://')) {
          return (
            <a 
              key={index} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 underline break-all"
            >
              {part}
            </a>
          );
        }
        
        return part;
      })}
    </span>
  );
}
