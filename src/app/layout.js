'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from './utils/ThemeContext';
import { ClerkProvider } from '@clerk/nextjs';
import useHeartbeat from '../hooks/useHeartbeat';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  // fire heartbeat globally for any authenticated user
  useHeartbeat(true);
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClerkProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
