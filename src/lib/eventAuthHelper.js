import clientPromise from './mongodb';

/**
 * Retrieves an admin user from the session token stored in a cookie.
 * Returns null if the token is missing or invalid.
 *
 * @param {string|undefined} token - The value of the admin_token cookie.
 * @returns {Promise<Object|null>} The user document (projected fields only) or null.
 */
export async function getUserFromToken(token) {
    if (!token) return null;

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne(
        { sessionToken: token },
        {
            projection: {
                _id: 1,
                email: 1,
                name: 1,
                role: 1,
            }
        }
    );

    return user;
}
