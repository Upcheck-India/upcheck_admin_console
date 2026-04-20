'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Link2, Search, Filter, Trash2, Copy, Check, Globe, Lock, Users,
  Clock, ArrowLeft, ExternalLink, Calendar, Eye, Download, X
} from 'lucide-react';

export default function AllShareLinksPage() {
  const router = useRouter();
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, restricted, expiring, expired
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, views, expiring
  const [selectedShares, setSelectedShares] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchShares();
  }, []);

  const fetchShares = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/share/list');
      if (response.ok) {
        const data = await response.json();
        setShares(data);
      } else {
        setError('Failed to load share links');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (token) => {
    if (!confirm('Are you sure you want to delete this share link?')) return;

    try {
      const response = await fetch(`/api/share/${token}`, { method: 'DELETE' });
      if (response.ok) {
        fetchShares();
      } else {
        alert('Failed to delete share link');
      }
    } catch (err) {
      alert('Error deleting share link');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedShares.length} selected share links?`)) return;

    try {
      await Promise.all(
        selectedShares.map(token =>
          fetch(`/api/share/${token}`, { method: 'DELETE' })
        )
      );
      setSelectedShares([]);
      fetchShares();
    } catch (err) {
      alert('Error bulk deleting');
    }
  };

  const handleCopyLink = async (token) => {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSelect = (token) => {
    setSelectedShares(prev =>
      prev.includes(token)
        ? prev.filter(t => t !== token)
        : [...prev, token]
    );
  };

  const toggleSelectAll = () => {
    if (selectedShares.length === filteredShares.length) {
      setSelectedShares([]);
    } else {
      setSelectedShares(filteredShares.map(s => s.token));
    }
  };

  // Filter and sort shares
  const filteredShares = shares.filter(share => {
    // Search filter
    if (searchQuery && !share.resourceName?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Status filter
    const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();
    const isExpiring = share.expiresAt && new Date(share.expiresAt) > new Date() &&
      new Date(share.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case 'active':
        return share.active && !isExpired && share.isPublic;
      case 'restricted':
        return share.active && !share.isPublic && share.allowedMembers?.length > 0;
      case 'expiring':
        return share.active && isExpiring;
      case 'expired':
        return isExpired || !share.active;
      default:
        return true;
    }
  }).sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'oldest':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'expiring':
        if (!a.expiresAt) return 1;
        if (!b.expiresAt) return -1;
        return new Date(a.expiresAt) - new Date(b.expiresAt);
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading share links...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Link2 className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/documentation')}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/documentation')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">All Share Links</h1>
                <p className="text-sm text-gray-500">Manage all shared resources across projects</p>
              </div>
            </div>
            <Link
              href="/documentation"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Documentation
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by resource name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
              >
                <option value="all">All Links</option>
                <option value="active">Active Public</option>
                <option value="restricted">Restricted</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired/Inactive</option>
              </select>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="views">Most Views</option>
              <option value="expiring">Expiring Soon</option>
            </select>

            {/* Bulk Delete */}
            {selectedShares.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete {selectedShares.length}
              </button>
            )}
          </div>
        </div>

        {/* Share Links List */}
        {filteredShares.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Share Links Found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'Try adjusting your search or filter' : 'Create your first share link from within a project'}
            </p>
            <Link
              href="/documentation"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              Browse Projects
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedShares.length === filteredShares.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Resource</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Access</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stats</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredShares.map((share) => {
                    const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();
                    const isExpiring = share.expiresAt && new Date(share.expiresAt) > new Date() &&
                      new Date(share.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                    return (
                      <tr key={share._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedShares.includes(share.token)}
                            onChange={() => toggleSelect(share.token)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                              <Link2 className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate max-w-xs">{share.resourceName}</p>
                              <p className="text-sm text-gray-500">By {share.createdBy?.username || 'Unknown'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {share.isPublic ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                <Globe className="w-3 h-3" />
                                Public
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
                                <Users className="w-3 h-3" />
                                Restricted
                              </span>
                            )}
                            {share.requirePassword && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                                <Lock className="w-3 h-3" />
                                Password
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5 text-gray-400" />
                              {share.views || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Download className="w-3.5 h-3.5 text-gray-400" />
                              {share.downloads || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {share.expiresAt ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span className={`text-sm ${isExpired ? 'text-red-600' : isExpiring ? 'text-amber-600' : 'text-gray-600'}`}>
                                {new Date(share.expiresAt).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">
                            {new Date(share.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleCopyLink(share.token)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                              title="Copy link"
                            >
                              {copiedId === share.token ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <a
                              href={`/shared/${share.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                              title="Open link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDelete(share.token)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
          <p>Showing {filteredShares.length} of {shares.length} share links</p>
          {selectedShares.length > 0 && (
            <p>{selectedShares.length} selected</p>
          )}
        </div>
      </main>
    </div>
  );
}
