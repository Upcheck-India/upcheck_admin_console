import { NextResponse } from 'next/server';

/**
 * Virus Scan API Endpoint
 * Scans uploaded files for viruses and threats using Cloudmersive API
 *
 * Controlled by Vercel Environment Flags:
 * - ENABLE_CLOUDMERSIVE: 'true' to enable virus scanning
 * - CLOUDMERSIVE_API_KEY: API key for Cloudmersive service
 *
 * Free tier limits: 800 calls/month, 3.5MB max file size
 */

const CLOUDMERSIVE_API_URL = 'https://api.cloudmersive.com';
const MAX_FILE_SIZE = 3.5 * 1024 * 1024; // 3.5MB free tier limit

// Threat type labels for user-friendly messages
const THREAT_LABELS = {
  virus_or_malware: 'Virus or Malware Detected',
  executable: 'Executable File Blocked',
  invalid_file: 'Invalid/Corrupted File',
  script: 'Script File Blocked',
  password_protected: 'Password Protected File',
  macros: 'Embedded Macros Detected',
  xml_external_entities: 'XML External Entity Attack',
  insecure_deserialization: 'Insecure Deserialization Threat',
  html_content: 'HTML/Script Content Blocked',
  unsafe_archive: 'Unsafe Archive (e.g. Zip Bomb)',
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
 * POST /api/documentation/scan
 * Scans a file for viruses and threats
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check if Cloudmersive is enabled via environment variable
    const cloudmersiveEnabled = process.env.ENABLE_CLOUDMERSIVE === 'true';

    if (!cloudmersiveEnabled) {
      console.info('[Virus Scan] Cloudmersive disabled via ENABLE_CLOUDMERSIVE env variable');
      // Return safe - scanning disabled
      return NextResponse.json({
        safe: true,
        threats: [],
        viruses: [],
        fileFormat: null,
        fileHash: null,
        scanSkipped: true,
        reason: 'Virus scanning disabled by administrator',
        securityProvider: 'Cloudmersive',
        securityProviderUrl: 'https://cloudmersive.com',
      });
    }

    const apiKey = process.env.CLOUDMERSIVE_API_KEY;

    if (!apiKey) {
      console.warn('[Virus Scan] CLOUDMERSIVE_API_KEY not set');
      // Return safe - not configured
      return NextResponse.json({
        safe: true,
        threats: [],
        viruses: [],
        fileFormat: null,
        fileHash: null,
        scanSkipped: true,
        reason: 'Virus scanning not configured',
        securityProvider: 'Cloudmersive',
        securityProviderUrl: 'https://cloudmersive.com',
      });
    }

    // Check file size (3.5MB limit for free tier)
    const fileSize = file.size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

    if (fileSize > MAX_FILE_SIZE) {
      console.warn(`[Virus Scan] File too large: ${fileSizeMB}MB (limit: 3.5MB)`);
      // Return safe - file too large for scanning
      return NextResponse.json({
        safe: true,
        threats: [],
        viruses: [],
        fileFormat: null,
        fileHash: null,
        scanSkipped: true,
        reason: `File size ${fileSizeMB}MB exceeds scanning limit of 3.5MB`,
        securityProvider: 'Cloudmersive',
        securityProviderUrl: 'https://cloudmersive.com',
      });
    }

    // Prepare FormData for Cloudmersive API
    const cloudmersiveFormData = new FormData();
    cloudmersiveFormData.append('inputFile', file, file.name);

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
      body: cloudmersiveFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Virus Scan] Cloudmersive API error:', response.status, errorText);

      // Handle specific Cloudmersive errors gracefully
      if (response.status === 413 || errorText.includes('file size')) {
        return NextResponse.json({
          safe: true,
          threats: [],
          viruses: [],
          fileFormat: null,
          fileHash: null,
          scanSkipped: true,
          reason: 'File size exceeds scanning service limits',
          securityProvider: 'Cloudmersive',
          securityProviderUrl: 'https://cloudmersive.com',
        });
      }

      // If API fails, fail securely - block the upload
      return NextResponse.json({
        safe: false,
        threats: ['scan_error'],
        threatLabels: ['Virus scan failed - unable to verify file safety'],
        viruses: [],
        fileFormat: null,
        fileHash: null,
        scanSkipped: false,
        securityProvider: 'Cloudmersive',
        securityProviderUrl: 'https://cloudmersive.com',
        error: `Scan service error: ${response.status}`,
      });
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

    console.log(`[Virus Scan] ${safe ? 'SAFE' : 'THREAT DETECTED'}: ${file.name}`);

    return NextResponse.json({
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
    });

  } catch (error) {
    console.error('[Virus Scan] Error:', error);

    // Fail securely: if scan fails, block the upload
    return NextResponse.json({
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
    });
  }
}
