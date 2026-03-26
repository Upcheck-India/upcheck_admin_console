'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Lock, Coffee, Frown, ChevronRight, ChevronLeft, Key, Hand, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';

export default function Register() {
  const router = useRouter();
  const clerk = useClerk();
  const [currentPage, setCurrentPage] = useState(0);

  // Initialize the particles and shrimps background on component mount
  useEffect(() => {
    // Check if user has an active Clerk session (external user)
    // If so, redirect them to their dashboard
    if (clerk?.user) {
      router.push('/dataroom/external/dashboard');
      return;
    }

    if (typeof window !== 'undefined') {
      initParticlesAndShrimps();
    }
    return () => {
      // Clean up particles and shrimps when component unmounts
      if (typeof window !== 'undefined' && window.animationInstance) {
        window.animationInstance.destroy();
      }
    };
  }, []);

  // Function to initialize particles and shrimps (same as login page)
  const initParticlesAndShrimps = () => {
    if (!document.getElementById('particles-container')) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('particles-container');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    container.appendChild(canvas);
    
    // Load shrimp image
    const shrimpImage = new window.Image();
    shrimpImage.src = '/shrimp.png';
    
    // Particle class
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
    
    // Shrimp class
    class Shrimp {
      constructor() {
        this.width = 30;
        this.height = 20;
        // Start from random edge
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { // Top
          this.x = Math.random() * canvas.width;
          this.y = -this.height;
          this.speedX = (Math.random() - 0.5) * 2;
          this.speedY = Math.random() * 1 + 0.5;
        } else if (edge === 1) { // Right
          this.x = canvas.width + this.width;
          this.y = Math.random() * canvas.height;
          this.speedX = -(Math.random() * 1 + 0.5);
          this.speedY = (Math.random() - 0.5) * 2;
        } else if (edge === 2) { // Bottom
          this.x = Math.random() * canvas.width;
          this.y = canvas.height + this.height;
          this.speedX = (Math.random() - 0.5) * 2;
          this.speedY = -(Math.random() * 1 + 0.5);
        } else { // Left
          this.x = -this.width;
          this.y = Math.random() * canvas.height;
          this.speedX = Math.random() * 1 + 0.5;
          this.speedY = (Math.random() - 0.5) * 2;
        }
        this.alpha = 0;
        this.targetAlpha = 0.6 + Math.random() * 0.4;
        this.fadeSpeed = 0.01;
        this.rotation = Math.atan2(this.speedY, this.speedX);
        this.scaleX = this.speedX > 0 ? 1 : -1; // Flip based on direction
        this.wiggle = 0;
        this.wiggleSpeed = 0.1 + Math.random() * 0.1;
        this.wiggleAmount = 0.1 + Math.random() * 0.2;
        this.scared = false;
        this.scaredTime = 0;
        this.scale = 0.7 + Math.random() * 0.6;
      }
      
      update() {
        // Regular movement
        if (!this.scared) {
          this.x += this.speedX;
          this.y += this.speedY;
          
          // Natural wiggle movement
          this.wiggle += this.wiggleSpeed;
          this.rotation = Math.atan2(this.speedY, this.speedX) + Math.sin(this.wiggle) * this.wiggleAmount;
          this.scaleX = this.speedX > 0 ? 1 : -1;
        } else {
          // Scared movement (faster, erratic)
          this.x += this.speedX * 3;
          this.y += this.speedY * 3;
          
          // More erratic wiggle when scared
          this.wiggle += this.wiggleSpeed * 2;
          this.rotation = Math.atan2(this.speedY, this.speedX) + Math.sin(this.wiggle) * (this.wiggleAmount * 2);
          
          this.scaredTime++;
          if (this.scaredTime > 50) {
            this.scared = false;
            this.scaredTime = 0;
          }
        }
        
        // Fade in/out logic
        if (this.x < -100 || this.x > canvas.width + 100 || 
            this.y < -100 || this.y > canvas.height + 100) {
          this.alpha -= this.fadeSpeed;
          if (this.alpha <= 0) return true; // Remove this shrimp
        } else if (this.alpha < this.targetAlpha) {
          this.alpha += this.fadeSpeed;
        }
        
        return false; // Keep this shrimp
      }
      
      draw() {
        if (this.alpha <= 0) return;
        
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scaleX * this.scale, this.scale);
        
        // Draw semi-transparent white shrimp
        ctx.drawImage(shrimpImage, -this.width/2, -this.height/2, this.width, this.height);
        
        ctx.restore();
      }
      
      checkClick(mouseX, mouseY) {
        // Calculate distance from click to shrimp
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If click is close to shrimp, make it scared
        if (distance < 50) {
          this.scared = true;
          this.scaredTime = 0;
          
          // Change direction away from click
          const angle = Math.atan2(dy, dx);
          this.speedX = -Math.cos(angle) * (1 + Math.random());
          this.speedY = -Math.sin(angle) * (1 + Math.random());
          return true;
        }
        return false;
      }
    }
    
    // Create particles
    const particles = [];
    const particleCount = Math.min(100, window.innerWidth / 10);
    
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
    
    // Create shrimps
    const shrimps = [];
    const maxShrimps = 6; // Maximum number of shrimps at any time
    
    // Add click event listener for canvas
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Check each shrimp for collision with click
      let shrimpClicked = false;
      shrimps.forEach(shrimp => {
        if (shrimp.checkClick(mouseX, mouseY)) {
          shrimpClicked = true;
        }
      });
      
      // If no shrimp was clicked, spawn a new one at click position
      if (!shrimpClicked && shrimps.length < maxShrimps + 2) {
        const newShrimp = new Shrimp();
        newShrimp.x = mouseX;
        newShrimp.y = mouseY;
        // Set random direction
        const angle = Math.random() * Math.PI * 2;
        newShrimp.speedX = Math.cos(angle) * (1 + Math.random());
        newShrimp.speedY = Math.sin(angle) * (1 + Math.random());
        newShrimp.alpha = 0.8;
        shrimps.push(newShrimp);
      }
    });
    
    // Animation function
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw and update particles
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
      
      // Draw connections between particles
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
      
      // Add new shrimps randomly, but maintain maximum count
      if (shrimps.length < maxShrimps && Math.random() < 0.01) {
        shrimps.push(new Shrimp());
      }
      
      // Draw and update shrimps
      for (let i = shrimps.length - 1; i >= 0; i--) {
        const shouldRemove = shrimps[i].update();
        shrimps[i].draw();
        
        if (shouldRemove) {
          shrimps.splice(i, 1);
        }
      }
      
      requestAnimationFrame(animate);
    }
    
    // Handle resize
    function handleResize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', handleResize);
    
    // Start animation
    shrimpImage.onload = () => {
      animate();
    };
    
    // Store reference for cleanup
    window.animationInstance = { 
      destroy: () => {
        window.removeEventListener('resize', handleResize);
        container.removeChild(canvas);
      }
    };
  };

  // Content for each page
  const pages = [
    // Page 1: Introduction
    <div key="intro" className="space-y-6">
      <div className="flex items-center justify-center">
        <div className="bg-yellow-400/20 p-3 rounded-full">
          <Hand className="text-yellow-300" size={32} />
        </div>
      </div>
      
      <h3 className="text-center text-l font-bold text-white">Woah Woah, wait a minute!</h3>
      
      <div className="space-y-4 text-center text-blue-100">
        <p>
          This isn't like signing up for yet another social media platform to share pictures of your lunch. 🍱
        </p>
        
        <div className="bg-white/5 p-4 rounded-lg border border-white/10 my-4">
          <p className="text-lg font-medium text-yellow-200 flex items-center justify-center gap-2">
            <Lock size={18} />
            Exclusive Access Only
          </p>
          <p className="mt-2 text-sm">
            The Upcheck India Dashboard is strictly for authorized team members only.
          </p>
        </div>
      </div>
    </div>,
    
    // Page 2: Humor
    <div key="humor" className="space-y-6">
      <h3 className="text-center text-l font-bold text-white">🙆‍♂️ Plot Twist!</h3>
      <div className="space-y-4 text-center text-blue-100">
        <p>
          If you're looking for cat videos, you've taken a wrong turn at the internet. <Frown className="inline-block" size={16} />
        </p>
        
        <p className="italic text-sm text-blue-200/70">
          "With great dashboard access comes great responsibility."
          <br />
          <span className="text-xs">- Probably someone important at Upcheck</span>
        </p>
      </div>
    </div>,
    
    // Page 3: Instructions
    <div key="instructions" className="space-y-6">
      <h3 className="text-center text-l font-bold text-white">If you are a member then you can...</h3>
      <div className="space-y-4 text-center text-blue-100">
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <p className="text-base">
            Contact your friendly administrator with:
          </p>
          <ul className="text-sm mt-2 space-y-1 text-left pl-6 list-disc">
            <li>Your full name (the one on your ID, not your gaming handle)</li>
            <li>Your work email (sorry, no hotmail accounts from 2003)</li>
            <li>Your department ("Chief Meme Officer" is not a department)</li>
            <li>A cup of coffee wouldn't hurt either <Coffee className="inline-block" size={14} /></li>
          </ul>
        </div>
        
        <p className="text-xs text-center text-blue-200/50 mt-4">
          P.S. The shrimps in the background are just for fun. They don't grant access either.
        </p>
      </div>
    </div>
  ];

  return (
    <ClerkProvider>
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-teal-500 to-green-600 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Particles and shrimps background */}
      <div id="particles-container" className="absolute inset-0 z-0"></div>
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/30 z-0"></div>

      <div className="max-w-md w-full space-y-8 z-10">
        <div className="space-y-4">
          <div className="text-center animate-fadeIn opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            {/* Logo with hover effect */}
            <div className="flex justify-center mb-4 logo-container">
              <div className="relative w-24 h-24 transform transition-transform duration-500 hover:scale-110 logo-glow">
                <Image 
                  src="/Upcheck_logo_thumbnail.png" 
                  alt="Organization Logo" 
                  layout="fill"
                  objectFit="contain"
                  className="drop-shadow-lg transition-all duration-300"
                />
              </div>
            </div>
            
            <h1 className="mt-3 text-center text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 tracking-tight hover-title">
              Upcheck
            </h1>
            <h2 className="text-center text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-teal-200 mt-2 hover-subtitle">
              Registration Portal
            </h2>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/10 p-8 rounded-2xl shadow-2xl border border-white/20 transition-all duration-500 animate-fadeIn opacity-0 hover:shadow-blue-500/20 hover:border-blue-300/30" 
             style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
          
          {/* Current page content */}
          {pages[currentPage]}
          
          {/* Navigation */}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className={`flex items-center px-3 py-2 rounded-lg text-sm ${currentPage === 0 ? 'text-blue-300/30 cursor-not-allowed' : 'text-blue-300 hover:text-blue-100 hover:bg-white/10'}`}
            >
              <ChevronLeft size={16} className="mr-1" />
              Previous
            </button>
            
            <div className="flex space-x-1">
              {pages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPage(index)}
                  className={`w-2 h-2 rounded-full ${currentPage === index ? 'bg-blue-300' : 'bg-blue-300/30'}`}
                  aria-label={`Go to page ${index + 1}`}
                />
              ))}
            </div>
            
            {currentPage < pages.length - 1 ? (
              <button
                onClick={() => setCurrentPage(prev => Math.min(pages.length - 1, prev + 1))}
                className="flex items-center px-3 py-2 rounded-lg text-sm text-blue-300 hover:text-blue-100 hover:bg-white/10"
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </button>
            ) : (
              <Link 
                href="/login" 
                className="flex items-center px-3 py-2 rounded-lg text-sm text-blue-300 hover:text-blue-100 hover:bg-white/10"
              >
                Login
                <ArrowRight size={16} className="ml-1" />
              </Link>
            )}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .bg-gradient-radial {
          background-image: radial-gradient(var(--tw-gradient-stops));
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }
        
        /* Logo glow effect */
        .logo-glow {
          filter: drop-shadow(0 0 8px rgba(0, 200, 255, 0.3));
          transition: filter 0.5s ease, transform 0.5s ease;
        }
        
        .logo-glow:hover {
          filter: drop-shadow(0 0 15px rgba(0, 200, 255, 0.8));
        }
        
        /* Title hover effects */
        .hover-title {
          position: relative;
          transition: all 0.3s ease;
        }
        
        .hover-title:hover {
          text-shadow: 0 0 15px rgba(0, 200, 255, 0.8);
          letter-spacing: 0.5px;
        }
        
        .hover-subtitle {
          transition: all 0.3s ease;
        }
        
        .hover-subtitle:hover {
          text-shadow: 0 0 10px rgba(128, 255, 212, 0.8);
          letter-spacing: 0.3px;
        }
      `}</style>
    </div>
    </ClerkProvider>
  );
}
