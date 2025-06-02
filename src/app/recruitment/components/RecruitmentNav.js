'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  ClipboardList, 
  Plus, 
  BarChart2, 
  Settings,
  Menu,
  X
} from 'lucide-react';

export default function RecruitmentNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTests, setActiveTests] = useState(0);
  
  // Fetch active tests count
  useEffect(() => {
    const fetchActiveTests = async () => {
      try {
        // Fetch tests from MongoDB API
        const response = await fetch('/api/recruitment/tests');
        
        if (!response.ok) {
          throw new Error('Failed to fetch tests');
        }
        
        const tests = await response.json();
        
        // Count active tests (not archived)
        const activeCount = tests.filter(test => !test.archived).length;
        setActiveTests(activeCount);
      } catch (error) {
        console.error('Error fetching active tests count:', error);
        setActiveTests(0);
      }
    };
    
    fetchActiveTests();
  }, []);
  
  // Navigation items
  const navItems = [
    { 
      name: 'Dashboard', 
      href: '/recruitment', 
      icon: Home,
      active: pathname === '/recruitment' || pathname === '/recruitment/'
    },
    { 
      name: 'Tests', 
      href: '/recruitment/tests', 
      icon: ClipboardList,
      active: pathname.startsWith('/recruitment/tests'),
      badge: activeTests
    },
    { 
      name: 'Create Test', 
      href: '/recruitment/create', 
      icon: Plus,
      active: pathname === '/recruitment/create' || pathname.startsWith('/recruitment/create/')
    },
    { 
      name: 'Results', 
      href: '/recruitment/results', 
      icon: BarChart2,
      active: pathname === '/recruitment/results' || pathname.startsWith('/recruitment/results/')
    },
    { 
      name: 'Settings', 
      href: '/recruitment/settings', 
      icon: Settings,
      active: pathname === '/recruitment/settings' || pathname.startsWith('/recruitment/settings/')
    }
  ];
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:flex flex-col bg-white shadow-md rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Recruitment</h2>
        </div>
        
        <nav className="flex">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-2 rounded-lg mr-2 transition-colors ${item.active 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <item.icon size={18} className="mr-2" />
              <span>{item.name}</span>
              {item.badge && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
      
      {/* Mobile Navigation */}
      <div className="md:hidden bg-white shadow-md rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Recruitment</h2>
          
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isMobileMenuOpen ? (
              <X size={24} className="text-gray-700" />
            ) : (
              <Menu size={24} className="text-gray-700" />
            )}
          </button>
        </div>
        
        {isMobileMenuOpen && (
          <nav className="mt-4 flex flex-col space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${item.active 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon size={18} className="mr-2" />
                <span>{item.name}</span>
                {item.badge && (
                  <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
