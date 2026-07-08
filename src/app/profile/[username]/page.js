import clientPromise from '../../../lib/mongodb';
import React from 'react';

// Server side data fetching
async function getUserProfile(username) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    // Try matching messagingId first, then username case-insensitive
    let user = await db.collection('admin_users').findOne(
      { messagingId: username },
      { projection: { password: 0, sessionToken: 0 } }
    );
    
    if (!user) {
      user = await db.collection('admin_users').findOne(
        { username: { $regex: new RegExp(`^${username}$`, 'i') } },
        { projection: { password: 0, sessionToken: 0 } }
      );
    }
    
    if (user) {
      user._id = user._id.toString();
    }
    return user;
  } catch (err) {
    console.error('Error fetching user for web profile:', err);
    return null;
  }
}

export default async function ProfilePage({ params }) {
  const { username } = params;
  const user = await getUserProfile(username);

  const displayName = user?.name || user?.username || username;
  const targetId = user?.messagingId || user?.username || username;
  const deepLink = `upcheckerp://profile/${targetId}`;
  
  // Format initials
  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const initials = getInitials(displayName);

  // Client-side auto-redirect script (rendered safely)
  const redirectScript = `
    (function() {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        // Attempt deep link redirect
        window.location.href = "${deepLink}";
        
        // Show fallback download button if app doesn't open
        setTimeout(function() {
          const fallbackBtn = document.getElementById("fallback-action");
          if (fallbackBtn) fallbackBtn.style.display = "block";
        }, 2000);
      }
    })();
  `;

  return (
    <html lang="en">
      <head>
        <title>{displayName} | Upcheck Profile</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          body {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            background: radial-gradient(circle at top right, #0f172a, #020617);
            font-family: 'Outfit', sans-serif;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .card {
            background: rgba(30, 41, 59, 0.45);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            width: 100%;
            max-width: 420px;
            padding: 40px 30px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            box-sizing: border-box;
          }
          .avatar-container {
            display: flex;
            justify-content: center;
            margin-bottom: 24px;
          }
          .avatar {
            width: 96px;
            height: 96px;
            border-radius: 48px;
            object-fit: cover;
            border: 3px solid rgba(14, 165, 233, 0.4);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
          }
          .avatar-placeholder {
            width: 96px;
            height: 96px;
            border-radius: 48px;
            background: linear-gradient(135deg, #0ea5e9, #0284c7);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            font-weight: 700;
            color: #ffffff;
            border: 3px solid rgba(14, 165, 233, 0.4);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
          }
          h1 {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: #ffffff;
          }
          .role {
            font-size: 14px;
            color: #94a3b8;
            margin: 0 0 24px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 500;
          }
          .qr-box {
            background: #ffffff;
            padding: 16px;
            border-radius: 16px;
            display: inline-block;
            margin-bottom: 20px;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
          }
          .qr-img {
            display: block;
            width: 180px;
            height: 180px;
          }
          .instructions {
            font-size: 14px;
            color: #94a3b8;
            line-height: 20px;
            margin: 0 0 30px 0;
            padding: 0 10px;
          }
          .btn {
            display: block;
            width: 100%;
            background: linear-gradient(135deg, #0ea5e9, #0284c7);
            color: #ffffff;
            text-decoration: none;
            padding: 14px 20px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35);
            transition: transform 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(14, 165, 233, 0.5);
          }
          .btn:active {
            transform: translateY(0);
          }
          .fallback-btn {
            display: none;
            margin-top: 12px;
            background: transparent;
            border: 1px solid rgba(148, 163, 184, 0.3);
            color: #94a3b8;
            font-size: 14px;
            box-shadow: none;
          }
          .fallback-btn:hover {
            background: rgba(255, 255, 255, 0.03);
            box-shadow: none;
          }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="avatar-container">
            {user?.avatar ? (
              <img src={user.avatar.startsWith('http') ? user.avatar : `https://erp.upcheck.in${user.avatar}`} alt={displayName} className="avatar" />
            ) : (
              <div className="avatar-placeholder">{initials}</div>
            )}
          </div>
          <h1>{displayName}</h1>
          <p className="role">{user?.role || 'Team Member'}</p>

          <div className="qr-box">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(deepLink)}`}
              alt="Connect QR Code"
              className="qr-img"
            />
          </div>

          <p className="instructions">
            Scan this QR code with your phone camera or open the link directly on mobile to instantly view my profile in the Upcheck App.
          </p>

          <a href={deepLink} className="btn">Open in Upcheck App</a>
          
          <a href="https://expo.dev" id="fallback-action" className="btn fallback-btn">
            Need the App? Get Upcheck
          </a>
        </div>

        <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      </body>
    </html>
  );
}
