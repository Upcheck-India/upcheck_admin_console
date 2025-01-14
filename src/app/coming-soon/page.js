// src/app/coming-soon/page.js
'use client';

import React from 'react';
import { Construction } from 'lucide-react';
import Link from 'next/link';

const ComingSoonPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-xl">
        <div className="bg-gradient-to-r from-teal-500 to-blue-500 p-3 rounded-full inline-block mb-6">
          <Construction className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent mb-4">
          Well its a construction site
        </h1>
        <p className="text-gray-600 mb-8">
          Maybe check later?
        </p>
        <Link 
          href="/console"
          className="inline-flex items-center px-6 py-3 rounded-lg bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:from-teal-600 hover:to-blue-600 transition-all duration-300"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default ComingSoonPage;