// src/app/new-post/page.js
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import ThumbnailUpload from '../components/ThumbnailUpload';

const languages = {
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu',
  bn: 'Bengali'
};

export default function NewPost() {
  const router = useRouter();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
      });

      if (!res.ok) throw new Error('Failed to create post');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    }
  };

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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Author
                </label>
                <input
                  type="text"
                  value={post.author}
                  onChange={(e) => setPost({...post, author: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thumbnail URL
                </label>
                <ThumbnailUpload
                  value={post.thumbnail}
                  onChange={(url) => setPost({...post, thumbnail: url})}
                />
              </div>
            </div>

            {Object.entries(languages).map(([code, name]) => (
              <div key={code} className="border-t pt-4">
                <h2 className="text-lg font-medium mb-4">{name} Content</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
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
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required={code === 'en'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content
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
                      className="w-full p-2 border rounded-lg h-48 focus:ring-2 focus:ring-blue-500"
                      required={code === 'en'}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  onChange={(e) => setPost({
                    ...post,
                    tags: e.target.value.split(',').map(tag => tag.trim())
                  })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categories (comma-separated)
                </label>
                <input
                  type="text"
                  onChange={(e) => setPost({
                    ...post,
                    categories: e.target.value.split(',').map(category => category.trim())
                  })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

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
          </form>
        </div>
      </div>
    </div>
  );
}