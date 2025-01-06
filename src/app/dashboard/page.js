"use client";
import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, X, Eye, ChevronDown, Loader2, LogOut, User } from 'lucide-react';
import ThumbnailUpload from "../components/ThumbnailUpload";
import { useRouter } from 'next/navigation';
import { validatePost } from "../../utils/validatePost";

// Constants
const LANGUAGES = {
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu',
  bn: 'Bengali'
};

// Components
const LoadingState = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
  </div>
);

const AccountMenu = ({ onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
      >
        <User size={20} />
        <span>Account</span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
          <div className="px-4 py-2 text-sm text-gray-700 border-b">
            {username}
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

const PostCard = ({ post, onView, onEdit, onDelete }) => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
    <div className="p-6">
      <div className="mb-4">
        <img 
          src={post.thumbnail || '/placeholder-image.jpg'} 
          alt={post.translations.en.title}
          className="w-full h-48 object-cover rounded-md transition-transform duration-300 hover:scale-105"
        />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
        {post.translations.en.title}
      </h2>
      <p className="text-sm text-gray-500 mb-2">Author: {post.author}</p>
      <p className="text-sm text-gray-500 mb-4">Published: {post.publishedAt}</p>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {post.tags.map((tag, index) => (
          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
            {tag}
          </span>
        ))}
      </div>
      
      <div className="flex justify-end gap-2">
        <ActionButton onClick={() => onView(post)} icon={Eye} label="View" color="green" />
        <ActionButton onClick={() => onEdit(post.id)} icon={Pencil} label="Edit" color="blue" />
        <ActionButton onClick={() => onDelete(post.id)} icon={Trash2} label="Delete" color="red" />
      </div>
    </div>
  </div>
);

const ActionButton = ({ onClick, icon: Icon, label, color }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1 px-3 py-1 bg-${color}-50 text-${color}-600 rounded hover:bg-${color}-100 transition-colors duration-200`}
  >
    <Icon size={16} /> {label}
  </button>
);

const LanguageSelector = ({ selectedLanguage, onLanguageSelect, isOpen, onToggle }) => (
  <div className="relative">
    <button
      onClick={onToggle}
      className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors duration-200"
    >
      {LANGUAGES[selectedLanguage]} <ChevronDown size={16} />
    </button>
    {isOpen && (
      <div className="absolute top-full mt-1 bg-white border rounded-lg shadow-lg z-50">
        {Object.entries(LANGUAGES).map(([code, name]) => (
          <button
            key={code}
            onClick={() => onLanguageSelect(code)}
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors duration-200"
          >
            {name}
          </button>
        ))}
      </div>
    )}
  </div>
);

const ViewPostModal = ({ post, selectedLanguage, onClose, languageControls }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <LanguageSelector {...languageControls} />
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors duration-200">
            <X size={24} />
          </button>
        </div>
        <div className="space-y-4">
          <img 
            src={post.thumbnail} 
            alt="Post thumbnail" 
            className="w-full h-64 object-cover rounded-lg"
          />
          <h2 className="text-2xl font-bold">
            {post.translations[selectedLanguage].title}
          </h2>
          <div className="prose max-w-none" 
            dangerouslySetInnerHTML={{ __html: post.translations[selectedLanguage].content }} 
          />
        </div>
      </div>
    </div>
  </div>
);

const EditPostModal = ({ post, onUpdate, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Edit Post</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <EditPostForm post={post} onSubmit={onUpdate} onCancel={onClose} />
      </div>
    </div>
  </div>
);

const EditPostForm = ({ post, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(post);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <FormField
          label="Author"
          value={formData.author}
          onChange={(value) => setFormData({ ...formData, author: value })}
        />

        <div>
          <label className="block text-l font-medium text-gray-700 mb-1">
            Thumbnail
          </label>
          <ThumbnailUpload
            value={formData.thumbnail}
            onChange={(url) => setFormData({ ...formData, thumbnail: url })}
          />
        </div>

        {Object.entries(LANGUAGES).map(([code, name]) => (
          <LanguageSection
            key={code}
            code={code}
            name={name}
            translations={formData.translations}
            onChange={(translations) => setFormData({ ...formData, translations })}
          />
        ))}

        <TagsField
          value={formData.tags}
          onChange={(tags) => setFormData({ ...formData, tags })}
        />

        <CategoriesField
          value={formData.categories}
          onChange={(categories) => setFormData({ ...formData, categories })}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
};

const FormField = ({ label, value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const LanguageSection = ({ code, name, translations, onChange }) => (
  <div className="border-t pt-4">
    <h3 className="text-lg font-medium mb-4">{name}</h3>
    <div className="space-y-4">
      <FormField
        label="Title"
        value={translations[code].title}
        onChange={(value) => onChange({
          ...translations,
          [code]: { ...translations[code], title: value }
        })}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <textarea
          value={translations[code].content}
          onChange={(e) => onChange({
            ...translations,
            [code]: { ...translations[code], content: e.target.value }
          })}
          className="w-full p-2 border rounded-lg h-48 focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  </div>
);

const TagsField = ({ value, onChange }) => (
  <FormField
    label="Tags (comma-separated)"
    value={value.join(', ')}
    onChange={(value) => onChange(value.split(',').map(tag => tag.trim()))}
  />
);

const CategoriesField = ({ value, onChange }) => (
  <FormField
    label="Categories (comma-separated)"
    value={value.join(', ')}
    onChange={(value) => onChange(value.split(',').map(category => category.trim()))}
  />
);

// Main Dashboard Component
export default function Dashboard() {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingPost, setViewingPost] = useState(null);
    const [selectedPost, setSelectedPost] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
    const router = useRouter();
  
    useEffect(() => {
      fetchPosts();
    }, []);
  
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/posts');
        if (res.ok) {
          const data = await res.json();
          setPosts(data);
        }
      } finally {
        setIsLoading(false);
      }
    };
  
    const handleLogout = async () => {
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
          localStorage.removeItem('username');
          router.push('/login');
        }
      } catch (error) {
        console.error('Logout failed:', error);
      }
    };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPosts();
      }
    }
  };

  const handleEdit = async (id) => {
    const res = await fetch(`/api/posts/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedPost(data);
    }
  };

  const handleUpdate = async (updatedPost) => {
    const validatedPost = validatePost(updatedPost);
    if (JSON.stringify(validatedPost) !== JSON.stringify(updatedPost)) {
        if (!confirm('Some fields are empty. Would you like to proceed with default values?')) {
            return;
        }
    }
    
    try {
        const res = await fetch(`/api/posts/${updatedPost.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validatedPost)
        });
    
        if (res.ok) {
            setSelectedPost(null);
            fetchPosts();
        } else {
            console.error('Failed to update post');
        }
    } catch (error) {
        console.error('Error updating post:', error);
    }
};

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Posts Dashboard</h1>
          <div className="flex items-center space-x-4">
            <AccountMenu onLogout={handleLogout} />
            <button
              onClick={() => window.location.href = '/new-post'}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              New Post
            </button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onView={setViewingPost}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {viewingPost && (
          <ViewPostModal
            post={viewingPost}
            selectedLanguage={selectedLanguage}
            onClose={() => setViewingPost(null)}
            languageControls={{
              selectedLanguage,
              onLanguageSelect: (code) => {
                setSelectedLanguage(code);
                setIsLanguageDropdownOpen(false);
              },
              isOpen: isLanguageDropdownOpen,
              onToggle: () => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)
            }}
          />
        )}

        {selectedPost && (
          <EditPostModal
            post={selectedPost}
            onUpdate={handleUpdate}
            onClose={() => setSelectedPost(null)}
          />
        )}
      </div>
    </div>
  );
}