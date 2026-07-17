/**
 * Dashboard Premium — Shared JS Interactions
 * Photo studio vibe animations & premium UX
 */

(function() {
    'use strict';

    const DashboardPremium = {

        /**
         * Initialize all premium features
         */
        init() {
            this.initCountUp();
            this.initBokehParticles();
            this.initStaggerAnimations();
            this.initShutterEffect();
            this.initGreeting();
        },

        /**
         * Count-up animation for stat values
         * Animates numbers from 0 to their actual value
         */
        initCountUp() {
            const statValues = document.querySelectorAll('.stat-value[data-count]');
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        const target = parseInt(el.getAttribute('data-count'), 10);
                        this.animateCount(el, 0, target, 1200);
                        observer.unobserve(el);
                    }
                });
            }, { threshold: 0.3 });

            statValues.forEach(el => observer.observe(el));
        },

        /**
         * Animate a number from start to end
         */
        animateCount(element, start, end, duration) {
            const startTime = performance.now();
            const prefix = element.getAttribute('data-prefix') || '';
            const suffix = element.getAttribute('data-suffix') || '';

            const easeOutExpo = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

            const step = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeOutExpo(progress);
                const current = Math.floor(start + (end - start) * easedProgress);
                
                element.textContent = prefix + current.toLocaleString() + suffix;

                if (progress < 1) {
                    requestAnimationFrame(step);
                }
            };

            requestAnimationFrame(step);
        },

        /**
         * Bokeh particle system for hero section
         * Creates floating light orbs for a photo studio atmosphere
         */
        initBokehParticles() {
            const container = document.querySelector('.hero-particles');
            if (!container) return;

            const particleCount = 8;

            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'hero-particle';

                const size = Math.random() * 40 + 15;
                const x = Math.random() * 100;
                const y = Math.random() * 100;
                const duration = Math.random() * 6 + 6;
                const delay = Math.random() * 4;
                const dx = (Math.random() - 0.5) * 60;
                const dy = (Math.random() - 0.5) * 60;
                const scale = Math.random() * 0.6 + 0.8;

                particle.style.cssText = `
                    width: ${size}px;
                    height: ${size}px;
                    left: ${x}%;
                    top: ${y}%;
                    --duration: ${duration}s;
                    --delay: ${delay}s;
                    --dx: ${dx}px;
                    --dy: ${dy}px;
                    --scale: ${scale};
                    animation-delay: ${delay}s;
                `;

                container.appendChild(particle);
            }
        },

        /**
         * Stagger entrance animations using IntersectionObserver
         */
        initStaggerAnimations() {
            const elements = document.querySelectorAll('.stagger-observe');

            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry, idx) => {
                    if (entry.isIntersecting) {
                        entry.target.style.animationDelay = `${idx * 0.08}s`;
                        entry.target.classList.add('stagger-in');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });

            elements.forEach(el => observer.observe(el));
        },

        /**
         * Shutter click effect on interactive elements
         * Creates a camera flash overlay
         */
        initShutterEffect() {
            document.querySelectorAll('.shutter-click').forEach(btn => {
                btn.addEventListener('click', () => {
                    const flash = document.createElement('div');
                    flash.className = 'shutter-flash';
                    document.body.appendChild(flash);
                    
                    setTimeout(() => flash.remove(), 350);
                });
            });
        },

        /**
         * Dynamic time-of-day greeting
         */
        initGreeting() {
            const el = document.querySelector('.hero-greeting');
            if (!el) return;

            const hour = new Date().getHours();
            let greeting, icon;

            if (hour < 12) {
                greeting = 'Good Morning';
                icon = '☀️';
            } else if (hour < 17) {
                greeting = 'Good Afternoon';
                icon = '🌤️';
            } else {
                greeting = 'Good Evening';
                icon = '🌙';
            }

            const iconEl = el.querySelector('.hero-greeting-icon');
            const textEl = el.querySelector('.hero-greeting-text');
            
            if (iconEl) iconEl.textContent = icon;
            if (textEl) textEl.textContent = greeting;
        },

        /**
         * Format a date to relative time string
         */
        relativeTime(dateStr) {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = Math.floor((now - date) / 1000);

            if (diff < 60) return 'Just now';
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
            
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        },

        /**
         * Format booking date to readable format
         */
        formatDate(dateStr) {
            if (!dateStr) return '—';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
        },

        /**
         * Format time string
         */
        formatTime(timeStr) {
            if (!timeStr) return '—';
            const parts = timeStr.split(':');
            if (parts.length < 2) return timeStr;
            let h = parseInt(parts[0]);
            const m = parts[1];
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m} ${ampm}`;
        },

        /**
         * Get status dot class based on booking status
         */
        getStatusDotClass(status) {
            const map = {
                'pending': 'pending',
                'confirmed': 'booking',
                'completed': 'completed',
                'cancelled': 'cancelled'
            };
            return map[status] || 'booking';
        }
    };

    // Expose globally
    window.DashboardPremium = DashboardPremium;

    // Auto-init when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Delay slightly to let other scripts render data first
        setTimeout(() => DashboardPremium.init(), 100);
    });
})();
