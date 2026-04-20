'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import SecureLoading from '../../../components/SecureLoading';
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
  ArrowLeft,
  X,
  Check,
  Users
} from 'lucide-react';
import FolderTree from '../../../components/dataroom/FolderTree';
import DocumentList from '../../../components/dataroom/DocumentList';
import DocumentDetailPanel from '../../../components/dataroom/DocumentDetailPanel';
import RoomUsersList from '../../../components/dataroom/RoomUsersList';
import CreateFolderModal from '../../../components/dataroom/CreateFolderModal';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [room, setRoom] = useState(null);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [activeView, setActiveView] = useState('documents');
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  // State for Moving Documents
  const [documentToMove, setDocumentToMove] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

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
      // When currentFolder is null, we want root-level folders (parentId=null)
      // When currentFolder has a value, we want subfolders in that folder
      const parentParam = currentFolder ? `&parentId=${currentFolder}` : '&parentId=null';
      const url = `/api/dataroom/folders?roomId=${roomId}${parentParam}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // API returns { items: [...] } not { folders: [...] }
        // Filter out "Root" folders - they are metadata only, not user-created folders
        const allFolders = data.items || data.folders || [];
        const userFolders = allFolders.filter(folder => folder.name !== 'Root');
        setFolders(userFolders);
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  }

  async function fetchDocuments() {
    try {
      // When currentFolder is null, we want root-level documents (folderId=null)
      // When currentFolder has a value, we want documents in that folder
      const folderParam = currentFolder ? `&folderId=${currentFolder}` : '&folderId=null';
      const url = `/api/dataroom/documents?roomId=${roomId}${folderParam}`;
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
    setShowCreateFolder(true);
  }

  function handleFolderCreated() {
    setShowCreateFolder(false);
    fetchFolders();
  }

  async function handleMoveDocumentSubmit(e) {
    if (e) e.preventDefault();
    if (!documentToMove) return;

    setIsMoving(true);
    // documentToMove.targetFolder gets set from the modal selection UI. If null, it's Root.
    const targetFolderId = documentToMove.targetFolder || null;

    try {
      const response = await fetch(`/api/dataroom/documents/${documentToMove._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: targetFolderId
        }),
      });

      if (response.ok) {
        setDocumentToMove(null);
        await fetchDocuments();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to move document');
      }
    } catch (error) {
      console.error('Move document error:', error);
      alert('An error occurred while moving the document.');
    } finally {
      setIsMoving(false);
    }
  }

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return <SecureLoading />;
  }

  if (!isAuthenticated) {
    return null;
  }

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
                onClick={handleCreateFolder}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center space-x-1"
                title="New Folder"
              >
                <FolderPlus className="w-5 h-5 text-blue-600" />
                <span className="hidden sm:inline text-sm font-medium">New Folder</span>
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

          {/* View Tabs */}
          <div className="flex items-center space-x-1 mt-4 border-b border-slate-200">
            <button
              onClick={() => setActiveView('documents')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'documents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Documents</span>
              </div>
            </button>
            <button
              onClick={() => setActiveView('users')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'users'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Users</span>
              </div>
            </button>
          </div>

          {/* Breadcrumbs - Only show for documents view */}
          {activeView === 'documents' && (
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
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'users' ? (
          <RoomUsersList roomId={roomId} />
        ) : (
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
                  onMoveDocument={(doc) => setDocumentToMove({ ...doc, targetFolder: null })}
                />
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Document Detail Panel */}
      {selectedDocument && (
        <DocumentDetailPanel
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <CreateFolderModal
          roomId={roomId}
          parentId={currentFolder}
          onClose={() => setShowCreateFolder(false)}
          onSuccess={handleFolderCreated}
        />
      )}

      {/* Move Document Modal */}
      {documentToMove && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-xl font-bold text-slate-900">Move Document</h2>
              <button
                onClick={() => setDocumentToMove(null)}
                className="text-slate-500 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <p className="text-sm text-slate-600 mb-4">
                Select a destination folder for <span className="font-semibold text-slate-900">{documentToMove.name}</span>:
              </p>

              <div className="space-y-2">
                {/* Root Option */}
                <button
                  onClick={() => setDocumentToMove({ ...documentToMove, targetFolder: null })}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between ${documentToMove.targetFolder === null
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                >
                  <div className="flex items-center">
                    <Grid className="w-5 h-5 mr-3 text-slate-400" />
                    <span className="font-medium">Root Directory</span>
                  </div>
                  {documentToMove.targetFolder === null && <Check className="w-5 h-5 text-blue-600" />}
                </button>

                {/* Folder Options */}
                {folders.filter(f => f.name !== 'Root').map((folder) => (
                  <button
                    key={folder._id}
                    onClick={() => setDocumentToMove({ ...documentToMove, targetFolder: folder._id })}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between ${documentToMove.targetFolder === folder._id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                      }`}
                  >
                    <div className="flex items-center">
                      <Folder className="w-5 h-5 mr-3 text-slate-400" />
                      <span className="font-medium">{folder.name}</span>
                    </div>
                    {documentToMove.targetFolder === folder._id && <Check className="w-5 h-5 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end space-x-3">
              <button
                onClick={() => setDocumentToMove(null)}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={isMoving}
              >
                Cancel
              </button>
              <button
                onClick={handleMoveDocumentSubmit}
                disabled={isMoving}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                {isMoving ? 'Moving...' : 'Move Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
