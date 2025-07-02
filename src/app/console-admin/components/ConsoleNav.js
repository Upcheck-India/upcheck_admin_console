'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Mail, 
  Settings, 
  Users, 
  FileText,
  MessageSquare,
  Bell,
  HelpCircle,
  LogOut
} from 'lucide-react';

const ConsoleNav = () => {
  const pathname = usePathname();
  const isActive = (path) => pathname === path;

  const navItems = [
    { 
      name: 'Dashboard', 
      href: '/console-admin',
      icon: <LayoutDashboard size={18} />,
      roles: ['admin', 'console_admin']
    },
    { 
      name: 'Email Console', 
      href: '/console-admin/email',
      icon: <Mail size={18} />,
      roles: ['admin', 'console_admin']
    },
    { 
      name: 'Users', 
      href: '/console-admin/users',
      icon: <Users size={18} />,
      roles: ['admin']
    },
    { 
      name: 'Templates', 
      href: '/console-admin/templates',
      icon: <FileText size={18} />,
      roles: ['admin', 'console_admin']
    },
    { 
      name: 'Settings', 
      href: '/console-admin/settings',
      icon: <Settings size={18} />,
      roles: ['admin']
    },
  ];

  return (
    <div className="w-64 h-full bg-gray-900 text-white p-4 flex flex-col overflow-y-auto">
      <div className="sticky top-0 bg-gray-900 pt-4 pb-2 z-10">
        <div className="p-2">
          <h1 className="text-xl font-bold">Console Admin</h1>
        </div>
      </div>
      
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className={isActive(item.href) ? 'text-white' : 'text-gray-400'}>{item.icon}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="sticky bottom-0 bg-gray-900 pt-2 pb-4 border-t border-gray-800">
        <button 
          onClick={() => {
            // Add logout functionality here
            console.log('Logout clicked');
          }}
          className="w-full flex items-center space-x-3 px-4 py-2.5 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default ConsoleNav;
