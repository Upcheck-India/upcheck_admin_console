'use client';

import { FileText, Download, Eye, Lock, MoreVertical, Clock } from 'lucide-react';

export default function DocumentList({ documents, viewMode, onDocumentClick }) {
  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function getFileIcon(mimeType) {
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('word')) return '📝';
    if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return '📊';
    if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return '📊';
    if (mimeType?.includes('image')) return '🖼️';
    if (mimeType?.includes('video')) return '🎥';
    return '📄';
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <div
            key={doc._id}
            className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">
                {getFileIcon(doc.mimeType)}
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => window.location.href = `/dataroom/documents/${doc._id}/view`}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-1 hover:bg-slate-100 rounded">
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
            <h3
              onClick={() => onDocumentClick(doc)}
              className="font-medium text-slate-900 mb-1 truncate cursor-pointer hover:text-blue-600"
              title={doc.name}
            >
              {doc.name}
            </h3>
            <p className="text-xs text-slate-500 mb-2">{doc.fileName}</p>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{formatFileSize(doc.fileSize)}</span>
              <span>v{doc.version}</span>
            </div>
            {doc.isLocked && (
              <div className="mt-2 flex items-center text-xs text-amber-600">
                <Lock className="w-3 h-3 mr-1" />
                <span>Locked</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // List view
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Size
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Version
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Modified
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {documents.map((doc) => (
            <tr
              key={doc._id}
              onClick={() => onDocumentClick(doc)}
              className="hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-lg">
                    {getFileIcon(doc.mimeType)}
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-slate-900">{doc.name}</div>
                    <div className="text-xs text-slate-500">{doc.fileName}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                {formatFileSize(doc.fileSize)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                v{doc.version}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                <div className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDate(doc.updatedAt)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  doc.state === 'published' ? 'bg-green-100 text-green-800' :
                  doc.state === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {doc.state}
                </span>
                {doc.isLocked && (
                  <Lock className="w-3 h-3 inline-block ml-2 text-amber-600" />
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/dataroom/documents/${doc._id}/view`;
                  }}
                  className="text-blue-600 hover:text-blue-900 mr-3"
                  title="View Document"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/api/dataroom/documents/${doc._id}/download`;
                  }}
                  className="text-slate-600 hover:text-slate-900"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
