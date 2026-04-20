/**
 * Cloudmersive Virus Scanner Integration
 * Advanced threat detection for document uploads
 * Free tier: 800 calls/month, 3.5MB max file size
 * 
 * Powered by Cloudmersive for file security
 * https://cloudmersive.com
 */

const CLOUDMERSIVE_API_URL = 'https://api.cloudmersive.com';
const MAX_FILE_SIZE = 3.5 * 1024 * 1024; // 3.5MB free tier limit

const THREAT_LABELS = {
  virus_or_malware: 'Virus or Malware Detected',
  executable: 'Executable File Blocked',
  invalid_file: 'Invalid/Corrupted File',
  script: 'Script File Blocked',
  password_protected: 'Password Protected File Blocked',
  macros: 'Embedded Macros Detected',
  xml_external_entities: 'XML External Entity Attack Detected',
  insecure_deserialization: 'Insecure Deserialization Threat',
  html_content: 'HTML/Script Content Blocked',
  unsafe_archive: 'Unsafe Archive (e.g. Zip Bomb) Detected',
  ole_embedded_object: 'OLE Embedded Object Blocked',
  restricted_file_type: 'File Type Not Allowed',
};

// Allowed file types for DMS+VDR (secure document vault)
const ALLOWED_FILE_TYPES = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.txt', '.csv', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.mp4', '.mov', '.zip', '.rar'
].join(',');

/**
 * Scan file for viruses and threats using Cloudmersive Advanced Scan
 * @param {File|Buffer} file - File to scan
 * @param {string} fileName - Original file name
 * @returns {Promise<{safe: boolean, threats: string[], viruses: array, fileFormat: string, fileHash: string}>}
 */
export async function scanFile(file, fileName = null) {
  // Check if Cloudmersive is enabled via environment variable
  const cloudmersiveEnabled = process.env.ENABLE_CLOUDMERSIVE === 'true';
  
  if (!cloudmersiveEnabled) {
    console.info('Cloudmersive virus scanning disabled via ENABLE_CLOUDMERSIVE env variable');
    return {
      safe: true,
      threats: [],
      viruses: [],
      fileFormat: null,
      fileHash: null,
      scanSkipped: true,
      reason: 'Virus scanning disabled',
      securityProvider: 'Cloudmersive',
      securityProviderUrl: 'https://cloudmersive.com',
    };
  }

  const apiKey = process.env.CLOUDMERSIVE_API_KEY;
  
  if (!apiKey) {
    console.warn('CLOUDMERSIVE_API_KEY not set - virus scanning disabled');
    return {
      safe: true,
      threats: [],
      viruses: [],
      fileFormat: null,
      fileHash: null,
      scanSkipped: true,
      reason: 'Virus scanning not configured',
      securityProvider: 'Cloudmersive',
      securityProviderUrl: 'https://cloudmersive.com',
    };
  }

  try {
    // Check file size (3.5MB limit for free tier)
    const fileSize = file.size || file.length;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    
    if (fileSize > MAX_FILE_SIZE) {
      console.warn(`File too large for virus scan: ${fileSizeMB}MB (limit: 3.5MB)`);
      return {
        safe: true,
        threats: [],
        viruses: [],
        fileFormat: null,
        fileHash: null,
        scanSkipped: true,
        reason: `File size ${fileSizeMB}MB exceeds free tier limit of 3.5MB`,
        securityProvider: 'Cloudmersive',
        securityProviderUrl: 'https://cloudmersive.com',
      };
    }

    // Prepare FormData
    const formData = new FormData();
    
    // Handle different file types (File object vs Buffer)
    if (file instanceof Buffer) {
      const blob = new Blob([file]);
      formData.append('inputFile', blob, fileName || 'file');
    } else {
      formData.append('inputFile', file);
    }

    // Advanced scan with maximum security settings
    const response = await fetch(`${CLOUDMERSIVE_API_URL}/virus/scan/file/advanced`, {
      method: 'POST',
      headers: {
        'Apikey': apiKey,
        // All threat controls set to false = maximum security
        'allowExecutables': 'false',
        'allowInvalidFiles': 'false',
        'allowScripts': 'false',
        'allowPasswordProtectedFiles': 'false',
        'allowMacros': 'false',
        'allowXmlExternalEntities': 'false',
        'allowInsecureDeserialization': 'false',
        'allowHtml': 'false',
        'allowUnsafeArchives': 'false',
        'allowOleEmbeddedObject': 'false',
        'allowUnwantedAction': 'false',
        'restrictFileTypes': ALLOWED_FILE_TYPES,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloudmersive API error:', response.status, errorText);
      
      // Handle specific Cloudmersive errors gracefully
      if (response.status === 413 || errorText.includes('file size')) {
        return {
          safe: true,
          threats: [],
          viruses: [],
          fileFormat: null,
          fileHash: null,
          scanSkipped: true,
          reason: 'File size exceeds scanning service limits',
          securityProvider: 'Cloudmersive',
          securityProviderUrl: 'https://cloudmersive.com',
        };
      }
      
      throw new Error(`Scan service error: ${response.status}`);
    }

    const result = await response.json();

    // Build threat summary
    const threats = [];
    if (!result.CleanResult) threats.push('virus_or_malware');
    if (result.ContainsExecutable) threats.push('executable');
    if (result.ContainsInvalidFile) threats.push('invalid_file');
    if (result.ContainsScript) threats.push('script');
    if (result.ContainsPasswordProtectedFile) threats.push('password_protected');
    if (result.ContainsMacros) threats.push('macros');
    if (result.ContainsXmlExternalEntities) threats.push('xml_external_entities');
    if (result.ContainsInsecureDeserialization) threats.push('insecure_deserialization');
    if (result.ContainsHtml) threats.push('html_content');
    if (result.ContainsUnsafeArchive) threats.push('unsafe_archive');
    if (result.ContainsOleEmbeddedObject) threats.push('ole_embedded_object');
    if (result.ContainsRestrictedFileFormat) threats.push('restricted_file_type');

    const safe = threats.length === 0;

    return {
      safe,
      threats,
      threatLabels: threats.map(t => THREAT_LABELS[t] || t),
      viruses: result.FoundViruses || [],
      fileFormat: result.VerifiedFileFormat || null,
      fileHash: result.ContentInformation?.Hash_SHA1 || null,
      scanSkipped: false,
      securityProvider: 'Cloudmersive',
      securityProviderUrl: 'https://cloudmersive.com',
      rawResult: result,
    };

  } catch (error) {
    console.error('Virus scan error:', error);
    
    // Fail securely: if scan fails, block the upload
    return {
      safe: false,
      threats: ['scan_error'],
      threatLabels: ['Virus scan failed - upload blocked for security'],
      viruses: [],
      fileFormat: null,
      fileHash: null,
      scanSkipped: false,
      securityProvider: 'Cloudmersive',
      securityProviderUrl: 'https://cloudmersive.com',
      error: error.message,
    };
  }
}

/**
 * Scan a website URL for threats
 * @param {string} url - URL to scan
 * @returns {Promise<{safe: boolean, threatType: string, httpCode: number}>}
 */
export async function scanWebsite(url) {
  const cloudmersiveEnabled = process.env.ENABLE_CLOUDMERSIVE === 'true';
  
  if (!cloudmersiveEnabled) {
    console.info('Cloudmersive URL scanning disabled via ENABLE_CLOUDMERSIVE env variable');
    return { safe: true, threatType: 'None', httpCode: null, scanSkipped: true, reason: 'Scanning disabled' };
  }

  const apiKey = process.env.CLOUDMERSIVE_API_KEY;
  
  if (!apiKey) {
    console.warn('CLOUDMERSIVE_API_KEY not set - URL scanning disabled');
    return { safe: true, threatType: 'None', httpCode: null, scanSkipped: true };
  }

  try {
    const response = await fetch(`${CLOUDMERSIVE_API_URL}/virus/scan/website`, {
      method: 'POST',
      headers: {
        'Apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Url: url }),
    });

    if (!response.ok) {
      throw new Error(`Scan service error: ${response.status}`);
    }

    const result = await response.json();

    return {
      safe: result.CleanResult,
      threatType: result.WebsiteThreatType, // None | Malware | Phishing | ForcedDownload | UnableToConnect
      httpCode: result.WebsiteHttpResponseCode,
      scanSkipped: false,
    };

  } catch (error) {
    console.error('URL scan error:', error);
    return {
      safe: false,
      threatType: 'ScanError',
      httpCode: null,
      scanSkipped: false,
      error: error.message,
    };
  }
}
