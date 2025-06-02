'use client';

import { useState, useEffect } from 'react';
import { Send, Trash2, Copy, CheckCircle, X, Upload, Download } from 'lucide-react';

export default function InviteManager({ testId, onInviteSent }) {
  const [invites, setInvites] = useState([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [newInvite, setNewInvite] = useState({ name: '', email: '' });
  const [isSending, setIsSending] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Fetch existing invites
  useEffect(() => {
    // This would be replaced with an actual API call
    const fetchInvites = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock data
        const mockInvites = [
          { id: '1', name: 'Jane Smith', email: 'jane@example.com', status: 'pending', sentAt: '2025-05-30T10:00:00Z' },
          { id: '2', name: 'Bob Johnson', email: 'bob@example.com', status: 'accepted', sentAt: '2025-05-30T10:00:00Z' },
          { id: '3', name: 'Alice Williams', email: 'alice@example.com', status: 'completed', sentAt: '2025-05-30T10:00:00Z', score: 85 }
        ];
        
        setInvites(mockInvites);
      } catch (error) {
        console.error('Error fetching invites:', error);
      }
    };
    
    fetchInvites();
  }, [testId]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewInvite(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle bulk emails input
  const handleBulkEmailsChange = (e) => {
    setBulkEmails(e.target.value);
  };
  
  // Send single invite
  const handleSendInvite = async (e) => {
    e.preventDefault();
    
    if (!newInvite.email) {
      alert('Email is required');
      return;
    }
    
    setIsSending(true);
    
    try {
      // This would be an API call in a real application
      console.log('Sending invite to:', newInvite);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add to invites list
      const newInviteWithId = {
        id: `inv_${Date.now()}`,
        ...newInvite,
        status: 'pending',
        sentAt: new Date().toISOString()
      };
      
      setInvites(prev => [newInviteWithId, ...prev]);
      setNewInvite({ name: '', email: '' });
      setShowInviteForm(false);
      
      // Notify parent component
      if (onInviteSent) {
        onInviteSent(newInviteWithId);
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Failed to send invite. Please try again.');
    } finally {
      setIsSending(false);
    }
  };
  
  // Send bulk invites
  const handleSendBulkInvites = async (e) => {
    e.preventDefault();
    
    if (!bulkEmails.trim()) {
      alert('Please enter at least one email address');
      return;
    }
    
    setIsSending(true);
    
    try {
      // Parse emails (simple split by newline or comma)
      const emails = bulkEmails
        .split(/[\n,;]/) // Split by newline, comma, or semicolon
        .map(email => email.trim())
        .filter(email => email.length > 0);
      
      // This would be an API call in a real application
      console.log('Sending bulk invites to:', emails);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Add to invites list
      const newInvites = emails.map(email => ({
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: '',
        email,
        status: 'pending',
        sentAt: new Date().toISOString()
      }));
      
      setInvites(prev => [...newInvites, ...prev]);
      setBulkEmails('');
      setShowBulkUpload(false);
      
      // Notify parent component
      if (onInviteSent) {
        newInvites.forEach(invite => onInviteSent(invite));
      }
      
      alert(`Successfully sent ${emails.length} invitations.`);
    } catch (error) {
      console.error('Error sending bulk invites:', error);
      alert('Failed to send invites. Please try again.');
    } finally {
      setIsSending(false);
    }
  };
  
  // Delete invite
  const handleDeleteInvite = async (inviteId) => {
    if (!confirm('Are you sure you want to delete this invitation?')) {
      return;
    }
    
    try {
      // This would be an API call in a real application
      console.log('Deleting invite:', inviteId);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from invites list
      setInvites(prev => prev.filter(invite => invite.id !== inviteId));
    } catch (error) {
      console.error('Error deleting invite:', error);
      alert('Failed to delete invite. Please try again.');
    }
  };
  
  // Generate invite link
  const generateInviteLink = (inviteId) => {
    return `${window.location.origin}/recruitment/take/${testId}?token=${inviteId}`;
  };
  
  // Copy invite link to clipboard
  const copyInviteLink = (inviteId) => {
    const link = generateInviteLink(inviteId);
    navigator.clipboard.writeText(link);
    setLinkCopied(inviteId);
    setTimeout(() => setLinkCopied(false), 2000);
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };
  
  // Download invites as CSV
  const handleDownloadCSV = () => {
    // Create CSV content
    const headers = ['Name', 'Email', 'Status', 'Sent Date', 'Score'];
    const rows = invites.map(invite => [
      invite.name || '',
      invite.email,
      invite.status,
      formatDate(invite.sentAt),
      invite.score || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `test-invites-${testId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Invitations</h2>
        
        <div className="flex space-x-2">
          {!showInviteForm && !showBulkUpload && (
            <>
              <button
                onClick={() => setShowInviteForm(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center"
              >
                <Send size={16} className="mr-1" />
                Send Invite
              </button>
              
              <button
                onClick={() => setShowBulkUpload(true)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center"
              >
                <Upload size={16} className="mr-1" />
                Bulk Upload
              </button>
              
              {invites.length > 0 && (
                <button
                  onClick={handleDownloadCSV}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center"
                >
                  <Download size={16} className="mr-1" />
                  Export
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Single invite form */}
      {showInviteForm && (
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Send New Invitation</h3>
            <button
              onClick={() => setShowInviteForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
          
          <form onSubmit={handleSendInvite} className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Candidate Name (Optional)
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={newInvite.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={newInvite.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="john@example.com"
                required
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={isSending || !newInvite.email}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:bg-blue-400 flex items-center"
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>Send Invite</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Bulk upload form */}
      {showBulkUpload && (
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Bulk Upload Invitations</h3>
            <button
              onClick={() => setShowBulkUpload(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
          
          <form onSubmit={handleSendBulkInvites} className="space-y-3">
            <div>
              <label htmlFor="bulkEmails" className="block text-sm font-medium text-gray-700 mb-1">
                Email Addresses (one per line or comma-separated)
              </label>
              <textarea
                id="bulkEmails"
                value={bulkEmails}
                onChange={handleBulkEmailsChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="5"
                placeholder="john@example.com\njane@example.com\nbob@example.com"
                required
              ></textarea>
              <p className="text-xs text-gray-500 mt-1">
                Names will be collected when candidates access the test.
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowBulkUpload(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={isSending || !bulkEmails.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:bg-blue-400 flex items-center"
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>Send Invites</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Invites list */}
      {invites.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Candidate
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invites.map((invite) => (
                <tr key={invite.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      {invite.name && (
                        <div className="text-sm font-medium text-gray-900">{invite.name}</div>
                      )}
                      <div className="text-sm text-gray-500">{invite.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      invite.status === 'completed' ? 'bg-green-100 text-green-800' :
                      invite.status === 'accepted' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {invite.status === 'pending' ? 'Pending' : 
                       invite.status === 'accepted' ? 'In Progress' : 'Completed'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(invite.sentAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invite.score !== undefined ? `${invite.score}%` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => copyInviteLink(invite.id)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Copy invite link"
                      >
                        {linkCopied === invite.id ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                      
                      {invite.status === 'completed' && (
                        <a
                          href={`/recruitment/tests/${testId}/evaluate/${invite.id}`}
                          className="text-purple-600 hover:text-purple-900 p-1"
                          title="View submission"
                        >
                          View
                        </a>
                      )}
                      
                      <button
                        onClick={() => handleDeleteInvite(invite.id)}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete invitation"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No invitations sent yet.</p>
          <p className="text-sm text-gray-400 mt-1">Click "Send Invite" to invite candidates to take this test.</p>
        </div>
      )}
    </div>
  );
}
