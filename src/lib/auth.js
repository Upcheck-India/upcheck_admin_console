import crypto from 'crypto';

/**
 * Hashes a plain text password using the crypto module.
 * @param {string} password - The plain text password to hash.
 * @returns {Promise<string>} - The hashed password.
 */
export const hashPassword = async (password) => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
};
