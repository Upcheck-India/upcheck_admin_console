// src/components/AvatarWithStatus.js
// A small reusable avatar component that displays the first letter of the username on a colored circle.
// If the user is online, a green dot is rendered at the bottom-right.

import React from 'react';

// Tailwind background colors to pick from. We use 500 shade because it's bright enough on white background.
const COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
];

/**
 * Deterministically maps a string to an index within COLORS by using a simple hash.
 * This ensures the same username always gets the same color but different users
 * likely get different colors.
 */
function stringToColorIndex(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash); // eslint-disable-line no-bitwise
  }
  return Math.abs(hash) % COLORS.length;
}

/**
 * AvatarWithStatus props
 * @param {string} username - The username to display (first letter used).
 * @param {boolean} online - Whether to show the green online dot.
 * @param {string} className - Additional classes applied to the avatar container for size customization.
 */
export default function AvatarWithStatus({ username = '', online = false, className = '' }) {
  const bgClass = COLORS[stringToColorIndex(username)];
  const firstLetter = username?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center rounded-full text-white font-semibold select-none ${bgClass} ${className}`}>
      {firstLetter}
      {online && (
        <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-400 ring-2 ring-white" />
      )}
    </div>
  );
}
