/**
 * Dashboard Premium — Shared JS Interactions
 * Photo studio vibe animations & premium UX
 */

(function() {
    'use strict';

    let lastToggleTimestamp = 0;

    /**
     * Debounced, race-condition immune sidebar toggle
     */
    function safeToggleSidebar(forceState) {
        const now = Date.now();
        // If no explicit boolean state is provided, enforce a 280ms debounce
        if (typeof forceState !== 'boolean' && (now - lastToggleTimestamp < 280)) {
            return;
        }
        lastToggleTimestamp = now;

        const sidebar = document.getElementById('sidebar');
        let overlay = document.getElementById('sidebarOverlay');
        if (!sidebar) return;

        const shouldOpen = (typeof forceState === 'boolean')
            ? forceState
            : !sidebar.classList.contains('active');

        if (shouldOpen) {
            sidebar.classList.add('active');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'sidebarOverlay';
                overlay.className = 'sidebar-overlay';
                document.body.appendChild(overlay);
            }
            overlay.classList.add('active');
            document.body.classList.add('sidebar-open');
        } else {
            sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        }
    }

    // Expose universally on window immediately
    window.toggleSidebar = safeToggleSidebar;

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
            this.initDropdowns();
            this.initMobileStickyBar();
            this.initSidebarListeners();
        },

        /**
         * Initialize sidebar dropdown menus (e.g. Settings -> Studio / Profile)
         */
        initDropdowns() {
            const currentPath = window.location.pathname.toLowerCase();
            const isStudioSettings = currentPath.includes('/admin/settings.html');
            const isProfileSettings = currentPath.includes('/admin/profile-settings.html');

            const dropdowns = document.querySelectorAll('.sidebar-dropdown');
            dropdowns.forEach(dropdown => {
                const toggle = dropdown.querySelector('.sidebar-dropdown-toggle, .sidebar-link');
                const studioLink = dropdown.querySelector('#sublinkStudioSettings, a[href*="settings.html"]');
                const profileLink = dropdown.querySelector('#sublinkProfileSettings, a[href*="profile-settings.html"]');
                const submenu = dropdown.querySelector('.sidebar-submenu');

                if (isStudioSettings || isProfileSettings) {
                    dropdown.classList.add('open');
                    if (submenu) submenu.style.display = 'flex';
                    if (toggle) toggle.classList.add('active-parent');
                    if (isStudioSettings && studioLink) studioLink.classList.add('active');
                    if (isProfileSettings && profileLink) profileLink.classList.add('active');
                }
            });
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
            const date = (typeof window.parseAsiaManilaDate === 'function' ? window.parseAsiaManilaDate(dateStr) : null) || new Date(dateStr);
            const now = new Date();
            const diff = Math.floor((now - date) / 1000);

            if (diff < 60) return 'Just now';
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
            
            return (typeof window.formatAsiaManilaDate === 'function')
                ? window.formatAsiaManilaDate(date, { month: 'short', day: 'numeric' })
                : date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
        },

        /**
         * Format booking date to readable format
         */
        formatDate(dateStr) {
            if (!dateStr) return '—';
            if (typeof window.formatAsiaManilaDate === 'function') {
                return window.formatAsiaManilaDate(dateStr, { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
            }
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { 
                timeZone: 'Asia/Manila',
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
        },

        /**
         * Initialize consistent docked mobile sticky navigation bar across all dashboards
         */
        initMobileStickyBar() {
            const mainContent = document.querySelector('.main-content');
            if (!mainContent) return;

            // Suppress any stray un-docked legacy mobile menu buttons
            document.querySelectorAll('.mobile-menu-btn').forEach(btn => {
                btn.style.display = 'none';
            });

            // Route mapping for title and FontAwesome icon
            const pathname = window.location.pathname.toLowerCase();
            const routeConfigs = [
                // Admin
                { pattern: '/admin/dashboard', icon: 'fas fa-th-large', title: 'Dashboard', refreshFn: 'loadDashboardData' },
                { pattern: '/admin/bookings', icon: 'fas fa-calendar-alt', title: 'All Bookings', refreshFn: 'loadBookings' },
                { pattern: '/admin/calendar', icon: 'fas fa-calendar', title: 'Calendar', refreshFn: 'renderCalendar' },
                { pattern: '/admin/gallery', icon: 'fas fa-paper-plane', title: 'Photo Deliveries', refreshFn: 'loadOverview' },
                { pattern: '/admin/analytics', icon: 'fas fa-chart-bar', title: 'Analytics & Reports', refreshFn: 'loadAnalytics' },
                { pattern: '/admin/users', icon: 'fas fa-users', title: 'User Management', refreshFn: 'loadUsers' },
                { pattern: '/admin/services', icon: 'fas fa-camera', title: 'Services', refreshFn: 'loadServices' },
                { pattern: '/admin/settings', icon: 'fas fa-store', title: 'Studio Settings', refreshFn: 'loadSettings' },
                { pattern: '/admin/backup', icon: 'fas fa-database', title: 'Backup & Restore', refreshFn: 'loadBackups' },
                { pattern: '/admin/profile-settings', icon: 'fas fa-user-cog', title: 'Profile Settings', refreshFn: 'loadProfile' },
                { pattern: '/admin/logs', icon: 'fas fa-clipboard-list', title: 'System Logs', refreshFn: 'loadLogs' },
                // Staff
                { pattern: '/staff/dashboard', icon: 'fas fa-th-large', title: 'Staff Dashboard' },
                { pattern: '/staff/schedule', icon: 'fas fa-calendar-day', title: 'My Schedule', refreshFn: 'loadSchedule' },
                { pattern: '/staff/bookings', icon: 'fas fa-calendar-check', title: 'Assigned Bookings', refreshFn: 'loadBookings' },
                { pattern: '/staff/gallery', icon: 'fas fa-paper-plane', title: 'Photo Deliveries', refreshFn: 'loadOverview' },
                { pattern: '/staff/settings', icon: 'fas fa-user-cog', title: 'Profile Settings' },
                // Client
                { pattern: '/client/dashboard', icon: 'fas fa-th-large', title: 'Client Dashboard' },
                { pattern: '/client/book', icon: 'fas fa-camera', title: 'Book Session' },
                { pattern: '/client/bookings', icon: 'fas fa-history', title: 'My Bookings', refreshFn: 'loadBookings' },
                { pattern: '/client/calendar', icon: 'fas fa-calendar', title: 'Calendar', refreshFn: 'renderCalendar' },
                { pattern: '/client/settings', icon: 'fas fa-user-cog', title: 'Profile Settings' }
            ];

            let matchedConfig = routeConfigs.find(cfg => pathname.includes(cfg.pattern));
            if (!matchedConfig) {
                const activeNav = document.querySelector('.sidebar-link.active');
                if (activeNav) {
                    const iconEl = activeNav.querySelector('i');
                    const text = activeNav.textContent.trim();
                    matchedConfig = {
                        icon: iconEl ? iconEl.className : 'fas fa-th-large',
                        title: text || (document.title ? document.title.split('|')[0].trim() : 'Dashboard')
                    };
                } else {
                    matchedConfig = {
                        icon: 'fas fa-th-large',
                        title: (document.title ? document.title.split('|')[0].trim() : 'Dashboard')
                    };
                }
            }

            let bar = mainContent.querySelector('.mobile-sticky-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.className = 'mobile-sticky-bar';
                bar.innerHTML = `
                    <button class="mobile-header-menu-btn" aria-label="Toggle navigation">
                        <i class="fas fa-bars"></i>
                    </button>
                    <div class="mobile-header-title">
                        <i class="${matchedConfig.icon}"></i>
                        <span>${matchedConfig.title}</span>
                    </div>
                    <button class="mobile-header-refresh-btn" aria-label="Refresh page" title="Refresh">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                `;
                mainContent.insertBefore(bar, mainContent.firstChild);
            }

            // Bind menu toggle & clean up inline onclick attributes
            const menuBtn = bar.querySelector('.mobile-header-menu-btn');
            if (menuBtn) {
                menuBtn.removeAttribute('onclick');
                menuBtn.onclick = null;
                if (!menuBtn.dataset.bound) {
                    menuBtn.dataset.bound = 'true';
                    menuBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        safeToggleSidebar();
                    });
                }
            }

            // Bind refresh button
            const refreshBtn = bar.querySelector('.mobile-header-refresh-btn');
            if (refreshBtn) {
                refreshBtn.removeAttribute('onclick');
                refreshBtn.onclick = null;
                if (!refreshBtn.dataset.bound) {
                    refreshBtn.dataset.bound = 'true';
                    refreshBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        if (refreshBtn.disabled || refreshBtn.dataset.refreshing === 'true') return;

                        refreshBtn.dataset.refreshing = 'true';
                        refreshBtn.disabled = true;
                        const icon = refreshBtn.querySelector('i');
                        if (icon) icon.classList.add('fa-spin');

                        const fnName = matchedConfig ? matchedConfig.refreshFn : null;
                        try {
                            if (typeof window.refreshBookings === 'function') {
                                await window.refreshBookings(refreshBtn);
                            } else if (fnName && typeof window[fnName] === 'function') {
                                await window[fnName]();
                            } else if (typeof window.loadOverview === 'function') {
                                await window.loadOverview();
                            } else if (typeof window.loadBookings === 'function') {
                                await window.loadBookings();
                            } else if (typeof window.loadDashboardData === 'function') {
                                await window.loadDashboardData();
                            } else {
                                window.location.reload();
                                return;
                            }
                        } catch (err) {
                            console.warn('Refresh error:', err);
                        } finally {
                            setTimeout(() => {
                                if (icon) icon.classList.remove('fa-spin');
                                refreshBtn.disabled = false;
                                refreshBtn.dataset.refreshing = 'false';
                            }, 400);
                        }
                    });
                }
            }
        },

        /**
         * Setup robust global sidebar listeners, overlay close, and mobile ergonomics
         */
        initSidebarListeners() {
            // Re-assign window.toggleSidebar in case an inline script overwrote it
            window.toggleSidebar = safeToggleSidebar;

            // Strip inline onclick handlers from all mobile menu buttons and bind them cleanly
            const allMenuBtns = document.querySelectorAll('.mobile-header-menu-btn, .mobile-menu-btn');
            allMenuBtns.forEach(btn => {
                btn.removeAttribute('onclick');
                btn.onclick = null;
                if (!btn.dataset.bound) {
                    btn.dataset.bound = 'true';
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        safeToggleSidebar();
                    });
                }
            });

            // Clean up and bind overlay
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) {
                overlay.removeAttribute('onclick');
                overlay.onclick = null;
                if (!overlay.dataset.bound) {
                    overlay.dataset.bound = 'true';
                    overlay.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        safeToggleSidebar(false);
                    });
                }
            }

            // Close sidebar when pressing Escape
            if (!window.__sidebarEscBound) {
                window.__sidebarEscBound = true;
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        const sb = document.getElementById('sidebar');
                        if (sb && sb.classList.contains('active')) {
                            safeToggleSidebar(false);
                        }
                    }
                });
            }

            // Close sidebar on mobile when navigating via a sidebar link
            if (!window.__sidebarLinkBound) {
                window.__sidebarLinkBound = true;
                document.addEventListener('click', (e) => {
                    if (window.innerWidth <= 768) {
                        const link = e.target.closest('.sidebar-link:not(.sidebar-dropdown-toggle), .sidebar-sublink');
                        if (link) {
                            safeToggleSidebar(false);
                        }
                    }
                });
            }
        }
    };

    // Expose globally
    window.DashboardPremium = DashboardPremium;
    window.toggleSettingsDropdown = function(trigger) {
        const dd = (trigger && trigger.nodeType)
            ? (trigger.closest ? trigger.closest('.sidebar-dropdown') : document.getElementById('settingsDropdown'))
            : document.getElementById('settingsDropdown');
        if (dd) {
            const isOpen = dd.classList.contains('open');
            const submenu = dd.querySelector('.sidebar-submenu');
            if (isOpen) {
                dd.classList.remove('open');
                if (submenu) submenu.style.display = 'none';
            } else {
                dd.classList.add('open');
                if (submenu) submenu.style.display = 'flex';
            }
        }
    };

    // Auto-init when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Delay slightly to let other scripts render data first
        setTimeout(() => DashboardPremium.init(), 100);
    });
})();
