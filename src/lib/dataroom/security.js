/**
 * Data Room Security Utilities
 * Cryptographically secure token generation and validation
 */

import crypto from 'crypto';

/**
 * Generate cryptographically secure random token
 * @param {number} length - Token length in bytes (default 32)
 * @returns {string} Hex-encoded token
 */
export function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate URL-safe random token
 * @param {number} length - Token length in bytes
 * @returns {string} Base64-URL encoded token
 */
export function generateUrlSafeToken(length = 32) {
  return crypto
    .randomBytes(length)
    .toString('base64url')
    .replace(/[+/=]/g, '');
}

/**
 * Validate IP address against whitelist
 * @param {string} clientIp - Client IP address
 * @param {Array<string>} whitelist - Array of allowed IPs or CIDR ranges
 * @returns {boolean} Whether IP is allowed
 */
export function validateIpWhitelist(clientIp, whitelist = []) {
  if (!whitelist || whitelist.length === 0) return true;
  
  // Simple IP matching (production should use ip-range-check library)
  for (const allowedIp of whitelist) {
    if (allowedIp === clientIp) return true;
    
    // Basic CIDR support (e.g., 192.168.1.0/24)
    if (allowedIp.includes('/')) {
      const [network, bits] = allowedIp.split('/');
      // Simplified check - production needs proper CIDR validation
      if (clientIp.startsWith(network.split('.').slice(0, Math.floor(Number.parseInt(bits, 10) / 8)).join('.'))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Sanitize search query to prevent ReDoS attacks
 * @param {string} query - User search input
 * @returns {string} Sanitized query
 */
export function sanitizeSearchQuery(query) {
  if (!query || typeof query !== 'string') return '';
  
  // Remove regex special characters that could cause ReDoS
  return query
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .substring(0, 100); // Limit length
}

/**
 * Validate file content matches declared MIME type
 * @param {Buffer} buffer - File content buffer
 * @param {string} declaredType - Declared MIME type
 * @returns {Object} Validation result
 */
export function validateFileContent(buffer, declaredType) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty file' };
  }

  // Check file signatures (magic numbers)
  const signatures = {
    'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'application/zip': [0x50, 0x4B, 0x03, 0x04],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04], // DOCX (ZIP)
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B, 0x03, 0x04], // XLSX (ZIP)
  };

  const signature = signatures[declaredType];
  if (!signature) {
    // Unknown type - allow but warn
    return { valid: true, warning: 'Unknown file type - cannot verify signature' };
  }

  // Check if buffer starts with expected signature
  const matches = signature.every((byte, index) => buffer[index] === byte);
  
  if (!matches) {
    return { valid: false, error: 'File content does not match declared type' };
  }

  return { valid: true };
}

/**
 * Check if room has expired
 * @param {Object} room - Room object
 * @returns {boolean} Whether room has expired
 */
export function isRoomExpired(room) {
  if (!room || !room.expiresAt) return false;
  return new Date(room.expiresAt) < new Date();
}

/**
 * Check if access has expired
 * @param {Date} expiresAt - Expiration timestamp
 * @returns {boolean} Whether access has expired
 */
export function isAccessExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/**
 * Get client IP from request headers
 * Handles proxy headers (X-Forwarded-For, X-Real-IP)
 * @param {Request} request - Next.js request object
 * @returns {string} Client IP address
 */
export function getClientIp(request) {
  // Check proxy headers first
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  
  // Fallback to connection remote address
  return request.ip || 'unknown';
}

/**
 * Validate and sanitize folder/document name
 * @param {string} name - Input name
 * @returns {Object} Validation result
 */
export function validateResourceName(name, maxLength = 255) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }

  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `Name cannot exceed ${maxLength} characters` };
  }

  // Prevent path traversal
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    return { valid: false, error: 'Name cannot contain path separators' };
  }

  // Prevent null bytes
  if (trimmed.includes('\0')) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  return { valid: true, cleanName: trimmed };
}

const securityUtils = {
  generateSecureToken,
  generateUrlSafeToken,
  validateIpWhitelist,
  sanitizeSearchQuery,
  validateFileContent,
  isRoomExpired,
  isAccessExpired,
  getClientIp,
  validateResourceName,
};

export default securityUtils;
