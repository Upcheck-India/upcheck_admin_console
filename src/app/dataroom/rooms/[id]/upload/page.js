'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Upload, X, FileText, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

export default function UploadPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;

  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleChange(e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      addFiles(Array.from(e.target.files));
    }
  }

  function addFiles(newFiles) {
    const filesWithIds = newFiles.map((file, index) => ({
      id: Date.now() + index,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    setFiles([...files, ...filesWithIds]);
  }

  function removeFile(id) {
    setFiles(files.filter(f => f.id !== id));
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  async function handleUpload() {
    if (files.length === 0) return;

    setUploading(true);
    setUploadResults(null);

    try {
      // Single file upload
      if (files.length === 1) {
        const formData = new FormData();
        formData.append('file', files[0].file);
        formData.append('roomId', roomId);
        formData.append('documentType', 'general');

        const response = await fetch('/api/dataroom/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setUploadResults({
            total: 1,
            successful: [{ fileName: files[0].name, documentId: data._id }],
            failed: [],
          });
        } else {
          const error = await response.json();
          setUploadResults({
            total: 1,
            successful: [],
            failed: [{ fileName: files[0].name, error: error.error }],
          });
        }
      } else {
        // Bulk upload
        const formData = new FormData();
        files.forEach((fileItem) => {
          formData.append('files', fileItem.file);
        });
        formData.append('roomId', roomId);
        formData.append('documentType', 'general');

        const response = await fetch('/api/dataroom/documents/bulk-upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setUploadResults(data.results);
        } else {
          const error = await response.json();
          setUploadResults({
            total: files.length,
            successful: [],
            failed: files.map(f => ({ fileName: f.name, error: error.error })),
          });
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadResults({
        total: files.length,
        successful: [],
        failed: files.map(f => ({ fileName: f.name, error: 'Upload failed' })),
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/dataroom/rooms/${roomId}`)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Upload Documents</h1>
              <p className="text-sm text-slate-500">Upload files to your data room</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Results */}
        {uploadResults && (
          <div className="mb-6 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Upload Results</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-green-700">Successful</span>
                <span className="text-lg font-bold text-green-700">{uploadResults.successful.length}</span>
              </div>
              {uploadResults.failed.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-sm text-red-700">Failed</span>
                  <span className="text-lg font-bold text-red-700">{uploadResults.failed.length}</span>
                </div>
              )}
            </div>

            {uploadResults.failed.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-slate-700">Failed Uploads:</h4>
                {uploadResults.failed.map((fail, index) => (
                  <div key={index} className="flex items-start space-x-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{fail.fileName}</p>
                      <p className="text-red-600">{fail.error}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                // Force refresh and navigate back
                router.refresh();
                router.push(`/dataroom/rooms/${roomId}`);
              }}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Room
            </button>
          </div>
        )}

        {/* Drop Zone */}
        {!uploadResults && (
          <>
            <div
              className={`bg-white rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 hover:border-blue-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Drop files here or click to browse
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Supports PDF, Word, Excel, PowerPoint, images, videos (max 100MB)
              </p>
              <input
                type="file"
                multiple
                onChange={handleChange}
                className="hidden"
                id="file-upload"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.zip,.rar"
              />
              <label
                htmlFor="file-upload"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-block"
              >
                Select Files
              </label>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Selected Files ({files.length})
                </h3>
                <div className="space-y-3">
                  {files.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="w-8 h-8 text-blue-500" />
                        <div>
                          <p className="font-medium text-slate-900">{fileItem.name}</p>
                          <p className="text-sm text-slate-500">{formatFileSize(fileItem.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(fileItem.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Total size: {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setFiles([])}
                      className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Upload {files.length} {files.length === 1 ? 'File' : 'Files'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
