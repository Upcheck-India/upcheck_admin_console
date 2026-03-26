'use client';

import { ClerkProvider } from '@clerk/nextjs';

export default function ExternalDataroomLayout({ children }) {
  return (
    <ClerkProvider>
      {children}
    </ClerkProvider>
  );
}
