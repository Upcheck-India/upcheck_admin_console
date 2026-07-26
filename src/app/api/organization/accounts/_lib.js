// src/app/api/organization/accounts/_lib.js
//
// Shared helpers for the billing-account API routes. Two responsibilities:
//   1. sanitizeAccount(doc) — the ONLY shape any account leaves the server as.
//      It NEVER includes bank.accountNumberEnc (AES ciphertext) or
//      bank.accountNumberHash (HMAC fingerprint). Every GET/POST/PUT response
//      AND every audit before/after is routed through it, so the full account
//      number (and its reversible/comparable forms) can never be returned or
//      logged.
//   2. buildBankUpdate(input, existingBank, actor) — validates bank-detail
//      input and produces the persistable `bank` sub-document, deriving the four
//      accountNumber* fields ONLY via buildBankSecretFields. A blank account
//      number on edit keeps the existing encrypted value; metadata is updated in
//      place.
import { capString } from '../../../../lib/finance/auth';
import { FinanceError } from '../../../../lib/finance/tx';
import { normalizeCurrency } from '../../../../lib/finance/currency';
import {
  buildBankSecretFields,
  normalizeAccountNumber,
  financeCryptoConfigured,
} from '../../../../lib/finance/crypto';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_TYPES = ['savings', 'current', 'other'];

/**
 * Reduce a raw finance_accounts document to the safe, client/audit-facing shape.
 * Enc + hash are structurally excluded here — there is no code path that copies
 * them onto the returned object.
 */
export function sanitizeAccount(doc) {
  if (!doc) return null;
  const id = doc._id?.toString?.() || doc.id || null;
  const rawBank = doc.bank && typeof doc.bank === 'object' ? doc.bank : null;
  const hasBankDetails = !!(rawBank && rawBank.accountNumberHash);
  const bank = rawBank
    ? {
        bankName: rawBank.bankName || null,
        accountHolderName: rawBank.accountHolderName || null,
        branch: rawBank.branch || null,
        ifsc: rawBank.ifsc || null,
        accountType: rawBank.accountType || null,
        upiId: rawBank.upiId || null,
        accountNumberLast4: rawBank.accountNumberLast4 || null,
        accountNumberMasked: rawBank.accountNumberMasked || null,
        hasBankDetails,
        addedAt: rawBank.addedAt || null,
      }
    : null;
  return {
    _id: id,
    id,
    name: doc.name || null,
    currency: doc.currency || 'INR',
    bank,
    hasBankDetails,
    createdAt: doc.createdAt || null,
    createdBy: doc.createdBy || null,
    updatedAt: doc.updatedAt || null,
    updatedBy: doc.updatedBy || null,
    archivedAt: doc.archivedAt || null,
  };
}

/** Normalize + validate the base currency for an account (defaults to INR). */
export function resolveCurrency(raw) {
  return normalizeCurrency(raw, { def: 'INR' });
}

/**
 * Build the persistable `bank` sub-document from request input.
 *   input        — body.bank (raw, may include a plaintext accountNumber)
 *   existingBank — the account's current bank sub-doc (or null), used so a blank
 *                  account number on edit keeps the stored encrypted value
 *   actor        — actorFromUser(user), stamped as addedBy when a number is set
 * Returns the bank object, or null when there is nothing to store. Throws
 * FinanceError on invalid input or when a number is supplied but the server has
 * no encryption key configured (never stores a plaintext number as a fallback).
 */
export function buildBankUpdate(input, existingBank, actor) {
  if (!input || typeof input !== 'object') return null;

  const bankName = capString(input.bankName, 160);
  const accountHolderName = capString(input.accountHolderName, 160);
  const branch = capString(input.branch, 200);
  const upiId = capString(input.upiId, 120);

  const ifsc = capString(input.ifsc, 20).toUpperCase();
  if (ifsc && !IFSC_RE.test(ifsc)) {
    throw new FinanceError('Invalid IFSC code (expected format like SBIN0001234)', 400);
  }

  const accountType = capString(input.accountType, 20).toLowerCase();
  if (accountType && !ACCOUNT_TYPES.includes(accountType)) {
    throw new FinanceError('Invalid account type (expected savings, current or other)', 400);
  }

  const norm = normalizeAccountNumber(
    typeof input.accountNumber === 'string' ? input.accountNumber : ''
  );

  let secret = null;
  let numberReplaced = false;
  if (norm) {
    // A new/replacement number was supplied — must have a server key to encrypt.
    if (!financeCryptoConfigured()) {
      throw new FinanceError('Server encryption key (FINANCE_ENC_KEY) is not configured', 400);
    }
    secret = buildBankSecretFields(norm);
    numberReplaced = true;
  } else if (existingBank && existingBank.accountNumberHash) {
    // Blank number on edit — carry the existing encrypted value forward verbatim.
    secret = {
      accountNumberEnc: existingBank.accountNumberEnc,
      accountNumberHash: existingBank.accountNumberHash,
      accountNumberLast4: existingBank.accountNumberLast4,
      accountNumberMasked: existingBank.accountNumberMasked,
    };
  }

  const hasAnyMeta = !!(bankName || accountHolderName || branch || ifsc || accountType || upiId);
  if (!secret && !hasAnyMeta) return null; // nothing meaningful to store

  const bank = {
    bankName: bankName || null,
    accountHolderName: accountHolderName || null,
    branch: branch || null,
    ifsc: ifsc || null,
    accountType: accountType || null,
    upiId: upiId || null,
    addedAt: existingBank?.addedAt || new Date(),
    addedBy: existingBank?.addedBy || actor,
  };
  if (secret) {
    bank.accountNumberEnc = secret.accountNumberEnc;
    bank.accountNumberHash = secret.accountNumberHash;
    bank.accountNumberLast4 = secret.accountNumberLast4;
    bank.accountNumberMasked = secret.accountNumberMasked;
    if (numberReplaced) {
      bank.addedAt = new Date();
      bank.addedBy = actor;
    }
  }
  return bank;
}
