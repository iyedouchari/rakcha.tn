import React, { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;
    let width = (canvas.width = window.innerWidth * dpr);
    let height = (canvas.height = window.innerHeight * dpr);

    // Glowing drifting orbs (Deep Indigo, Subtle Violet, Soft Rose - Zero Green/Cyan)
    const orbs = [
      { x: width * 0.2, y: height * 0.2, r: 260 * dpr, color: 'rgba(99, 102, 241, 0.10)', vx: 0.15, vy: 0.1 },
      { x: width * 0.8, y: height * 0.3, r: 300 * dpr, color: 'rgba(244, 63, 94, 0.06)', vx: -0.12, vy: 0.15 },
      { x: width * 0.5, y: height * 0.8, r: 270 * dpr, color: 'rgba(99, 102, 241, 0.08)', vx: 0.1, vy: -0.12 },
      { x: width * 0.85, y: height * 0.75, r: 230 * dpr, color: 'rgba(139, 92, 246, 0.08)', vx: -0.1, vy: -0.1 }
    ];

    // Constellation / Stardust particles
    let particles = [];
    const particleCount = Math.min(45, Math.floor(window.innerWidth / 35));
    const colors = [
      'rgba(99, 102, 241, 0.45)',
      'rgba(139, 92, 246, 0.40)',
      'rgba(244, 63, 94, 0.25)',
      'rgba(255, 255, 255, 0.30)'
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: (Math.random() * 2 + 1) * dpr,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 0.35 * dpr,
        vy: (Math.random() - 0.5) * 0.35 * dpr,
        pulseSpeed: Math.random() * 0.015 + 0.008,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    let animationFrameId;
    let time = 0;

    const draw = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);

      // Deep solid slate background
      ctx.fillStyle = '#0B0E14';
      ctx.fillRect(0, 0, width, height);

      // Render Drifting Glowing Radial Gradient Orbs
      orbs.forEach((orb) => {
        orb.x += orb.vx;
        orb.y += orb.vy;

        if (orb.x < -orb.r) orb.x = width + orb.r;
        if (orb.x > width + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = height + orb.r;
        if (orb.y > height + orb.r) orb.y = -orb.r;

        const radial = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        radial.addColorStop(0, orb.color);
        radial.addColorStop(1, 'rgba(11, 14, 20, 0)');

        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Constellation & Stardust
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const alpha = Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.25 + 0.55;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0.1, alpha);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Subtle connection lines for nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          const maxDist = 120 * dpr;
          if (dist < maxDist) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${(0.07 * (1 - dist / maxDist))})`;
            ctx.lineWidth = 0.75 * dpr;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      dpr = window.devicePixelRatio || 1;
      width = canvas.width = window.innerWidth * dpr;
      height = canvas.height = window.innerHeight * dpr;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#0B0E14]">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block opacity-95"
      />
      {/* Stable, Subtle Ambient Glow Overlays (Zero Flashing / Pulsing) */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl mix-blend-screen" />
      <div className="absolute top-1/4 -right-40 w-96 h-96 bg-crimson/5 rounded-full blur-3xl mix-blend-screen" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-primary/8 rounded-full blur-3xl mix-blend-screen" />
    </div>
  );
}
