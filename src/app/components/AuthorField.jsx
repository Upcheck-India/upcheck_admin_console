import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

const AuthorField = ({ value, onChange, error }) => {
  const [author, setAuthor] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [tempAuthor, setTempAuthor] = useState('');

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername && !value) {
      setAuthor(storedUsername);
      onChange(storedUsername);
    } else {
      setAuthor(value);
    }
  }, [value, onChange]);

  const handleAuthorChange = (e) => {
    const newAuthor = e.target.value;
    setTempAuthor(newAuthor);
    
    if (!isEditing) {
      setIsEditing(true);
    }
    
    const storedUsername = localStorage.getItem('username');
    if (storedUsername && newAuthor !== storedUsername) {
      setShowConfirmDialog(true);
    } else {
      setAuthor(newAuthor);
      onChange(newAuthor);
    }
  };

  const handleConfirmChange = () => {
    setAuthor(tempAuthor);
    onChange(tempAuthor);
    setShowConfirmDialog(false);
    setIsEditing(false);
  };

  const handleCancelChange = () => {
    const storedUsername = localStorage.getItem('username');
    setTempAuthor(storedUsername);
    setAuthor(storedUsername);
    onChange(storedUsername);
    setShowConfirmDialog(false);
    setIsEditing(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Author*</label>
        {isEditing && (
          <span className="text-xs text-blue-600">
            Editing author name
          </span>
        )}
      </div>
      
      <div className="relative">
        <input
          type="text"
          value={tempAuthor || author}
          onChange={handleAuthorChange}
          className={`w-full p-3 rounded-lg border ${
            error ? 'border-red-500' : 'border-gray-300'
          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none`}
          placeholder="Enter author name"
        />
      </div>

      {error && (
        <div className="flex items-center space-x-1 text-red-500">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Custom Modal Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowConfirmDialog(false)}
            ></div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Change Author Name?
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      You are about to change the author name from the default. This is recommended only when posting on behalf of another author. Are you sure you want to proceed?
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleConfirmChange}
                >
                  Yes, change author
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={handleCancelChange}
                >
                  No, keep default
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthorField;