/**
 * Data Room Watermark Utility
 * Generates dynamic watermark configurations for documents
 */

/**
 * Generate watermark text for a user viewing a document
 * @param {Object} params - Watermark parameters
 * @param {Object} params.user - User viewing the document
 * @param {Object} params.document - Document being viewed
 * @param {string} params.ip - User's IP address
 * @param {Date} params.timestamp - View timestamp
 * @returns {Object} Watermark configuration
 */
export function generateWatermark({ user, document, ip, timestamp = new Date() }) {
  const watermarkText = [
    user.email || user.username || 'Unknown User',
    ip || 'IP: Unknown',
    timestamp.toISOString().split('T')[0],
    timestamp.toTimeString().split(' ')[0],
  ].join(' | ');

  return {
    text: watermarkText,
    position: 'diagonal', // diagonal, header, footer, center
    opacity: 0.3,
    fontSize: 14,
    color: '#666666',
    rotation: -45, // degrees
    repeat: true, // repeat across page
    metadata: {
      userId: user._id?.toString() || user.id,
      userEmail: user.email,
      documentId: document._id?.toString(),
      documentName: document.name,
      ip,
      timestamp: timestamp.toISOString(),
    },
  };
}

/**
 * Generate watermark for external user with additional tracking
 * @param {Object} params - Watermark parameters
 * @returns {Object} Enhanced watermark configuration
 */
export function generateExternalWatermark({ externalUser, document, ip, timestamp = new Date() }) {
  const watermarkText = [
    `${externalUser.name || externalUser.email}`,
    externalUser.organization || 'External',
    ip || 'IP: Unknown',
    timestamp.toISOString().replace('T', ' ').substring(0, 19),
  ].join(' | ');

  return {
    text: watermarkText,
    position: 'diagonal',
    opacity: 0.4, // Slightly more visible for external users
    fontSize: 12,
    color: '#FF6B6B',
    rotation: -45,
    repeat: true,
    metadata: {
      externalUserId: externalUser._id?.toString(),
      userEmail: externalUser.email,
      userName: externalUser.name,
      organization: externalUser.organization,
      documentId: document._id?.toString(),
      documentName: document.name,
      ip,
      timestamp: timestamp.toISOString(),
      isExternal: true,
    },
  };
}

/**
 * Get watermark configuration from room settings
 * @param {Object} room - Room object
 * @returns {Object} Watermark settings
 */
export function getRoomWatermarkSettings(room) {
  if (!room || !room.settings || !room.settings.enableWatermark) {
    return { enabled: false };
  }

  return {
    enabled: true,
    opacity: room.watermarkOpacity || 0.3,
    fontSize: room.watermarkFontSize || 14,
    color: room.watermarkColor || '#666666',
    position: room.watermarkPosition || 'diagonal',
    customText: room.watermarkCustomText || null,
  };
}

/**
 * Create PDF watermark overlay (for server-side rendering)
 * This would integrate with a PDF library like pdf-lib or PDFKit
 * @param {Object} config - Watermark configuration
 * @returns {Object} PDF watermark specs
 */
export function createPDFWatermarkSpec(config) {
  return {
    text: config.text,
    font: 'Helvetica',
    fontSize: config.fontSize || 14,
    color: hexToRgb(config.color || '#666666'),
    opacity: config.opacity || 0.3,
    rotation: config.rotation || -45,
    position: calculateWatermarkPositions(config.position),
    repeat: config.repeat !== false,
  };
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: Number.parseInt(result[1], 16) / 255,
    g: Number.parseInt(result[2], 16) / 255,
    b: Number.parseInt(result[3], 16) / 255,
  } : { r: 0.4, g: 0.4, b: 0.4 };
}

/**
 * Calculate watermark positions based on page size
 */
function calculateWatermarkPositions(position) {
  switch (position) {
    case 'header':
      return { x: 'center', y: 'top', offsetY: 20 };
    case 'footer':
      return { x: 'center', y: 'bottom', offsetY: 20 };
    case 'center':
      return { x: 'center', y: 'center' };
    case 'diagonal':
    default:
      return { x: 'center', y: 'center', diagonal: true };
  }
}

/**
 * Validate watermark configuration
 */
export function validateWatermarkConfig(config) {
  const errors = [];

  if (!config.text || config.text.trim().length === 0) {
    errors.push('Watermark text is required');
  }

  if (config.opacity < 0 || config.opacity > 1) {
    errors.push('Opacity must be between 0 and 1');
  }

  if (config.fontSize < 6 || config.fontSize > 72) {
    errors.push('Font size must be between 6 and 72');
  }

  if (!['diagonal', 'header', 'footer', 'center'].includes(config.position)) {
    errors.push('Invalid position. Must be: diagonal, header, footer, or center');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

const watermarkUtils = {
  generateWatermark,
  generateExternalWatermark,
  getRoomWatermarkSettings,
  createPDFWatermarkSpec,
  validateWatermarkConfig,
};

export default watermarkUtils;
