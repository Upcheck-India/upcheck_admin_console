//fixed content box with more styling options
"use client";

import React, { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Info, Languages, Hash, FolderTree, Bold, Italic, AlignLeft, Pilcrow, List, ListOrdered, Minus, Underline, Link2, Copy, Undo2, Redo2 } from 'lucide-react';
import ThumbnailUpload from '../../components/ThumbnailUpload';
import SecureLoading from "../../components/SecureLoading";
import { useAuth } from '../../../hooks/useAuth';
import AuthorField from '../../components/AuthorField';

const LANGUAGES = {
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu',
  bn: 'Bengali'
};

const EditorToolbar = ({ onFormat }) => (
  <div className="flex gap-2 p-2 bg-gray-50 border-b rounded-t-lg">
    <button
      type="button"
      onClick={() => onFormat('strong')}
      className="p-2 hover:bg-gray-200 rounded"
      title="Bold"
    >
      <Bold className="h-4 w-4" />
    </button>
    <button
      type="button"
      onClick={() => onFormat('em')}
      className="p-2 hover:bg-gray-200 rounded"
      title="Italic"
    >
      <Italic className="h-4 w-4" />
    </button>
    <button
      type="button"
      onClick={() => onFormat('p')}
      className="p-2 hover:bg-gray-200 rounded"
      title="Paragraph"
    >
      <AlignLeft className="h-4 w-4" />
    </button>
    <button
      type="button"
      onClick={() => onFormat('br')}
      className="p-2 hover:bg-gray-200 rounded"
      title="Line Break"
    >
      <Pilcrow className="h-4 w-4" />
    </button>
  </div>
);

const RichTextEditor = ({ value, onChange, error }) => {
  const textareaRef = useRef(null);
  const [history, setHistory] = useState([value]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const updateValue = (newValue, addToHistory = true) => {
    onChange(newValue);
    if (addToHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      setHistory([...newHistory, newValue]);
      setHistoryIndex(newHistory.length);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      onChange(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      onChange(history[historyIndex + 1]);
    }
  };

  const getSelectionInfo = () => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const lines = selectedText.split('\n');
    return { start, end, selectedText, lines };
  };

  const insertText = (newText, start, end) => {
    const textarea = textareaRef.current;
    const newValue = value.substring(0, start) + newText + value.substring(end);
    updateValue(newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  };

  const formatText = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start, end, selectedText } = getSelectionInfo();
    
    // Special handling for tags that don't require selection
    if ((tag === 'hr' || tag === 'br') && start === end) {
      const tagText = tag === 'hr' ? '<hr>' : '<br>';
      insertText(tagText, start, end);
      return;
    }
    
    // Link handling
    if (tag === 'a' && selectedText) {
      const url = prompt('Enter URL:', 'https://');
      if (url) {
        insertText(`<a href="${url}">${selectedText}</a>`, start, end);
      }
      return;
    }

    if (start === end && !['hr', 'br'].includes(tag)) return;

    const prefix = `<${tag}>`;
    const suffix = `</${tag}>`;
    
    const isWrapped = value.substring(start - prefix.length, start) === prefix &&
                     value.substring(end, end + suffix.length) === suffix;

    if (isWrapped) {
      insertText(selectedText, start - prefix.length, end + suffix.length);
    } else {
      insertText(`${prefix}${selectedText}${suffix}`, start, end);
    }
  };

  const copyContent = () => {
    navigator.clipboard.writeText(value);
  };

  const removeAllTags = () => {
    const newValue = value.replace(/<[^>]+>/g, '');
    updateValue(newValue);
  };

  const formatButtons = [
    { icon: Bold, tag: 'strong', title: 'Bold' },
    { icon: Italic, tag: 'em', title: 'Italic' },
    { icon: Underline, tag: 'u', title: 'Underline' },
    { icon: Link2, tag: 'a', title: 'Link' },
    { icon: AlignLeft, tag: 'p', title: 'Paragraph' },
    { icon: Pilcrow, tag: 'br', title: 'Line Break' },
    { icon: List, tag: 'ul', title: 'Bullet List' },
    { icon: ListOrdered, tag: 'ol', title: 'Numbered List' },
    { icon: Minus, tag: 'hr', title: 'Horizontal Line' }
  ];

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      insertText('  ', e.target.selectionStart, e.target.selectionEnd);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 border-b">
        <div className="flex gap-2 mr-4">
          <button
            type="button"
            onClick={undo}
            disabled={historyIndex === 0}
            className="p-2 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className="p-2 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
        
        <div className="h-6 w-px bg-gray-300" />
        
        <div className="flex flex-wrap gap-2">
          {formatButtons.map(({ icon: Icon, tag, title }) => (
            <button
              key={tag}
              type="button"
              onClick={() => formatText(tag)}
              className="p-2 hover:bg-gray-200 rounded transition-colors"
              title={title}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        
        <div className="h-6 w-px bg-gray-300 ml-auto" />
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyContent}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Copy Content"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={removeAllTags}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Remove All Tags"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => updateValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`w-full p-3 min-h-[200px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : ''
        }`}
      />
    </div>
  );
};

const initialFormState = {
  author: '',
  translations: Object.keys(LANGUAGES).reduce((acc, lang) => ({
    ...acc,
    [lang]: { title: '', content: '' }
  }), {}),
  publishedAt: new Date().toISOString().split('T')[0],
  tags: '',
  categories: '',
  thumbnail: ''
};

export default function NewPost() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth(true);
  
  // Move all hooks to the top level, before any conditional returns
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleTranslationChange = useCallback((lang, field, value) => {
    setFormData(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [lang]: { ...prev.translations[lang], [field]: value }
      }
    }));
  }, []);

  // Authentication effect
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.author.trim()) newErrors.author = 'Required';
    if (!formData.thumbnail) newErrors.thumbnail = 'Required';
    if (!formData.categories.trim()) newErrors.categories = 'Required';
    if (!formData.tags.trim()) newErrors.tags = 'Required';
    if (!formData.translations.en.title.trim()) newErrors.enTitle = 'Required';
    if (!formData.translations.en.content.trim()) newErrors.enContent = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    try {
      setAlert({ type: 'info', message: 'Creating post...' });
      const postData = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        categories: formData.categories.split(',').map(c => c.trim()).filter(Boolean)
      };

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(postData)
      });

      if (!res.ok) throw new Error();
      setAlert({ type: 'success', message: 'Post created successfully!' });
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to create post. Please try again.'
      });
    }
  }, [formData, router, validateForm]);

  // Show loading state while checking authentication
  if (authLoading) {
    return <SecureLoading />;
  }

  // If not authenticated, return null (useEffect will handle redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h1 className="text-2xl font-bold">Create New Post</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {alert && (
          <div className={`mx-6 mt-6 p-4 rounded-lg ${
            alert.type === 'error' ? 'bg-red-50 text-red-600' :
            alert.type === 'success' ? 'bg-green-50 text-green-600' :
            'bg-blue-50 text-blue-600'
          }`}>
            {alert.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6 overflow-x-auto">
            <div className="flex space-x-2 min-w-max">
              <button
                type="button"
                onClick={() => setActiveTab('basic')}
                className={`flex items-center px-4 py-2 rounded-lg ${
                  activeTab === 'basic'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Info className="h-4 w-4 mr-2" /> Basic
              </button>
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActiveTab(code)}
                  className={`flex items-center px-4 py-2 rounded-lg ${
                    activeTab === code
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Languages className="h-4 w-4 mr-2" /> {name}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'basic' ? (
            <div className="space-y-6">
              <div>
              <AuthorField
  value={formData.author}
  onChange={(value) => handleInputChange('author', value)}
  error={errors.author}
/>
                </div>
  
                <div>
                  <label className="block text-sm font-medium mb-1">Thumbnail*</label>
                  <ThumbnailUpload
                    value={formData.thumbnail}
                    onChange={url => handleInputChange('thumbnail', url)}
                  />
                  {errors.thumbnail && (
                    <span className="text-red-500 text-sm">{errors.thumbnail}</span>
                  )}
                </div>
  
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tags* (comma-separated)
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={e => handleInputChange('tags', e.target.value)}
                      placeholder="technology, programming"
                      className={`w-full p-3 pl-10 rounded-lg border ${
                        errors.tags ? 'border-red-500' : 'border-gray-300'
                      } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none`}
                    />
                  </div>
                  {errors.tags && (
                    <span className="text-red-500 text-sm">{errors.tags}</span>
                  )}
                </div>
  
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Categories* (comma-separated)
                  </label>
                  <div className="relative">
                    <FolderTree className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.categories}
                      onChange={e => handleInputChange('categories', e.target.value)}
                      placeholder="tutorials, news"
                      className={`w-full p-3 pl-10 rounded-lg border ${
                        errors.categories ? 'border-red-500' : 'border-gray-300'
                      } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none`}
                    />
                  </div>
                  {errors.categories && (
                    <span className="text-red-500 text-sm">{errors.categories}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Title {activeTab === 'en' && '*'}
                  </label>
                  <input
                    type="text"
                    value={formData.translations[activeTab].title}
                    onChange={e => handleTranslationChange(activeTab, 'title', e.target.value)}
                    className={`w-full p-3 rounded-lg border ${
                      errors[`${activeTab}Title`] ? 'border-red-500' : 'border-gray-300'
                    } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none`}
                  />
                  {errors[`${activeTab}Title`] && (
                    <span className="text-red-500 text-sm">
                      {errors[`${activeTab}Title`]}
                    </span>
                  )}
                </div>
  
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Content {activeTab === 'en' && '*'}
                  </label>
                  <RichTextEditor
                    value={formData.translations[activeTab].content}
                    onChange={(value) => handleTranslationChange(activeTab, 'content', value)}
                    error={errors[`${activeTab}Content`]}
                  />
                  {errors[`${activeTab}Content`] && (
                    <span className="text-red-500 text-sm">
                      {errors[`${activeTab}Content`]}
                    </span>
                  )}
                </div>
              </div>
            )}
  
            <div className="flex justify-end space-x-4 mt-8">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create Post
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }