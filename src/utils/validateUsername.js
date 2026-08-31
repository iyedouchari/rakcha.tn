import { supabase } from '../lib/supabase.js';

/**
 * Strict regex pattern for full Rakcha usernames:
 * Must start with '@', followed by alphanumeric characters, a single underscore, and alphanumeric characters.
 * Example: @alex_johnson, @john_doe
 */
export const USERNAME_REGEX = /^@[a-z0-9]+_[a-z0-9]+$/;

/**
 * Regex pattern for username body (without '@' prefix)
 */
export const USERNAME_BODY_REGEX = /^[a-z0-9]+_[a-z0-9]+$/;

/**
 * Real-time input sanitization:
 * - Converts input to lowercase
 * - Strips any leading '@' characters
 * - Strips whitespace
 * - Restricts characters strictly to lowercase letters (a-z), numbers (0-9), and underscores (_)
 * - Prevents multiple consecutive underscores (e.g., john__doe -> john_doe)
 * - Limits to a single underscore in total to enforce firstname_lastname format
 * - Restricts length to max 29 chars for body (max 30 with '@')
 *
 * @param {string} rawInput
 * @returns {string} Sanitized username body without '@'
 */
export function sanitizeUsernameBody(rawInput) {
  if (!rawInput) return '';

  let sanitized = String(rawInput)
    .toLowerCase()
    .replace(/^@+/, '') // Strip leading @
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/[^a-z0-9_]/g, '') // Keep only valid characters
    .replace(/_{2,}/g, '_'); // Collapse consecutive underscores

  // Limit to at most one underscore to guide the user to firstname_lastname format
  const parts = sanitized.split('_');
  if (parts.length > 2) {
    sanitized = parts[0] + '_' + parts.slice(1).join('');
  }

  // Max 29 characters for body (total 30 with '@')
  if (sanitized.length > 29) {
    sanitized = sanitized.slice(0, 29);
  }

  return sanitized;
}

/**
 * Formats a given raw username or body into full '@firstname_lastname' format.
 *
 * @param {string} rawInput
 * @returns {string} Full username starting with '@'
 */
export function formatFullUsername(rawInput) {
  const body = sanitizeUsernameBody(rawInput);
  return body ? `@${body}` : '';
}

/**
 * Validates the username format in real-time and returns detailed status & messages.
 *
 * @param {string} username - Can be full (@john_doe) or body (john_doe)
 * @returns {{
 *   isValid: boolean,
 *   message: string,
 *   state: 'empty' | 'warning' | 'invalid' | 'valid',
 *   sanitizedBody: string,
 *   fullUsername: string
 * }}
 */
export function validateUsernameFormat(username) {
  const body = sanitizeUsernameBody(username);
  const full = body ? `@${body}` : '';

  if (!body) {
    return {
      isValid: false,
      message: 'Format: firstname_lastname (e.g., john_doe)',
      state: 'empty',
      sanitizedBody: '',
      fullUsername: ''
    };
  }

  if (body.startsWith('_')) {
    return {
      isValid: false,
      message: 'Please enter the first name before the underscore.',
      state: 'invalid',
      sanitizedBody: body,
      fullUsername: full
    };
  }

  if (!body.includes('_')) {
    return {
      isValid: false,
      message: 'Username must contain an underscore separating first and last name (e.g., john_doe).',
      state: 'warning',
      sanitizedBody: body,
      fullUsername: full
    };
  }

  if (body.endsWith('_')) {
    return {
      isValid: false,
      message: 'Please enter the second name after the underscore.',
      state: 'warning',
      sanitizedBody: body,
      fullUsername: full
    };
  }

  if (!USERNAME_BODY_REGEX.test(body)) {
    return {
      isValid: false,
      message: 'Username must contain only lowercase letters, numbers, and one underscore.',
      state: 'invalid',
      sanitizedBody: body,
      fullUsername: full
    };
  }

  if (full.length < 4 || full.length > 30) {
    return {
      isValid: false,
      message: 'Username must be between 3 and 30 characters in total.',
      state: 'invalid',
      sanitizedBody: body,
      fullUsername: full
    };
  }

  return {
    isValid: true,
    message: 'Valid username format.',
    state: 'valid',
    sanitizedBody: body,
    fullUsername: full
  };
}

/**
 * Checks if a username is already taken in the Supabase `profiles` table.
 *
 * @param {string} username - Full or body username
 * @param {string} [excludeUserId] - Optional user ID to exclude (e.g. Current user in settings)
 * @returns {Promise<{
 *   isAvailable: boolean,
 *   message: string,
 *   error?: string
 * }>}
 */
export async function checkUsernameAvailability(username, excludeUserId = null) {
  const validation = validateUsernameFormat(username);
  if (!validation.isValid) {
    return {
      isAvailable: false,
      message: validation.message
    };
  }

  try {
    const full = validation.fullUsername;
    const body = validation.sanitizedBody;

    // Check both '@username' and 'username' forms in DB for full consistency
    let query = supabase
      .from('profiles')
      .select('id, username')
      .or(`username.ilike.${full},username.ilike.${body}`);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.warn('Could not check username availability against Supabase:', error.message);
      // Fallback: Assume valid format if network/RLS issues occur
      return {
        isAvailable: true,
        message: 'Username format is valid.'
      };
    }

    if (data && data.length > 0) {
      return {
        isAvailable: false,
        message: 'This username is already taken. Please choose another.'
      };
    }

    return {
      isAvailable: true,
      message: 'Username is available!'
    };
  } catch (err) {
    console.error('Error checking username availability:', err);
    return {
      isAvailable: true,
      message: 'Username format is valid.'
    };
  }
}
