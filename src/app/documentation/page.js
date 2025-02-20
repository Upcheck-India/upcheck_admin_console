// src/app/documentation/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function Documentation() {
  const { user, isLoading, isAuthenticated, hasPermission, authError } = useAuth(true, 'documents.manage');

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div>Access denied. Please log in.</div>;
  }

  if (!hasPermission) {
    return <div>Permission denied. You do not have the required permissions.</div>;
  }

  const [announcements, setAnnouncements] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
    fetchDocuments();
  }, []);

  const fetchAnnouncements = async () => {
    const response = await fetch('/api/announcements');
    const data = await response.json();
    setAnnouncements(data);
  };

  const fetchDocuments = async () => {
    const response = await fetch('/api/documents');
    const data = await response.json();
    setDocuments(data);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    const formData = new FormData();
    formData.append('file', uploadFile);

    setUploadLoading(true);
    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      setUploadLoading(false);
      setUploadFile(null);
      fetchDocuments();
    } else {
      setUploadLoading(false);
      alert('Failed to upload file');
    }
  };

  return (
    <div className="p-6">
      {/* Announcements Section */}
      <div className="mb-8">
        <h2 className="text-2xl mb-4">Announcements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {announcements.map(announcement => (
            <div key={announcement._id} className="bg-white p-4 rounded shadow">
              <h3 className="text-lg">{announcement.title}</h3>
              <p className="text-gray-600">{announcement.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Documents Section */}
      <div>
        <h2 className="text-2xl mb-4">Documents</h2>
        <div className="flex items-center mb-4">
          {user.role === 'Console admin' && (
            <form onSubmit={handleUpload} className="flex-1">
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="mr-2"
              />
              <button type="submit" disabled={uploadLoading}>
                {uploadLoading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map(doc => (
            <div key={doc._id} className="bg-white p-4 rounded shadow">
              <div className="flex justify-between">
                <span>{doc.filename}</span>
                <a href={`/api/documents/download/${doc._id}`} className="text-blue-500">
                  Download
                </a>
              </div>
              <p className="text-gray-600">
                Uploaded by: {doc.metadata.uploadedBy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}