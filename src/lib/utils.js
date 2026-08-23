import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes a username by stripping any leading '@' characters.
 * Useful for consistent display and searching.
 *
 * @param {string} username - The raw username (e.g., '@@john_doe', '@john_doe', 'john_doe')
 * @returns {string} The normalized username (e.g., 'john_doe')
 */
export function normalizeUsername(username) {
  if (!username) return '';
  return username.trim().replace(/^@+/, '');
}

export const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%239ca3af"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
