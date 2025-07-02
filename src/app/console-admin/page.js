'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Inbox, Trash2, FileText, Plus, X, Search, Paperclip, Users, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const MemberSelectionDialog = ({ isOpen, onClose, members, selectedEmails = [], onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(new Set(selectedEmails));
  const modalRef = useRef(null);

  // Close dialog when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleMember = (email) => {
    const newSelected = new Set(selected);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelected(newSelected);
  };

  const handleApply = () => {
    onSelect(Array.from(selected));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
      >
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Select Members</h3>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>
          <div className="mt-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search members..."
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No members found
            </div>
          ) : (
            <ul className="divide-y">
              {filteredMembers.map((member) => (
                <li key={member._id} className="py-2">
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between ${
                      selected.has(member.email) ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleMember(member.email)}
                  >
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                    {selected.has(member.email) && (
                      <Check className="h-5 w-5 text-blue-500" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="p-4 border-t flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add {selected.size} {selected.size === 1 ? 'recipient' : 'recipients'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Email interface components
// Utility function to validate email format
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email.includes(',')) {
    return email.split(',').every(e => re.test(e.trim()));
  }
  return re.test(String(email).trim());
};

const EmailList = ({ emails, onSelectEmail }) => (
  <div className="divide-y divide-gray-200 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
    {emails.length === 0 ? (
      <div className="text-center py-12 text-gray-500">
        <p>No emails found</p>
      </div>
    ) : (
      emails.map((email) => (
        <div 
          key={email.id} 
          className="p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
          onClick={() => onSelectEmail(email)}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">
                  {email.sender || 'Unknown Sender'}
                </span>
                {!email.read && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    New
                  </span>
                )}
              </div>
              <h3 className="text-sm font-medium text-gray-900 truncate mt-1">
                {email.subject || 'No Subject'}
              </h3>
              <p className="text-sm text-gray-500 truncate mt-1">
                {email.preview || 'No preview available'}
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(email.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              {email.attachments && email.attachments.length > 0 && (
                <span className="mt-1 text-xs text-gray-400 flex items-center">
                  <Paperclip className="w-3 h-3 mr-1" />
                  {email.attachments.length}
                </span>
              )}
            </div>
          </div>
        </div>
      ))
    )}
  </div>
);

const ComposeEmail = ({ onSend, onClose }) => {
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    body: '',
    attachments: []
  });
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [errors, setErrors] = useState({});
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [status, setStatus] = useState({ status: 'idle', message: '' });
  
  // Update local sending state when status changes
  useEffect(() => {
    setIsSending(status.status === 'sending');
    
    if (status.status === 'error') {
      setErrors(prev => ({
        ...prev,
        form: status.message
      }));
    } else if (status.status === 'success') {
      setErrors({});
    }
  }, [status]);
  
  // Auto-hide success message after delay
  useEffect(() => {
    if (status.status === 'success') {
      const timer = setTimeout(() => {
        setErrors({});
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status.status]);

  // Fetch members for recipient selection
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          // Transform the data to match our expected format
          const formattedMembers = data.map(user => ({
            _id: user._id,
            email: user.email,
            name: user.name || user.email.split('@')[0],
            role: user.role
          }));
          setMembers(formattedMembers);
        } else {
          console.error('Failed to fetch members:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchMembers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSending) return;
    
    try {
      setStatus({ status: 'sending', message: 'Sending email...' });
      setIsSending(true);
      
      await onSend(formData);
      
      setStatus({ 
        status: 'success', 
        message: 'Email sent successfully!' 
      });
      
      // Clear form and close after a delay
      setTimeout(() => {
        setFormData({ to: '', subject: '', body: '', attachments: [] });
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('Error sending email:', error);
      setStatus({ 
        status: 'error', 
        message: error.response?.data?.error || 'Failed to send email. Please try again.'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      filename: file.name,
      content: file,
    }));
    
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments]
    }));
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  // Status message component
  const StatusMessage = () => {
    if (!status.status || status.status === 'idle') return null;
    
    const statusConfig = {
      sending: {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        icon: (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      },
      success: {
        bg: 'bg-green-50',
        text: 'text-green-800',
        icon: (
          <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      },
      error: {
        bg: 'bg-red-50',
        text: 'text-red-800',
        icon: (
          <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      }
    };

    const config = statusConfig[status.status] || {};
    
    return (
      <div className={`p-3 rounded-md ${config.bg} ${config.text} flex items-center space-x-2`}>
        {config.icon}
        <span className="text-sm font-medium">{status.message}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">New Message</h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close"
              disabled={isSending}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Status Message */}
          <div className="px-4 pt-4">
            <StatusMessage />
          </div>

          {(status.status === 'sending' || status.status === 'success' || status.status === 'error') && (
            <div className={`p-3 mx-4 mt-4 rounded-md ${
              status.status === 'success' ? 'bg-green-50 text-green-800' : 
              status.status === 'error' ? 'bg-red-50 text-red-800' :
              'bg-blue-50 text-blue-800'
            }`}>
              <div className="flex items-center">
                {status.status === 'sending' && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {status.status === 'success' && (
                  <svg className="h-5 w-5 mr-2 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {status.status === 'error' && (
                  <svg className="h-5 w-5 mr-2 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-sm font-medium">{status.message}</span>
              </div>
            </div>
          )}
        
          {/* Form Fields */}
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* Recipient */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="to" className="block text-sm font-medium text-gray-700">
                  To <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsMemberDialogOpen(true)}
                  className="text-xs flex items-center text-blue-600 hover:text-blue-800"
                  disabled={isLoadingMembers || isSending}
                >
                  <Users className="h-3.5 w-3.5 mr-1" />
                  Select from members
                </button>
              </div>
              
              <div className="relative">
                <div className="flex flex-wrap gap-1 items-center min-h-[42px] p-1 border border-gray-300 rounded-md focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                  {/* Email chips */}
                  {formData.to.split(',').filter(Boolean).map((email, index) => (
                    <div key={index} className="flex items-center bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
                    <span className="text-sm">{email.trim()}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        const emails = formData.to.split(',').filter(Boolean);
                        emails.splice(index, 1);
                        setFormData({...formData, to: emails.join(', ')});
                      }}
                      className="ml-1 text-blue-500 hover:text-blue-700 focus:outline-none"
                      disabled={isSending}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  ))}
                  <input
                    id="to"
                    type="email"
                    value={formData.to.includes(',') ? '' : formData.to}
                    onChange={(e) => {
                      setFormData({...formData, to: e.target.value});
                      if (errors.to) {
                        setErrors(prev => ({ ...prev, to: '' }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && formData.to.trim()) {
                        e.preventDefault();
                        const currentEmails = formData.to.split(',').map(e => e.trim()).filter(Boolean);
                        const emails = new Set(currentEmails);
                        const inputValue = e.target.value.trim();
                        
                        // Only process if there's actually text in the input
                        if (inputValue) {
                          if (validateEmail(inputValue)) {
                            emails.add(inputValue);
                            setFormData(prev => ({
                              ...prev,
                              to: Array.from(emails).join(', ')
                            }));
                            // Clear the input field after adding
                            e.target.value = '';
                          } else {
                            setErrors(prev => ({ ...prev, to: 'Please enter a valid email address' }));
                          }
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (formData.to.trim()) {
                        const emails = new Set(formData.to.split(',').map(e => e.trim()).filter(Boolean));
                        const newEmail = formData.to.trim().replace(/,$/, '');
                        if (validateEmail(newEmail)) {
                          emails.add(newEmail);
                          setFormData(prev => ({
                            ...prev,
                            to: Array.from(emails).join(', ')
                          }));
                        } else if (newEmail) {
                          setErrors(prev => ({ ...prev, to: 'Please enter a valid email address' }));
                        }
                      }
                    }}
                    className={`flex-1 min-w-[150px] px-2 py-1 border-0 focus:ring-0 focus:outline-none sm:text-sm`}
                    placeholder={formData.to ? '' : "Enter email addresses"}
                    required={!formData.to}
                    disabled={isSending || isLoadingMembers}
                  />
                </div>
              </div>
              
              {isLoadingMembers ? (
                <p className="mt-1 text-xs text-gray-500">
                  <span className="inline-flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading members...
                  </span>
                </p>
              ) : errors.to ? (
                <p className="mt-1 text-sm text-red-600">{errors.to}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  Type email and press Enter or comma to add multiple recipients
                </p>
              )}
              
              {/* Member Selection Dialog */}
              <MemberSelectionDialog
                isOpen={isMemberDialogOpen}
                onClose={() => setIsMemberDialogOpen(false)}
                members={members}
                selectedEmails={formData.to.split(',').map(e => e.trim()).filter(Boolean)}
                onSelect={(selectedEmails) => {
                  setFormData(prev => ({
                    ...prev,
                    to: selectedEmails.join(', ')
                  }));
                }}
              />
            </div>
            
            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                Subject <span className="text-red-500">*</span>
              </label>
              <div className="relative rounded-md shadow-sm">
                <input
                  id="subject"
                  type="text"
                  value={formData.subject}
                  onChange={(e) => {
                    setFormData({...formData, subject: e.target.value});
                    if (errors.subject) {
                      setErrors(prev => ({ ...prev, subject: '' }));
                    }
                  }}
                  className={`block w-full px-3 py-2 border ${
                    errors.subject ? 'border-red-300' : 'border-gray-300'
                  } rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  placeholder="Subject"
                  required
                  disabled={isSending}
                />
              </div>
              {errors.subject && (
                <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
              )}
            </div>
            
            {/* Message Body */}
            <div className="flex-1">
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <div className="h-full">
                <textarea
                  id="message"
                  value={formData.body}
                  onChange={(e) => {
                    setFormData({...formData, body: e.target.value});
                    if (errors.body) {
                      setErrors(prev => ({ ...prev, body: '' }));
                    }
                  }}
                  className={`block w-full min-h-[200px] px-3 py-2 border ${
                    errors.body ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  placeholder="Write your message here..."
                  required
                  disabled={isSending}
                />
                {errors.body && (
                  <p className="mt-1 text-sm text-red-600">{errors.body}</p>
                )}
              </div>
            </div>
            
            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Attachments
                </label>
                <span className="text-xs text-gray-500">
                  {formData.attachments.length} of 5 files
                </span>
              </div>
              
              {formData.attachments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {formData.attachments.map((file, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="flex-shrink-0 bg-blue-100 p-2 rounded-md">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.filename}</p>
                          <p className="text-xs text-gray-500">
                            {(file.content.size / 1024).toFixed(1)} KB
                            {file.content.size > 5 * 1024 * 1024 && (
                              <span className="ml-2 text-red-500">(File too large, max 5MB)</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newAttachments = [...formData.attachments];
                          newAttachments.splice(index, 1);
                          setFormData({...formData, attachments: newAttachments});
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                        aria-label="Remove attachment"
                        disabled={isSending}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <label className={`inline-flex items-center justify-center w-full px-4 py-2 border ${
                errors.attachments ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer ${
                isSending ? 'opacity-50 cursor-not-allowed' : ''
              }`}>
                <Paperclip className="h-4 w-4 mr-2" />
                <span>Add Attachment</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  multiple
                  disabled={isSending || formData.attachments.length >= 5}
                />
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Maximum 5 files, 5MB each. Supported formats: PDF, DOC, DOCX, JPG, PNG
              </p>
              {errors.attachments && (
                <p className="mt-1 text-sm text-red-600">{errors.attachments}</p>
              )}
            </div>
          </div>
          
          {/* Footer with Actions */}
          <div className="p-4 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
            <div className="w-full sm:w-auto">
              <label className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
                <Paperclip className="h-4 w-4 mr-2" />
                <span>Attach File</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  multiple
                />
              </label>
            </div>
            
            <div className="flex space-x-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={isSending}
                className={`w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                  isSending 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSending ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : 'Send'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const ConsoleAdminPage = () => {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth(true);
  const [activeTab, setActiveTab] = useState('inbox');
  const [emails, setEmails] = useState([]);
  const [isComposing, setIsComposing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mock data for emails
  const mockEmails = [
    {
      id: 1,
      from: 'support@upcheck.team',
      to: user?.email || 'user@example.com',
      subject: 'Welcome to Console Admin',
      preview: 'Thank you for joining our platform. This is a sample email to get you started.',
      body: 'Welcome to the Console Admin panel. You can use this interface to manage your communications and oversee system operations.\n\nThis is a demonstration email to show you how the interface works. You can compose new emails, view your inbox, and manage your communications from this dashboard.',
      date: new Date().toISOString(),
      read: false,
      folder: 'inbox'
    },
    {
      id: 2,
      from: 'notifications@upcheck.team',
      to: user?.email || 'user@example.com',
      subject: 'System Update Notification',
      preview: 'We are performing scheduled maintenance this weekend.',
      body: 'Dear Admin,\n\nWe will be performing scheduled maintenance on our systems this weekend between 2:00 AM and 6:00 AM EST. The system will be temporarily unavailable during this time.\n\nDuring the maintenance window, you may experience:\n- Temporary service interruptions\n- Limited access to certain features\n- Possible delays in email delivery\n\nWe apologize for any inconvenience and appreciate your understanding.',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      read: true,
      folder: 'inbox'
    },
    {
      id: 3,
      from: user?.email || 'user@example.com',
      to: 'team@upcheck.team',
      subject: 'Test Email',
      preview: 'This is a test email sent from the console.',
      body: 'This is a test email to verify that the email sending functionality is working correctly.',
      date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      read: true,
      folder: 'sent'
    }
  ];

  // Load emails when component mounts and user is authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Check if user has the required role
      const normalizedRole = user.role?.toLowerCase().replace(/\s+/g, '_');
      if (!['admin', 'console_admin'].includes(normalizedRole)) {
        router.push('/unauthorized');
        return;
      }
      // For now, use mock data
      setEmails(mockEmails);
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Filter emails based on active tab and search query
  const filteredEmails = emails.filter(email => {
    const matchesFolder = email.folder === activeTab;
    const matchesSearch = searchQuery === '' || 
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFolder && matchesSearch;
  });

  const [sendingStatus, setSendingStatus] = useState({ status: 'idle', message: '' });

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.includes(',')) {
      return email.split(',').every(e => re.test(e.trim()));
    }
    return re.test(String(email).trim());
  };
  
  const validateAllEmails = (emailString) => {
    if (!emailString) return false;
    const emails = emailString.split(',').map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) return false;
    return emails.every(email => validateEmail(email));
  };

  const handleSendEmail = async (emailData) => {
    // Validate email fields
    if (!emailData.to || !emailData.subject || !emailData.body) {
      setSendingStatus({ status: 'error', message: 'Please fill in all required fields' });
      return false;
    }

    // Split and validate all email addresses
    const recipientEmails = emailData.to.split(',')
      .map(e => e.trim())
      .filter(Boolean);

    if (recipientEmails.length === 0) {
      setSendingStatus({ status: 'error', message: 'Please enter at least one email address' });
      return false;
    }

    // Validate each email
    const invalidEmails = recipientEmails.filter(email => !validateEmail(email));
    if (invalidEmails.length > 0) {
      setSendingStatus({ 
        status: 'error', 
        message: `Invalid email address(es): ${invalidEmails.join(', ')}` 
      });
      return false;
    }
    
    setSendingStatus({ status: 'sending', message: 'Sending email...' });
    
    try {
      const formData = new FormData();
      formData.append('to', emailData.to);
      formData.append('subject', emailData.subject);
      formData.append('body', emailData.body);
      
      // Add attachments if any
      if (emailData.attachments && emailData.attachments.length > 0) {
        emailData.attachments.forEach((file, index) => {
          formData.append(`attachments`, file);
        });
      }
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }
      
      // Add to sent folder
      const newEmail = {
        id: Date.now().toString(),
        to: emailData.to,
        subject: emailData.subject,
        body: emailData.body,
        date: new Date().toISOString(),
        read: true,
        folder: 'sent'
      };
      
      setEmails(prev => [newEmail, ...prev]);
      
      // Save to localStorage
      const storedEmails = JSON.parse(localStorage.getItem('emails') || '[]');
      localStorage.setItem('emails', JSON.stringify([newEmail, ...storedEmails]));
      
      setSendingStatus({ 
        status: 'success', 
        message: 'Email sent successfully!' 
      });
      
      return true;
      
    } catch (error) {
      console.error('Error sending email:', error);
      setSendingStatus({ 
        status: 'error', 
        message: error.message || 'Failed to send email. Please try again.'
      });
      return false;
    }

    try {
      setSendingStatus({ status: 'sending', message: 'Sending email...' });
      
      // Create a new FormData instance
      const formData = new FormData();
      formData.append('to', emailData.to);
      formData.append('subject', emailData.subject);
      formData.append('body', emailData.body);
      
      // Add attachments if any
      if (emailData.attachments && emailData.attachments.length > 0) {
        for (const attachment of emailData.attachments) {
          // If it's a file object, append directly
          if (attachment instanceof File) {
            formData.append('attachments', attachment);
          } 
          // If it's a base64 string, convert to blob
          else if (typeof attachment.content === 'string' && attachment.content.startsWith('data:')) {
            const response = await fetch(attachment.content);
            const blob = await response.blob();
            formData.append('attachments', blob, attachment.name || 'attachment');
          }
        }
      }

      // Send the email
      const response = await fetch('/api/send-email', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, let the browser set it with the correct boundary
        headers: {
          'Accept': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      // Create new email object for the UI
      const newEmail = {
        id: Date.now().toString(),
        from: user?.email || 'upcheck.team@gmail.com',
        to: emailData.to,
        subject: emailData.subject,
        preview: emailData.body.substring(0, 100) + (emailData.body.length > 100 ? '...' : ''),
        body: emailData.body,
        date: new Date().toISOString(),
        read: true,
        folder: 'sent',
        attachments: emailData.attachments || []
      };

      // Add to emails list and update state
      setEmails(prevEmails => {
        const updatedEmails = [...prevEmails, newEmail];
        // Save to localStorage for persistence
        localStorage.setItem('emails', JSON.stringify(updatedEmails));
        return updatedEmails;
      });
      
      // Show success message
      setSendingStatus({ 
        status: 'success', 
        message: 'Email sent successfully!',
        data: result
      });
      
      // Close composer after a short delay
      setTimeout(() => {
        setIsComposing(false);
        setActiveTab('sent');
        setSendingStatus({ status: 'idle', message: '' });
      }, 2000);
      
    } catch (error) {
      console.error('Error sending email:', error);
      const errorMessage = error.response?.data?.message || 
                         error.message || 
                         'Failed to send email. Please try again.';
      
      setSendingStatus({ 
        status: 'error', 
        message: errorMessage,
        error: error
      });
      
      // Log detailed error for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('Email sending error details:', {
          error,
          response: error.response?.data,
          status: error.response?.status,
        });
      }
    }
  };

  const handleSelectEmail = (email) => {
    // Mark as read when selected
    if (!email.read) {
      setEmails(prev => 
        prev.map(e => 
          e.id === email.id ? { ...e, read: true } : e
        )
      );
    }
    setSelectedEmail(email);
  };

  const handleDeleteEmail = (emailId) => {
    setEmails(prev => 
      prev.map(e => 
        e.id === emailId ? { ...e, folder: 'trash' } : e
      )
    );
    setSelectedEmail(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will be redirected by the layout
  }

  // Get unread count for the inbox tab
  const unreadCount = emails.filter(email => !email.read && email.folder === 'inbox').length;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4">
          <button
            onClick={() => setIsComposing(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center space-x-2"
          >
            <Plus size={16} />
            <span>Compose</span>
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center w-full px-4 py-3 text-left ${
              activeTab === 'inbox' 
                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Inbox size={18} className="mr-3" />
            <span>Inbox</span>
            {unreadCount > 0 && (
              <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center w-full px-4 py-3 text-left ${
              activeTab === 'sent' 
                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Send size={18} className="mr-3" />
            <span>Sent</span>
          </button>
          
          <button
            onClick={() => setActiveTab('drafts')}
            className={`flex items-center w-full px-4 py-3 text-left ${
              activeTab === 'drafts' 
                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText size={18} className="mr-3" />
            <span>Drafts</span>
          </button>
          
          <button
            onClick={() => setActiveTab('trash')}
            className={`flex items-center w-full px-4 py-3 text-left ${
              activeTab === 'trash' 
                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Trash2 size={18} className="mr-3" />
            <span>Trash</span>
          </button>
        </nav>
        
        {/* User info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
              {user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{user?.username || 'User'}</p>
              <p className="text-xs text-gray-500">{user?.email || 'user@example.com'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 py-4 px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">
              {activeTab === 'inbox' && 'Inbox'}
              {activeTab === 'sent' && 'Sent Items'}
              {activeTab === 'drafts' && 'Drafts'}
              {activeTab === 'trash' && 'Trash'}
              {filteredEmails.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredEmails.length})
                </span>
              )}
            </h1>
            
            <div className="relative w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </header>

        {/* Email List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
              <Inbox size={48} className="mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">
                {searchQuery ? 'No matching emails' : `No emails in ${activeTab}`}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery 
                  ? 'Try adjusting your search terms.'
                  : activeTab === 'inbox' 
                  ? 'Your inbox is empty. Emails you receive will appear here.'
                  : activeTab === 'sent'
                  ? 'No sent emails yet.'
                  : activeTab === 'drafts'
                  ? 'No draft emails saved.'
                  : 'Trash is empty.'}
              </p>
              {!searchQuery && activeTab !== 'sent' && (
                <button
                  onClick={() => setIsComposing(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus size={16} className="mr-2" />
                  Compose New Email
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              <EmailList 
                emails={filteredEmails}
                onSelectEmail={handleSelectEmail}
              />
            </div>
          )}
        </div>
      </div>
        
      {/* Email Detail View */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-medium">{selectedEmail.subject || 'No Subject'}</h3>
              <button 
                onClick={() => setSelectedEmail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      From: {selectedEmail.from}
                    </p>
                    <p className="text-sm text-gray-500">
                      To: {selectedEmail.to}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(selectedEmail.date).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => {
                        setSelectedEmail(null);
                        setIsComposing(true);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                      title="Reply"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDeleteEmail(selectedEmail.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                      title="Delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="prose max-w-none">
                {selectedEmail.body.split('\n').map((paragraph, i) => (
                  <p key={i} className="whitespace-pre-line mb-4">{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedEmail(null);
                  setIsComposing(true);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      )}
        
      {/* Compose Email Modal */}
      {isComposing && (
        <ComposeEmail
          onSend={handleSendEmail}
          onClose={() => setIsComposing(false)}
        />
      )}
    </div>
  );
};

export default ConsoleAdminPage;