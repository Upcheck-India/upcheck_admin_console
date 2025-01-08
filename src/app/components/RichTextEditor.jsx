import React, { useRef, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  AlignLeft, 
  List,
  Heading1,
  Heading2,
} from 'lucide-react';

const RichTextEditor = ({ value, onChange, error }) => {
  const editorRef = useRef(null);

  const insertTag = useCallback((startTag, endTag) => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = value.substring(start, end);
    
    // Check if selection is already wrapped in the tag
    const tagPattern = new RegExp(`^${startTag}.*${endTag}$`);
    if (tagPattern.test(selectedText)) {
      // Remove tags
      const newText = selectedText.replace(startTag, '').replace(endTag, '');
      const newValue = value.substring(0, start) + newText + value.substring(end);
      onChange(newValue);
      
      // Restore selection after state update
      setTimeout(() => {
        editor.focus();
        editor.setSelectionRange(start, start + newText.length);
      }, 0);
    } else {
      // Add tags
      const newText = startTag + selectedText + endTag;
      const newValue = value.substring(0, start) + newText + value.substring(end);
      onChange(newValue);
      
      // Restore selection after state update
      setTimeout(() => {
        editor.focus();
        editor.setSelectionRange(
          start + startTag.length,
          start + startTag.length + selectedText.length
        );
      }, 0);
    }
  }, [value, onChange]);

  const formatText = useCallback((format) => {
    switch (format) {
      case 'bold':
        insertTag('<strong>', '</strong>');
        break;
      case 'italic':
        insertTag('<em>', '</em>');
        break;
      case 'h1':
        insertTag('<h1>', '</h1>');
        break;
      case 'h2':
        insertTag('<h2>', '</h2>');
        break;
      case 'paragraph':
        insertTag('<p>', '</p>');
        break;
      case 'list':
        insertTag('<ul>\n  <li>', '</li>\n</ul>');
        break;
      default:
        break;
    }
  }, [insertTag]);

  const handleChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-1 p-1 bg-gray-50 border rounded-t-lg">
        <button
          type="button"
          onClick={() => formatText('bold')}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('italic')}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => formatText('h1')}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('h2')}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => formatText('paragraph')}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="Paragraph"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => formatText('list')}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title="List"
        >
          <List className="w-4 h-4" />
        </button>
      </div>
      <textarea
        ref={editorRef}
        value={value}
        onChange={handleChange}
        className={`w-full p-2 border rounded-b-lg h-48 focus:ring-2 focus:ring-blue-500 font-mono ${
          error ? 'border-red-500' : ''
        }`}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default RichTextEditor;