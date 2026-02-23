'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Folder,
  FileText,
  Upload,
  Download,
  Share2,
  Settings,
  ChevronRight,
  Grid,
  List,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Lock,
  Trash2,
  Edit,
  FolderPlus,
  ArrowLeft
} from 'lucide-react';
import FolderTree from '../../../components/dataroom/FolderTree';
import DocumentList from '../../../components/dataroom/DocumentList';
import DocumentDetailPanel from '../../../components/dataroom/DocumentDetailPanel';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;

  const [room, setRoom] = useState(null);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    if (roomId) {
      fetchRoom();
      fetchFolders();
      fetchDocuments();
    }
  }, [roomId, currentFolder]);

  async function fetchRoom() {
    try {
      const response = await fetch(`/api/dataroom/rooms/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setRoom(data);
      }
    } catch (error) {
      console.error('Failed to fetch room:', error);
    }
  }

  async function fetchFolders() {
    try {
      const url = `/api/dataroom/folders?roomId=${roomId}${currentFolder ? `&parentId=${currentFolder}` : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // API returns { items: [...] } not { folders: [...] }
        setFolders(data.items || data.folders || []);
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  }

  async function fetchDocuments() {
    try {
      const url = `/api/dataroom/documents?roomId=${roomId}${currentFolder ? `&folderId=${currentFolder}` : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // API returns { items: [...] } not { documents: [...] }
        setDocuments(data.items || data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFolderClick(folderId) {
    setCurrentFolder(folderId);
    // Update breadcrumbs logic here
  }

  function handleDocumentClick(document) {
    setSelectedDocument(document);
  }

  function handleUpload() {
    router.push(`/dataroom/rooms/${roomId}/upload`);
  }

  function handleCreateFolder() {
    // Open folder creation modal
    const folderName = prompt('Enter folder name:');
    if (folderName) {
      createFolder(folderName);
    }
  }

  async function createFolder(name) {
    try {
      const response = await fetch('/api/dataroom/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          roomId,
          parentId: currentFolder
        }),
      });
      if (response.ok) {
        await fetchFolders(); // Refresh folder list
        alert('Folder created successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder: ' + error.message);
    }
  }

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dataroom')}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">{room?.name}</h1>
                <p className="text-sm text-slate-500">{room?.description || 'Data room'}</p>
              </div>
              <button
                onClick={() => router.push(`/dataroom/rooms/${roomId}/nda`)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
                title="Sign NDA"
              >
                <FileText className="w-4 h-4" />
                <span>NDA</span>
              </button>
              <button
                onClick={() => router.push(`/dataroom/rooms/${roomId}/upload`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </button>
              <button
                onClick={() => router.push(`/dataroom/rooms/${roomId}/settings`)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center space-x-2 mt-3 text-sm">
            <button
              onClick={() => setCurrentFolder(null)}
              className="text-blue-600 hover:underline"
            >
              Root
            </button>
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center space-x-2">
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <button
                  onClick={() => setCurrentFolder(crumb.id)}
                  className="text-blue-600 hover:underline"
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Folder Tree */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-24">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Folders</h3>
              <FolderTree
                roomId={roomId}
                currentFolder={currentFolder}
                onFolderClick={handleFolderClick}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Toolbar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                    <Filter className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Folders Grid */}
            {folders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Folders</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {folders.map((folder) => (
                    <div
                      key={folder._id}
                      onClick={() => handleFolderClick(folder._id)}
                      className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                    >
                      <Folder className="w-8 h-8 text-blue-500 mb-2" />
                      <p className="font-medium text-slate-900 truncate">{folder.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{folder.documentCount || 0} items</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents List */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Documents</h3>
              {loading ? (
                <div className="text-center py-12 bg-white rounded-xl">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-slate-600 mt-4">Loading documents...</p>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No documents</h3>
                  <p className="text-slate-500 mb-4">Upload your first document to get started</p>
                  <button
                    onClick={handleUpload}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Document</span>
                  </button>
                </div>
              ) : (
                <DocumentList
                  documents={filteredDocuments}
                  viewMode={viewMode}
                  onDocumentClick={handleDocumentClick}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document Detail Panel */}
      {selectedDocument && (
        <DocumentDetailPanel
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  );
}
