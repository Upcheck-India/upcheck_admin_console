export const checkUserRole = async (req) => {
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL || ''}/api/auth/session`);
    const session = await res.json();
    
    if (!session?.user) {
      return { hasAccess: false, user: null };
    }
    
    const hasAccess = ['admin', 'console_admin'].includes(session.user.role);
    return { hasAccess, user: session.user };
  } catch (error) {
    console.error('Error checking user role:', error);
    return { hasAccess: false, user: null };
  }
};

export const withConsoleAdminAuth = (handler) => {
  return async (req, res) => {
    const { hasAccess, user } = await checkUserRole(req);
    
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return handler(req, res, user);
  };
};
