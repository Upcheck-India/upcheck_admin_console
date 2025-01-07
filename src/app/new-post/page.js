"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, 
  Info,
  Languages,
  Hash,
  FolderTree,
  Globe,
} from 'lucide-react';
import ThumbnailUpload from '../components/ThumbnailUpload';
import { AlertMessage } from '../components/AlertMessage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs';
import { Tooltip } from '../components/Tooltip';

const languages = {
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu',
  bn: 'Bengali'
};

export default function NewPost() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('basic');
  const [errors, setErrors] = useState({});
  const [alertInfo, setAlertInfo] = useState(null);
  const [post, setPost] = useState({
    author: '',
    translations: {
      en: { title: '', content: '' },
      ta: { title: '', content: '' },
      hi: { title: '', content: '' },
      te: { title: '', content: '' },
      bn: { title: '', content: '' }
    },
    publishedAt: new Date().toISOString().split('T')[0],
    tags: [],
    categories: [],
    thumbnail: ''
  });

  const validateForm = () => {
    const newErrors = {};
    
    if (!post.author.trim()) {
      newErrors.author = 'Author is required';
    }
    
    if (!post.thumbnail) {
      newErrors.thumbnail = 'Thumbnail is required';
    }
    
    if (!post.translations.en.title.trim()) {
      newErrors.enTitle = 'English title is required';
    }
    if (!post.translations.en.content.trim()) {
      newErrors.enContent = 'English content is required';
    }
    
    if (post.categories.length === 0) {
      newErrors.categories = 'At least one category is required';
    }
    
    if (post.tags.length === 0) {
      newErrors.tags = 'At least one tag is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      const firstErrorTab = Object.keys(errors)[0];
      const tabMapping = {
        author: 'basic',
        thumbnail: 'basic',
        categories: 'basic',
        tags: 'basic',
        enTitle: 'en',
        enContent: 'en'
      };
      setActiveTab(tabMapping[firstErrorTab] || 'basic');
      setAlertInfo({
        type: 'error',
        message: 'Please fill in all required fields'
      });
      return;
    }

    try {
      setAlertInfo({ type: 'loading', message: 'Creating post...' });
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
      });

      if (!res.ok) throw new Error('Failed to create post');
      setAlertInfo({ type: 'success', message: 'Post created successfully!' });
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (error) {
      console.error('Error creating post:', error);
      setAlertInfo({
        type: 'error',
        message: 'Failed to create post. Please try again.'
      });
    }
  };

  const BasicInfoTab = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Author*
        </label>
        <input
          type="text"
          value={post.author}
          onChange={(e) => setPost({...post, author: e.target.value})}
          className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.author ? 'border-red-500' : ''
          }`}
        />
        {errors.author && (
          <p className="text-red-500 text-sm mt-1">{errors.author}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Thumbnail*
        </label>
        <ThumbnailUpload
          value={post.thumbnail}
          onChange={(url) => setPost({...post, thumbnail: url})}
        />
        {errors.thumbnail && (
          <p className="text-red-500 text-sm mt-1">{errors.thumbnail}</p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Tags* (comma-separated)
          </label>
          <Tooltip text="Tags are important keywords that make your post searchable. You can add as many relevant tags as needed to improve discoverability." />
        </div>
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="e.g., technology, programming, web-development"
            onChange={(e) => setPost({
              ...post,
              tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
            })}
            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.tags ? 'border-red-500' : ''
            }`}
          />
        </div>
        {errors.tags && (
          <p className="text-red-500 text-sm mt-1">{errors.tags}</p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Categories* (comma-separated)
          </label>
          <Tooltip text="Categories help organize your posts into broad topics. It's recommended to use only one or two categories per post for better organization." />
        </div>
        <div className="flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="e.g., tutorials, news"
            onChange={(e) => setPost({
              ...post,
              categories: e.target.value.split(',').map(category => category.trim()).filter(Boolean)
            })}
            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.categories ? 'border-red-500' : ''
            }`}
          />
        </div>
        {errors.categories && (
          <p className="text-red-500 text-sm mt-1">{errors.categories}</p>
        )}
      </div>
    </div>
  );

  const LanguageTab = ({ code, name }) => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title {code === 'en' && '*'}
        </label>
        <input
          type="text"
          value={post.translations[code].title}
          onChange={(e) => setPost({
            ...post,
            translations: {
              ...post.translations,
              [code]: {
                ...post.translations[code],
                title: e.target.value
              }
            }
          })}
          className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors[`${code}Title`] ? 'border-red-500' : ''
          }`}
        />
        {errors[`${code}Title`] && (
          <p className="text-red-500 text-sm mt-1">{errors[`${code}Title`]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content {code === 'en' && '*'}
        </label>
        <textarea
          value={post.translations[code].content}
          onChange={(e) => setPost({
            ...post,
            translations: {
              ...post.translations,
              [code]: {
                ...post.translations[code],
                content: e.target.value
              }
            }
          })}
          className={`w-full p-2 border rounded-lg h-48 focus:ring-2 focus:ring-blue-500 ${
            errors[`${code}Content`] ? 'border-red-500' : ''
          }`}
        />
        {errors[`${code}Content`] && (
          <p className="text-red-500 text-sm mt-1">{errors[`${code}Content`]}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create New Post</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          {alertInfo && (
            <AlertMessage
              type={alertInfo.type}
              message={alertInfo.message}
              onClose={() => setAlertInfo(null)}
            />
          )}

          <form onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList>
                <TabsTrigger value="basic" icon={Info}>Basic Info</TabsTrigger>
                {Object.entries(languages).map(([code, name]) => (
                  <TabsTrigger key={code} value={code} icon={Languages}>
                    {name}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="basic">
                <BasicInfoTab />
              </TabsContent>

              {Object.entries(languages).map(([code, name]) => (
                <TabsContent key={code} value={code}>
                  <LanguageTab code={code} name={name} />
                </TabsContent>
              ))}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Post
                </button>
              </div>
            </Tabs>
          </form>
        </div>
      </div>
    </div>
  );
}