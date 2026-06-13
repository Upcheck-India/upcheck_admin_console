// Shared helpers for the Employee Records module: document categories,
// personal/statutory profile fields, and validators. Kept framework-agnostic
// so both API routes and (where useful) client code can import the constants.

// Categories for the employee document vault.
export const DOCUMENT_CATEGORIES = [
  'contract',
  'id_proof',
  'address_proof',
  'education',
  'payslip',
  'tax',
  'offer_letter',
  'certificate',
  'other',
];

export const DOCUMENT_CATEGORY_LABELS = {
  contract: 'Contract',
  id_proof: 'ID Proof',
  address_proof: 'Address Proof',
  education: 'Education',
  payslip: 'Payslip',
  tax: 'Tax',
  offer_letter: 'Offer Letter',
  certificate: 'Certificate',
  other: 'Other',
};

// Max upload size for a single HR document (10 MB).
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];
export const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed', 'other'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Personal (non-sensitive) profile fields an employee may edit on their own
// record. Statutory/financial fields are handled separately.
export const PERSONAL_STRING_FIELDS = [
  'personalEmail',
  'personalPhone',
  'gender',
  'maritalStatus',
  'bloodGroup',
  'nationality',
];

// Statutory + financial fields (India). Sensitive — editing on someone else's
// record requires the `users.manage` permission.
export const STATUTORY_STRING_FIELDS = [
  'panNumber',
  'aadhaarNumber',
  'uanNumber',
  'pfNumber',
  'esiNumber',
];

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^[0-9]{12}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate and normalise an incoming profile patch. Returns
// { set, errors } where `set` is a flat object of validated fields to $set.
// `includeStatutory` controls whether sensitive fields are accepted.
export function buildProfilePatch(data, { includeStatutory }) {
  const set = {};
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { set, errors: ['Invalid body'] };
  }

  const trimStr = (v) => (typeof v === 'string' ? v.trim() : '');

  // Simple personal string fields.
  for (const f of PERSONAL_STRING_FIELDS) {
    if (data[f] === undefined) continue;
    const v = trimStr(data[f]);
    if (f === 'gender' && v && !GENDERS.includes(v)) { errors.push('Invalid gender'); continue; }
    if (f === 'maritalStatus' && v && !MARITAL_STATUSES.includes(v)) { errors.push('Invalid marital status'); continue; }
    if (f === 'bloodGroup' && v && !BLOOD_GROUPS.includes(v)) { errors.push('Invalid blood group'); continue; }
    if (f === 'personalEmail' && v && !EMAIL_RE.test(v)) { errors.push('Invalid personal email'); continue; }
    set[f] = v;
  }

  // Date of birth.
  if (data.dateOfBirth !== undefined) {
    const v = trimStr(data.dateOfBirth);
    if (!v) {
      set.dateOfBirth = null;
    } else {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) errors.push('Invalid date of birth');
      else set.dateOfBirth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
  }

  // Nested address.
  if (data.address !== undefined && data.address !== null) {
    const a = data.address || {};
    set.address = {
      line1: trimStr(a.line1),
      line2: trimStr(a.line2),
      city: trimStr(a.city),
      state: trimStr(a.state),
      pincode: trimStr(a.pincode),
      country: trimStr(a.country) || 'India',
    };
  }

  // Nested emergency contact.
  if (data.emergencyContact !== undefined && data.emergencyContact !== null) {
    const e = data.emergencyContact || {};
    if (e.phone && !/^[0-9+\-\s]{6,20}$/.test(trimStr(e.phone))) {
      errors.push('Invalid emergency contact phone');
    } else {
      set.emergencyContact = {
        name: trimStr(e.name),
        relationship: trimStr(e.relationship),
        phone: trimStr(e.phone),
      };
    }
  }

  if (includeStatutory) {
    for (const f of STATUTORY_STRING_FIELDS) {
      if (data[f] === undefined) continue;
      const v = trimStr(data[f]).toUpperCase();
      if (f === 'panNumber' && v && !PAN_RE.test(v)) { errors.push('Invalid PAN (format ABCDE1234F)'); continue; }
      if (f === 'aadhaarNumber' && v && !AADHAAR_RE.test(v.replace(/\s/g, ''))) { errors.push('Invalid Aadhaar (12 digits)'); continue; }
      set[f] = v;
    }

    if (data.bankDetails !== undefined && data.bankDetails !== null) {
      const b = data.bankDetails || {};
      const ifsc = trimStr(b.ifsc).toUpperCase();
      if (ifsc && !IFSC_RE.test(ifsc)) {
        errors.push('Invalid IFSC code');
      } else {
        set.bankDetails = {
          accountName: trimStr(b.accountName),
          accountNumber: trimStr(b.accountNumber),
          ifsc,
          bankName: trimStr(b.bankName),
        };
      }
    }
  }

  return { set, errors };
}

// Fields returned as the HR "profile" view of an employee.
export const PROFILE_PROJECTION = {
  username: 1,
  email: 1,
  firstName: 1,
  lastName: 1,
  role: 1,
  department: 1,
  jobTitle: 1,
  employmentType: 1,
  employmentStatus: 1,
  phone: 1,
  location: 1,
  startDate: 1,
  managerId: 1,
  // personal
  personalEmail: 1,
  personalPhone: 1,
  dateOfBirth: 1,
  gender: 1,
  maritalStatus: 1,
  bloodGroup: 1,
  nationality: 1,
  address: 1,
  emergencyContact: 1,
  // statutory / financial
  panNumber: 1,
  aadhaarNumber: 1,
  uanNumber: 1,
  pfNumber: 1,
  esiNumber: 1,
  bankDetails: 1,
};
