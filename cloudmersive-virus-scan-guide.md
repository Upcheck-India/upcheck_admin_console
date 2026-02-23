# Cloudmersive Virus Scan API — Full Implementation Guide for Next.js (DMS+VDR)

> Based on the official Cloudmersive API docs: https://api.cloudmersive.com/docs/virus.asp  
> API Endpoint: `https://api.cloudmersive.com`  
> Auth: API Key via `Apikey` header

---

## 1. Get Your Free API Key

1. Go to [https://cloudmersive.com](https://cloudmersive.com) and click **Sign Up**
2. After signing in, go to your **Dashboard → API Keys**
3. Copy your API key
4. Free tier gives you **800 API calls/month**

---

## 2. Set Up Environment Variable

Add to your `.env.local` (never commit this):

```env
CLOUDMERSIVE_API_KEY=your_api_key_here
```

Add to your `.gitignore` if not already:

```
.env.local
```

---

## 3. Two Scan Modes

Cloudmersive provides two endpoints. For a DMS+VDR, always use **Advanced Scan**.

| Mode | Endpoint | Use Case |
|---|---|---|
| Basic Scan | `POST /virus/scan/file` | Simple virus check only |
| **Advanced Scan** | `POST /virus/scan/file/advanced` | Full 360° threat detection — use this for DMS+VDR |

---

## 4. Basic Scan (Simple)

Only checks for viruses. Returns `CleanResult` (boolean) and `FoundViruses` array.

### Next.js API Route — `app/api/scan/basic/route.js`

```js
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const scanForm = new FormData();
    scanForm.append('inputFile', file);

    const res = await fetch('https://api.cloudmersive.com/virus/scan/file', {
      method: 'POST',
      headers: {
        'Apikey': process.env.CLOUDMERSIVE_API_KEY,
      },
      body: scanForm,
    });

    if (!res.ok) {
      return Response.json({ error: 'Scan service error' }, { status: 502 });
    }

    const result = await res.json();
    // result shape:
    // {
    //   "CleanResult": true,
    //   "FoundViruses": []
    // }

    return Response.json({
      clean: result.CleanResult,
      viruses: result.FoundViruses ?? [],
    });
  } catch (err) {
    return Response.json({ error: 'Internal error', detail: err.message }, { status: 500 });
  }
}
```

### Response Shape

```json
{
  "CleanResult": true,
  "FoundViruses": []
}
```

If a virus is found:

```json
{
  "CleanResult": false,
  "FoundViruses": [
    {
      "FileName": "malicious.pdf",
      "VirusName": "Eicar-Test-Signature"
    }
  ]
}
```

---

## 5. Advanced Scan (Recommended for DMS+VDR)

Full 360° Content Protection. Detects viruses AND additional threats:
- Executables hidden in documents
- Embedded macros (Word, Excel, PowerPoint)
- Scripts (PHP, Python, BAT, JS)
- Password-protected/encrypted files
- XML External Entity (XXE) attacks
- Insecure deserialization
- HTML with scripts (XSS)
- Unsafe archives (Zip Bombs)
- OLE embedded objects
- Unwanted automatic actions

### Advanced Scan Request Headers

All threat controls are passed as request **headers** (not body):

| Header | Type | Default | Description |
|---|---|---|---|
| `allowExecutables` | boolean | `false` | Block .exe, .dll, etc. |
| `allowInvalidFiles` | boolean | `false` | Block corrupted/fake files |
| `allowScripts` | boolean | `false` | Block PHP, Python, BAT, JS scripts |
| `allowPasswordProtectedFiles` | boolean | `false` | Block encrypted ZIPs, etc. |
| `allowMacros` | boolean | `false` | Block Word/Excel/PPT macros |
| `allowXmlExternalEntities` | boolean | `false` | Block XXE attacks |
| `allowInsecureDeserialization` | boolean | `false` | Block unsafe JSON/object files |
| `allowHtml` | boolean | `false` | Block HTML with scripts |
| `allowUnsafeArchives` | boolean | `false` | Block Zip Bombs |
| `allowOleEmbeddedObject` | boolean | `false` | Block OLE objects in Office files |
| `allowUnwantedAction` | boolean | `false` | Block auto-open/execute actions |
| `restrictFileTypes` | string | disabled | Comma-separated allowed extensions e.g. `.pdf,.docx,.png` |
| `fileName` | string | from file | Override the file name for scanning |

> **All defaults are `false` (blocked) — meaning maximum security out of the box.**

### Next.js API Route — `app/api/scan/advanced/route.js`

```js
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const scanForm = new FormData();
    scanForm.append('inputFile', file);

    const res = await fetch('https://api.cloudmersive.com/virus/scan/file/advanced', {
      method: 'POST',
      headers: {
        'Apikey': process.env.CLOUDMERSIVE_API_KEY,

        // Threat controls — all false = maximum security (recommended for DMS+VDR)
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

        // Only allow safe document types for a DMS+VDR
        // Adjust this list to match what your DMS accepts
        'restrictFileTypes': '.pdf,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.png,.jpg,.jpeg,.gif,.txt,.csv,.zip',
      },
      body: scanForm,
    });

    if (!res.ok) {
      return Response.json({ error: 'Scan service error' }, { status: 502 });
    }

    const result = await res.json();

    // Build a structured threat summary
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

    return Response.json({
      safe,
      threats,
      viruses: result.FoundViruses ?? [],
      fileFormat: result.VerifiedFileFormat ?? null,
      fileHash: result.ContentInformation?.Hash_SHA1 ?? null,
      rawResult: result, // remove this in production if you don't want to expose full result
    });

  } catch (err) {
    return Response.json({ error: 'Internal error', detail: err.message }, { status: 500 });
  }
}
```

### Advanced Scan Response Shape

```json
{
  "CleanResult": true,
  "ContainsExecutable": false,
  "ContainsInvalidFile": false,
  "ContainsScript": false,
  "ContainsPasswordProtectedFile": false,
  "ContainsRestrictedFileFormat": false,
  "ContainsMacros": false,
  "ContainsXmlExternalEntities": false,
  "ContainsInsecureDeserialization": false,
  "ContainsHtml": false,
  "ContainsUnsafeArchive": false,
  "ContainsOleEmbeddedObject": false,
  "ContainsUnwantedAction": false,
  "VerifiedFileFormat": "PDF",
  "FoundViruses": [],
  "ContentInformation": {
    "ContainsJSON": false,
    "ContainsXML": false,
    "ContainsImage": false,
    "Hash_SHA1": "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3",
    "RelevantSubfileName": null,
    "RelevantSubfileHash_SHA1": null,
    "IsAuthenticodeSigned": false
  }
}
```

---

## 6. React Upload Component with Scan

Full React component that uploads a file, scans it, and shows the result before allowing the upload to proceed.

### `components/SecureFileUpload.jsx`

```jsx
'use client';

import { useState } from 'react';

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

export default function SecureFileUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | scanning | safe | blocked | error
  const [scanResult, setScanResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setStatus('idle');
    setScanResult(null);
  };

  const handleScan = async () => {
    if (!file) return;

    setStatus('scanning');
    setScanResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/scan/advanced', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setScanResult(data);

      if (data.safe) {
        setStatus('safe');
      } else {
        setStatus('blocked');
      }
    } catch (err) {
      setStatus('error');
    }
  };

  const handleUpload = async () => {
    if (status !== 'safe' || !file) return;

    setUploading(true);
    try {
      // Your actual file upload logic here
      // e.g., upload to MongoDB GridFS, S3, etc.
      await onUploadSuccess?.(file, scanResult);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 border rounded-xl space-y-4 max-w-lg">
      <h2 className="text-lg font-semibold">Secure File Upload</h2>

      {/* File Picker */}
      <input
        type="file"
        onChange={handleFileChange}
        className="block w-full text-sm"
      />

      {/* Scan Button */}
      {file && status === 'idle' && (
        <button
          onClick={handleScan}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Scan for Threats
        </button>
      )}

      {/* Scanning State */}
      {status === 'scanning' && (
        <div className="flex items-center gap-2 text-blue-600">
          <span className="animate-spin">⏳</span>
          <span>Scanning file for threats...</span>
        </div>
      )}

      {/* Safe Result */}
      {status === 'safe' && scanResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
          <p className="text-green-700 font-medium">✅ File is clean — no threats detected</p>
          {scanResult.fileFormat && (
            <p className="text-sm text-gray-500">Verified format: {scanResult.fileFormat}</p>
          )}
          {scanResult.fileHash && (
            <p className="text-sm text-gray-400 font-mono">SHA1: {scanResult.fileHash}</p>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      )}

      {/* Blocked Result */}
      {status === 'blocked' && scanResult && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
          <p className="text-red-700 font-medium">🚫 File blocked — threats detected</p>
          <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
            {scanResult.threats.map((threat) => (
              <li key={threat}>{THREAT_LABELS[threat] ?? threat}</li>
            ))}
          </ul>
          {scanResult.viruses?.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-700">Viruses found:</p>
              {scanResult.viruses.map((v, i) => (
                <p key={i} className="text-sm text-red-600 font-mono">
                  {v.FileName} — {v.VirusName}
                </p>
              ))}
            </div>
          )}
          <button
            onClick={() => { setFile(null); setStatus('idle'); setScanResult(null); }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Remove File
          </button>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-700">⚠️ Scan service error. Please try again.</p>
        </div>
      )}
    </div>
  );
}
```

---

## 7. Scan a Website URL (Bonus)

Also useful in a VDR when users paste links in documents or comments.

### `app/api/scan/website/route.js`

```js
export async function POST(req) {
  const { url } = await req.json();

  if (!url) {
    return Response.json({ error: 'No URL provided' }, { status: 400 });
  }

  const res = await fetch('https://api.cloudmersive.com/virus/scan/website', {
    method: 'POST',
    headers: {
      'Apikey': process.env.CLOUDMERSIVE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ Url: url }),
  });

  const result = await res.json();
  // result shape:
  // {
  //   "CleanResult": true,
  //   "WebsiteThreatType": "None",   // None | Malware | Phishing | ForcedDownload | UnableToConnect
  //   "FoundViruses": [],
  //   "WebsiteHttpResponseCode": 200
  // }

  return Response.json({
    safe: result.CleanResult,
    threatType: result.WebsiteThreatType,
    httpCode: result.WebsiteHttpResponseCode,
  });
}
```

---

## 8. Restrict File Types for DMS+VDR

The `restrictFileTypes` header lets you whitelist only safe file types. Recommended list for a corporate DMS+VDR:

```
.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.zip,.rar
```

If a file doesn't match, `ContainsRestrictedFileFormat` will be `true` and `CleanResult` will be `false` — so it gets blocked automatically.

---

## 9. Full Advanced Response Fields Reference

| Field | Type | Description |
|---|---|---|
| `CleanResult` | boolean | `true` = no threats at all |
| `ContainsExecutable` | boolean | Executable/program code found |
| `ContainsInvalidFile` | boolean | File is corrupt or fake (e.g. fake PDF) |
| `ContainsScript` | boolean | PHP, Python, BAT, JS script found |
| `ContainsPasswordProtectedFile` | boolean | Encrypted/password-locked file |
| `ContainsMacros` | boolean | Word/Excel/PPT macros embedded |
| `ContainsXmlExternalEntities` | boolean | XXE attack vector found |
| `ContainsInsecureDeserialization` | boolean | Unsafe JSON/object serialization |
| `ContainsHtml` | boolean | HTML with possible XSS found |
| `ContainsUnsafeArchive` | boolean | Zip Bomb or dangerous archive |
| `ContainsOleEmbeddedObject` | boolean | OLE object embedded in Office file |
| `ContainsUnwantedAction` | boolean | Auto-open/auto-execute action present |
| `ContainsRestrictedFileFormat` | boolean | File type not in your allowed list |
| `VerifiedFileFormat` | string | Actual verified format (e.g. "PDF", "DOCX") |
| `FoundViruses` | array | List of `{ FileName, VirusName }` |
| `ContentInformation.Hash_SHA1` | string | SHA1 hash of the file |
| `ContentInformation.IsAuthenticodeSigned` | boolean | Has valid Authenticode signature |

---

## 10. Recommended Scan Policy for DMS+VDR

For a corporate DMS+VDR, the most secure policy is:

```js
// Block everything suspicious. Allow only clean, verified documents.
headers: {
  'allowExecutables': 'false',           // Never allow .exe in a document vault
  'allowInvalidFiles': 'false',          // Block corrupt/fake files
  'allowScripts': 'false',              // Block all scripts
  'allowPasswordProtectedFiles': 'false', // Block encrypted files (can't scan inside)
  'allowMacros': 'false',               // Block Word/Excel macros
  'allowXmlExternalEntities': 'false',  // Block XXE attacks
  'allowInsecureDeserialization': 'false',
  'allowHtml': 'false',                 // Block HTML uploads
  'allowUnsafeArchives': 'false',       // Block Zip Bombs
  'allowOleEmbeddedObject': 'false',    // Block OLE objects
  'allowUnwantedAction': 'false',       // Block auto-open actions
  'restrictFileTypes': '.pdf,.docx,.xlsx,.pptx,.txt,.csv,.png,.jpg,.jpeg',
}
```

> If your users need to upload password-protected files, set `allowPasswordProtectedFiles` to `'true'` — but note that Cloudmersive **cannot scan inside** encrypted files, so they pass through uninspected.

---

## 11. Free Tier Limits Summary

| Limit | Value |
|---|---|
| Cost | **$0.00/month** |
| Free API calls/month | **600** |
| Rate limit | **1 call/second** |
| Max file size | **3.5 MB per file** |
| API Analytics | ❌ Not included |
| Support | Limited |
| Data center | North America only |
| Plan type | Evaluation — no expiration |

> ⚠️ **3.5 MB file size limit** is the most important constraint for a DMS+VDR. Large PDFs, PowerPoints, or ZIP files exceeding 3.5 MB will be rejected by the API. If your users regularly upload larger files, you'll need to upgrade to a paid plan.

---

## 12. Quick Checklist

- [ ] Sign up at cloudmersive.com and get API key
- [ ] Add `CLOUDMERSIVE_API_KEY` to `.env.local`
- [ ] Add `.env.local` to `.gitignore`
- [ ] Create `app/api/scan/advanced/route.js`
- [ ] Use `SecureFileUpload` component in your DMS upload flow
- [ ] Set `restrictFileTypes` to match your DMS's allowed file types
- [ ] Test with a clean file → should return `safe: true`
- [ ] Test with EICAR test virus file → should return `safe: false` with virus name
