'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Loader2, RotateCcw, Sparkle, Fingerprint, KeyRound } from 'lucide-react';
import { AlertMessage } from "../components/AlertMessage";
import Link from 'next/link';
import Image from 'next/image';
import { useClerk } from '@clerk/nextjs';
import { authenticateWithPasskey, isWebAuthnSupported } from '../../lib/webauthnClient';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [alert, setAlert] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const clerk = useClerk();

  const [redirectUrl, setRedirectUrl] = useState('');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  useEffect(() => {
    setPasskeySupported(isWebAuthnSupported());
  }, []);

  useEffect(() => {
    setMounted(true);

    // Check for redirect URL in query params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (redirect) {
        setRedirectUrl(decodeURIComponent(redirect));
      }
      initParticlesAndShrimps();
    }
    
    const checkAutoFill = () => {
      const usernameInput = document.querySelector('input[type="text"]');
      const passwordInput = document.querySelector('input[type="password"]');
      
      if (usernameInput && usernameInput.value && !username) {
        setUsername(usernameInput.value);
      }
      
      if (passwordInput && passwordInput.value && !password) {
        setPassword(passwordInput.value);
      }
    };
    
    checkAutoFill();
    setTimeout(checkAutoFill, 500);
    
    return () => {
      if (typeof window !== 'undefined' && window.animationInstance) {
        window.animationInstance.destroy();
      }
    };
  }, []);

  const initParticlesAndShrimps = () => {
    if (!document.getElementById('particles-container')) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('particles-container');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    container.appendChild(canvas);
    
    const shrimpImage = new window.Image();
    shrimpImage.src = '/shrimp.png';
    
    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.color = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
      }
      
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
      }
      
      draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    class Shrimp {
      constructor() {
        this.width = 30;
        this.height = 20;
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) {
          this.x = Math.random() * canvas.width;
          this.y = -this.height;
          this.speedX = (Math.random() - 0.5) * 2;
          this.speedY = Math.random() * 1 + 0.5;
        } else if (edge === 1) {
          this.x = canvas.width + this.width;
          this.y = Math.random() * canvas.height;
          this.speedX = -(Math.random() * 1 + 0.5);
          this.speedY = (Math.random() - 0.5) * 2;
        } else if (edge === 2) {
          this.x = Math.random() * canvas.width;
          this.y = canvas.height + this.height;
          this.speedX = (Math.random() - 0.5) * 2;
          this.speedY = -(Math.random() * 1 + 0.5);
        } else {
          this.x = -this.width;
          this.y = Math.random() * canvas.height;
          this.speedX = Math.random() * 1 + 0.5;
          this.speedY = (Math.random() - 0.5) * 2;
        }
        this.alpha = 0;
        this.targetAlpha = 0.6 + Math.random() * 0.4;
        this.fadeSpeed = 0.01;
        this.rotation = Math.atan2(this.speedY, this.speedX);
        this.scaleX = this.speedX > 0 ? 1 : -1;
        this.wiggle = 0;
        this.wiggleSpeed = 0.1 + Math.random() * 0.1;
        this.wiggleAmount = 0.1 + Math.random() * 0.2;
        this.scared = false;
        this.scaredTime = 0;
        this.scale = 0.7 + Math.random() * 0.6;
      }
      
      update() {
        if (!this.scared) {
          this.x += this.speedX;
          this.y += this.speedY;
          this.wiggle += this.wiggleSpeed;
          this.rotation = Math.atan2(this.speedY, this.speedX) + Math.sin(this.wiggle) * this.wiggleAmount;
          this.scaleX = this.speedX > 0 ? 1 : -1;
        } else {
          this.x += this.speedX * 3;
          this.y += this.speedY * 3;
          this.wiggle += this.wiggleSpeed * 2;
          this.rotation = Math.atan2(this.speedY, this.speedX) + Math.sin(this.wiggle) * (this.wiggleAmount * 2);
          this.scaredTime++;
          if (this.scaredTime > 50) {
            this.scared = false;
            this.scaredTime = 0;
          }
        }
        
        if (this.x < -100 || this.x > canvas.width + 100 || 
            this.y < -100 || this.y > canvas.height + 100) {
          this.alpha -= this.fadeSpeed;
          if (this.alpha <= 0) return true;
        } else if (this.alpha < this.targetAlpha) {
          this.alpha += this.fadeSpeed;
        }
        
        return false;
      }
      
      draw() {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scaleX * this.scale, this.scale);
        ctx.drawImage(shrimpImage, -this.width/2, -this.height/2, this.width, this.height);
        ctx.restore();
      }
      
      checkClick(mouseX, mouseY) {
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 50) {
          this.scared = true;
          this.scaredTime = 0;
          const angle = Math.atan2(dy, dx);
          this.speedX = -Math.cos(angle) * (1 + Math.random());
          this.speedY = -Math.sin(angle) * (1 + Math.random());
          return true;
        }
        return false;
      }
    }
    
    const particles = [];
    const particleCount = Math.min(100, window.innerWidth / 10);
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
    
    const shrimps = [];
    const maxShrimps = 6;
    
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      let shrimpClicked = false;
      shrimps.forEach(shrimp => {
        if (shrimp.checkClick(mouseX, mouseY)) {
          shrimpClicked = true;
        }
      });
      if (!shrimpClicked && shrimps.length < maxShrimps + 2) {
        const newShrimp = new Shrimp();
        newShrimp.x = mouseX;
        newShrimp.y = mouseY;
        const angle = Math.random() * Math.PI * 2;
        newShrimp.speedX = Math.cos(angle) * (1 + Math.random());
        newShrimp.speedY = Math.sin(angle) * (1 + Math.random());
        newShrimp.alpha = 0.8;
        shrimps.push(newShrimp);
      }
    });
    
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * (1 - distance / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
      if (shrimps.length < maxShrimps && Math.random() < 0.01) {
        shrimps.push(new Shrimp());
      }
      for (let i = shrimps.length - 1; i >= 0; i--) {
        const shouldRemove = shrimps[i].update();
        shrimps[i].draw();
        if (shouldRemove) {
          shrimps.splice(i, 1);
        }
      }
      requestAnimationFrame(animate);
    }
    
    function handleResize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', handleResize);
    shrimpImage.onload = () => { animate(); };
    window.animationInstance = { 
      destroy: () => {
        window.removeEventListener('resize', handleResize);
        container.removeChild(canvas);
      }
    };
  };

  // Shared post-authentication step: confirm the session, drop any external
  // (Clerk) session, then redirect into the console.
  const finishLogin = async () => {
    localStorage.setItem('username', username);
    const checkAuth = await fetch('/api/auth/check', { credentials: 'include' });
    if (!checkAuth.ok) {
      throw new Error('Authentication failed');
    }
    if (clerk?.user) {
      await clerk.signOut({ redirectUrl: '/login' });
    }
    const destination = redirectUrl || '/console';
    router.push(destination);
    router.refresh();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setAlert({ type: 'error', message: 'Please fill in all fields' });
      return;
    }
    try {
      setIsLoading(true);
      setAlert({ type: 'loading', message: 'Authenticating...' });
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlert({ type: 'success', message: 'Login successful!' });
        await finishLogin();
      } else {
        setAlert({ type: 'error', message: data.error || 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setAlert({ type: 'error', message: 'Server error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!username) {
      setAlert({ type: 'error', message: 'Enter your username, then sign in with your passkey' });
      return;
    }
    try {
      setIsPasskeyLoading(true);
      setAlert({ type: 'loading', message: 'Waiting for your passkey...' });
      await authenticateWithPasskey(username);
      setAlert({ type: 'success', message: 'Login successful!' });
      await finishLogin();
    } catch (error) {
      console.error('Passkey login error:', error);
      const message = error?.name === 'NotAllowedError'
        ? 'Passkey prompt was cancelled or timed out.'
        : (error.message || 'Passkey sign-in failed.');
      setAlert({ type: 'error', message });
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleBackupCodeLogin = async (e) => {
    e.preventDefault();
    if (!username || !backupCode) {
      setAlert({ type: 'error', message: 'Enter your username and a backup code' });
      return;
    }
    try {
      setIsBackupLoading(true);
      setAlert({ type: 'loading', message: 'Verifying backup code...' });
      const res = await fetch('/api/auth/backup-codes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, code: backupCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlert({ type: 'success', message: 'Login successful!' });
        setBackupCode('');
        await finishLogin();
      } else {
        setAlert({ type: 'error', message: data.error || 'Invalid backup code' });
      }
    } catch (error) {
      console.error('Backup code login error:', error);
      setAlert({ type: 'error', message: 'Server error. Please try again.' });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const anyLoading = isLoading || isPasskeyLoading || isBackupLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-teal-500 to-green-600 flex items-center justify-center p-4 overflow-hidden relative">
      <div id="particles-container" className="absolute inset-0 z-0"></div>
      <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/30 z-0"></div>
      <div className="max-w-md w-full space-y-8 z-10">
        <div className="space-y-4">
          <div className="text-center animate-fadeIn opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            <div className="flex justify-center mb-4 logo-container">
              <div className="relative w-24 h-24 transform transition-transform duration-500 hover:scale-110 logo-glow">
                <Image src="/Upcheck_logo_thumbnail.png" alt="Organization Logo" layout="fill" objectFit="contain" className="drop-shadow-lg transition-all duration-300" />
              </div>
            </div>
            <h1 className="mt-3 text-center text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 tracking-tight hover-title">Upcheck</h1>
            <h2 className="text-center text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-teal-200 mt-2 hover-subtitle">Official Dashboard</h2>
            <p className="text-center text-lg text-blue-100/80 mt-3">Enter your credentials to access</p>
          </div>
        </div>
        <div className="backdrop-blur-xl bg-white/10 p-8 rounded-2xl shadow-2xl border border-white/20 transition-all duration-500 animate-fadeIn opacity-0 hover:shadow-blue-500/20 hover:border-blue-300/30" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group overflow-hidden rounded-lg">
                <User className="absolute top-3 left-3 text-blue-300 transition-colors duration-300 group-hover:text-white z-10" size={20} />
                <input type="text" name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} onAnimationStart={(e) => { if (e.animationName === 'onAutoFillStart' && e.target.value && !username) { setUsername(e.target.value); } }} placeholder="Username" disabled={isLoading} className="pl-10 w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200/70 transition-all duration-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed z-0 relative autofill:bg-white/20 autofill:text-white" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/10 group-hover:via-blue-500/20 group-hover:to-blue-500/10 transition-all duration-700 transform -translate-x-full group-hover:translate-x-0 pointer-events-none"></div>
              </div>
              <div className="relative group overflow-hidden rounded-lg">
                <Lock className="absolute top-3 left-3 text-blue-300 transition-colors duration-300 group-hover:text-white z-10" size={20} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" disabled={isLoading} className="pl-10 w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200/70 transition-all duration-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed z-0 relative" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/10 group-hover:via-blue-500/20 group-hover:to-blue-500/10 transition-all duration-700 transform -translate-x-full group-hover:translate-x-0 pointer-events-none"></div>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 overflow-hidden transition-all duration-300 shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none group">
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center justify-center gap-2">{isLoading ? (<><Loader2 className="animate-spin" size={20} />Signing in...</>) : ('Sign in')}</span>
            </button>

            {/* Passwordless / recovery options */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/20"></div>
                <span className="text-xs text-blue-100/70">or</span>
                <div className="flex-1 h-px bg-white/20"></div>
              </div>

              {passkeySupported && (
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={anyLoading}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-white/30 rounded-lg text-sm font-medium text-white bg-white/5 hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPasskeyLoading ? <Loader2 className="animate-spin" size={18} /> : <Fingerprint size={18} />}
                  Sign in with passkey
                </button>
              )}

              {!showBackupCode ? (
                <button
                  type="button"
                  onClick={() => setShowBackupCode(true)}
                  disabled={anyLoading}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-white/30 rounded-lg text-sm font-medium text-white bg-white/5 hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <KeyRound size={18} />
                  Use a backup code
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <KeyRound className="absolute top-3 left-3 text-blue-300 z-10" size={18} />
                    <input
                      type="text"
                      value={backupCode}
                      onChange={(e) => setBackupCode(e.target.value)}
                      placeholder="Backup code (e.g. ABCDE-FGHJK)"
                      autoComplete="one-time-code"
                      disabled={anyLoading}
                      className="pl-10 w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200/70 transition-all duration-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white/20 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleBackupCodeLogin}
                      disabled={anyLoading}
                      className="flex-1 flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBackupLoading ? <Loader2 className="animate-spin" size={18} /> : 'Verify code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowBackupCode(false); setBackupCode(''); }}
                      disabled={anyLoading}
                      className="py-2.5 px-4 rounded-lg text-sm font-medium text-blue-100 bg-white/5 hover:bg-white/10 transition-all duration-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/*}<div className="flex flex-col items-center space-y-2 pt-2">
              <Link href="/legacy_login" className="inline-flex items-center text-xs text-blue-200 hover:text-blue-100 transition-colors duration-300"><RotateCcw size={12} className="mr-1" />Use legacy login</Link>
              <Link href="/register" className="inline-flex items-center text-xs text-blue-200 hover:text-blue-100 transition-colors duration-300"><Sparkle size={12} className="mr-1" />Wanna create a new account?</Link>
            </div>{*/}
            <div className="mt-6 pt-6 border-t border-white/20">              <div className="flex flex-col space-y-2">
                <Link href="/dataroom/external/login" className="w-full py-2.5 px-4 border border-white/30 rounded-lg text-sm font-medium text-white bg-white/5 hover:bg-white/10 transition-all duration-300 text-center">Login/Register as External User</Link>              </div>
            </div>
          </form>
        </div>
      </div>
      {alert && (<AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />)}
      <style jsx>{`
        .bg-gradient-radial { background-image: radial-gradient(var(--tw-gradient-stops)); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.8s ease-out; }
        .logo-glow { filter: drop-shadow(0 0 8px rgba(0, 200, 255, 0.3)); transition: filter 0.5s ease, transform 0.5s ease; }
        .logo-glow:hover { filter: drop-shadow(0 0 15px rgba(0, 200, 255, 0.8)); }
        .hover-title { position: relative; transition: all 0.3s ease; }
        .hover-title:hover { text-shadow: 0 0 15px rgba(0, 200, 255, 0.8); letter-spacing: 0.5px; }
        .hover-subtitle { transition: all 0.3s ease; }
        .hover-subtitle:hover { text-shadow: 0 0 10px rgba(128, 255, 212, 0.8); letter-spacing: 0.3px; }
      `}</style>
    </div>
  );
}
