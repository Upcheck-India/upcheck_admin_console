'use client';

import './globals.css';
import { Nunito, DM_Sans, DM_Mono } from 'next/font/google';
import { ThemeProvider } from './utils/ThemeContext';
import { ClerkProvider } from '@clerk/nextjs';
import useHeartbeat from '../hooks/useHeartbeat';

// Upcheck brand type system: DM Sans (body/UI), Nunito (display/headings),
// DM Mono (tabular numeric data). Exposed as CSS variables for Tailwind.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export default function RootLayout({ children }) {
  // fire heartbeat globally for any authenticated user
  useHeartbeat(true);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${nunito.variable} ${dmMono.variable}`}
    >
      <body className={dmSans.className}>
        <ClerkProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
