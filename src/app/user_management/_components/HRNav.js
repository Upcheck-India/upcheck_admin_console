'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, CalendarCheck, Plane, IdCard, FolderArchive,
} from 'lucide-react';

// Central registry of HR sub-module navigation links.
// New modules append their entry here so every HR page shares one nav.
export const HR_NAV_ITEMS = [
  { label: 'Employees', href: '/user_management', icon: Users, exact: true },
  { label: 'Leave', href: '/user_management/leave', icon: Plane },
  { label: 'Holidays', href: '/user_management/holidays', icon: CalendarCheck },
  { label: 'Profile', href: '/user_management/profile', icon: IdCard },
  { label: 'Documents', href: '/user_management/documents', icon: FolderArchive },
];

export default function HRNav() {
  const pathname = usePathname();

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="mb-6 border-b border-border-default bg-surface rounded-t-lg">
      <nav className="flex flex-wrap gap-1 px-2 -mb-px overflow-x-auto" aria-label="HR sections">
        {HR_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'text-blue-600 border-blue-600'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-default'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
