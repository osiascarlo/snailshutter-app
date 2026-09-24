class Auth {
    constructor() {
        this.currentUser = null;
        this.isUnloading = false;
        this.initPromise = null;
        this.backButtonInterceptorInitialized = false;

        // Synchronously restore cached user immediately on evaluation
        this.currentUser = this.getStoredUser();

        this.setupUnloadListeners();
        this.setupGlobalLogoutListener();
        this.init();
    }

    getStoredUser() {
        try {
            const raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('currentUser') : null) ||
                        (typeof localStorage !== 'undefined' ? localStorage.getItem('currentUser') : null);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && parsed.role) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Auth.js: Failed to parse stored user:', e);
        }
        return null;
    }

    setStoredUser(user) {
        try {
            if (user) {
                const str = JSON.stringify(user);
                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('currentUser', str);
                if (typeof localStorage !== 'undefined') localStorage.setItem('currentUser', str);
            } else {
                if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('currentUser');
                if (typeof localStorage !== 'undefined') localStorage.removeItem('currentUser');
            }
        } catch (e) {
            console.warn('Auth.js: Failed to update stored user:', e);
        }
    }

    setupUnloadListeners() {
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.isUnloading = true;
                window.isUnloading = true;
            });
            window.addEventListener('pagehide', () => {
                this.isUnloading = true;
                window.isUnloading = true;
            });
        }
    }

    setupGlobalLogoutListener() {
        if (typeof document !== 'undefined') {
            document.addEventListener('click', (e) => {
                const logoutBtn = e.target.closest('[data-logout]');
                if (logoutBtn) {
                    e.preventDefault();
                    console.log('Auth.js: Global logout triggered by click on [data-logout]');
                    this.logout();
                }
            });
        }
    }

    async init() {
        // Return existing in-flight init promise to avoid duplicate concurrent calls
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            try {
                // 1. Sync from storage first if not already set
                if (!this.currentUser) {
                    this.currentUser = this.getStoredUser();
                }

                if (this.currentUser) {
                    this.updateUI();
                    this.setupBackButtonInterceptor();
                }

                // 2. Verify and sync with backend API session
                if (typeof api !== 'undefined' && typeof api.getSession === 'function') {
                    const response = await api.getSession();

                    // If page is currently navigating/unloading, do not alter state
                    if (this.isUnloading || (typeof window !== 'undefined' && window.isUnloading)) {
                        return;
                    }

                    if (response && response.success && response.data) {
                        const serverUser = response.data;
                        const roleChanged = !this.currentUser || this.currentUser.role !== serverUser.role;

                        this.currentUser = serverUser;
                        this.setStoredUser(serverUser);
                        this.updateUI();
                        this.setupBackButtonInterceptor();

                        if (roleChanged) {
                            console.log('Auth.js: Role changed, re-evaluating authorization...');
                            if (window.location.pathname.includes('/admin/')) {
                                this.requireAuth('admin');
                            } else if (window.location.pathname.includes('/staff/')) {
                                this.requireAuth('staff');
                            } else if (window.location.pathname.includes('/client/')) {
                                this.requireAuth('client');
                            }
                        }
                    } else {
                        // Server explicitly returned success: false
                        if (this.isUnloading || (typeof window !== 'undefined' && window.isUnloading)) return;

                        console.warn('Auth.js: Server session check returned false');
                        const wasLoggedIn = this.currentUser !== null;
                        this.currentUser = null;
                        this.setStoredUser(null);
                        this.updateUI();

                        if (wasLoggedIn || window.location.pathname.includes('/admin/') || window.location.pathname.includes('/staff/') || window.location.pathname.includes('/client/')) {
                            this.redirectToLogin();
                        }
                    }
                }
            } catch (error) {
                // If page is unloading or fetch was aborted by browser navigation, DO NOT CLEAR SESSION!
                if (this.isUnloading || (typeof window !== 'undefined' && window.isUnloading) || error.name === 'AbortError' || (error.message && error.message.includes('abort'))) {
                    console.log('Auth.js: Navigation in progress or request aborted; preserving session.');
                    return;
                }

                // If user account is deactivated
                if (error.response && error.response.deactivated) {
                    this.currentUser = null;
                    this.setStoredUser(null);
                    window.location.href = '/auth/login.html?error=deactivated';
                    return;
                }

                // If the server explicitly responded with HTTP 401 Unauthorized
                const isExplicit401 = error.status === 401 || (error.response && error.response.status === 401) || (error.message && error.message === 'Not logged in');
                if (isExplicit401) {
                    console.warn('Auth.js: Server explicitly confirmed session is invalid/expired (401).');
                    const wasLoggedIn = this.currentUser !== null;
                    this.currentUser = null;
                    this.setStoredUser(null);
                    this.updateUI();

                    if (wasLoggedIn || window.location.pathname.includes('/admin/') || window.location.pathname.includes('/staff/') || window.location.pathname.includes('/client/')) {
                        this.redirectToLogin();
                    }
                    return;
                }

                // For network disconnects, timeouts, or unhandled transient errors:
                // DO NOT wipe the session! Keep current cached user!
                console.warn('Auth.js: Transient/network error during session verification, keeping cached user session:', error);
                if (this.currentUser) {
                    this.updateUI();
                    this.setupBackButtonInterceptor();
                }
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    async login(email, password) {
        try {
            console.log('Auth.js: Attempting login with:', { email, password });
            const response = await api.login(email, password);
            console.log('Auth.js: API response received:', response);

            if (response.success) {
                this.currentUser = response.data;
                this.setStoredUser(this.currentUser);
                console.log('Auth.js: Login successful, current user set:', this.currentUser);
                this.updateUI();
                return { success: true, data: response.data, message: 'Login successful' };
            }
            console.log('Auth.js: Login failed, API returned success:false');
            return { success: false, error: response.error || 'Login failed', ...response };
        } catch (error) {
            console.log('Auth.js: Login exception:', error);
            const errorMsg = error.response?.error || error.message || 'Login failed';
            return {
                success: false,
                error: errorMsg,
                deactivated: error.response?.deactivated || false,
                locked: error.response?.locked || false,
                retryAfter: error.response?.retryAfter || 0,
                attempts: error.response?.attempts || 0,
                attemptsLeft: error.response?.attemptsLeft !== undefined ? error.response.attemptsLeft : null,
                suggestForgotPassword: error.response?.suggestForgotPassword || false,
                status: error.status,
                ...(error.response || {})
            };
        }
    }

    setCurrentUser(user) {
        this.currentUser = user;
        this.setStoredUser(user);
        this.updateUI();
    }

    async register(userData) {
        try {
            const response = await api.register(userData);
            if (response.success) {
                return { success: true, message: 'Registration successful! Please login.' };
            }
            return { success: false, error: 'Registration failed' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async logout(force = false) {
        if (document.querySelector('.custom-confirm-overlay')) {
            console.log('Auth.js: Logout confirmation already open, skipping duplicate.');
            return;
        }

        // Show confirmation dialog if the premium modal system is available
        if (!force && typeof showConfirm === 'function') {
            const confirmed = await showConfirm({
                title: 'Sign Out of SnailShutter?',
                message: 'Are you sure you want to log out of your session? You will need to sign back in to access your appointments and photo gallery.',
                confirmText: 'Log Out',
                cancelText: 'Cancel',
                type: 'danger',
                icon: 'fa-right-from-bracket'
            });
            if (!confirmed) return;
        }

        try {
            await api.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.currentUser = null;
            this.setStoredUser(null);
            this.redirectToHome();
        }
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getUserRole() {
        const role = this.currentUser ? this.currentUser.role : null;
        console.log('getUserRole called. Current user:', this.currentUser);
        console.log('Role detected:', role);
        return role;
    }

    getFormattedRole() {
        const role = this.getUserRole();
        if (!role) return '';
        const lower = role.toLowerCase();
        if (lower === 'admin') return 'Administrator';
        if (lower === 'staff') return 'Staff Member';
        if (lower === 'client') return 'Client';
        return role.charAt(0).toUpperCase() + role.slice(1);
    }

    getUserName() {
        return this.currentUser ? this.currentUser.name : null;
    }

    getUserInitial() {
        const name = this.getUserName();
        return name ? name.charAt(0).toUpperCase() : '';
    }

    requireAuth(role = null) {
        // If currentUser is not in memory, attempt synchronous restore from storage
        if (!this.currentUser) {
            this.currentUser = this.getStoredUser();
        }

        if (!this.isLoggedIn()) {
            if (!this.isUnloading && !(typeof window !== 'undefined' && window.isUnloading)) {
                this.redirectToLogin();
            }
            return false;
        }

        if (role && this.getUserRole() !== role) {
            if (!this.isUnloading && !(typeof window !== 'undefined' && window.isUnloading)) {
                this.redirectToDashboard();
            }
            return false;
        }

        return true;
    }

    updateUI() {
        if (this.isLoggedIn()) {
            // Update navigation and user info
            const userElements = document.querySelectorAll('[data-user-name]');
            userElements.forEach(el => {
                el.textContent = this.getUserName();
            });

            const roleElements = document.querySelectorAll('[data-user-role]');
            roleElements.forEach(el => {
                el.textContent = this.getFormattedRole();
            });

            const initialElements = document.querySelectorAll('[data-user-initial]');
            initialElements.forEach(el => {
                if (this.currentUser.avatar) {
                    el.innerHTML = `<img src="${this.currentUser.avatar}" alt="${this.getUserName()}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                    el.style.backgroundColor = 'transparent';
                } else {
                    el.textContent = this.getUserInitial();
                    el.innerHTML = this.getUserInitial(); // Ensure any previous img is removed
                }
            });
        }

        // Always show/hide role-specific elements
        this.updateRoleBasedUI();
    }

    updateRoleBasedUI() {
        const role = this.getUserRole();

        // Hide all role-specific elements first
        document.querySelectorAll('[data-role]').forEach(el => {
            el.style.display = 'none';
        });

        // Show elements for current role
        if (role) {
            document.querySelectorAll(`[data-role="${role}"]`).forEach(el => {
                el.style.display = '';
            });
            document.querySelectorAll('[data-role="authenticated"]').forEach(el => {
                el.style.display = '';
            });
        }

        // Show unauthenticated elements if not logged in
        if (!this.isLoggedIn()) {
            document.querySelectorAll('[data-role="unauthenticated"]').forEach(el => {
                el.style.display = '';
            });
        }
    }

    setupBackButtonInterceptor() {
        // Only run on dashboard home/landing pages to allow normal navigation on other pages
        const path = window.location.pathname;
        const isDashboardHome = path.endsWith('/dashboard.html') || path.endsWith('/dashboard');
        
        if (isDashboardHome) {
            if (this.backButtonInterceptorInitialized) {
                return;
            }
            this.backButtonInterceptorInitialized = true;
            console.log('Auth.js: Initializing back-button navigation interceptor...');
            
            // Push a history state to intercept the next back navigation
            if (history.state?.page !== 'dashboard-lock') {
                history.pushState({ page: 'dashboard-lock' }, null, window.location.href);
            }

            // Flag to prevent popstate listener recursion
            let isConfirming = false;

            window.addEventListener('popstate', async (event) => {
                if (isConfirming) {
                    history.pushState({ page: 'dashboard-lock' }, null, window.location.href);
                    return;
                }

                // If confirmation modal is already active, prevent duplicate modals and maintain history lock
                if (document.querySelector('.custom-confirm-overlay')) {
                    history.pushState({ page: 'dashboard-lock' }, null, window.location.href);
                    return;
                }

                // If an in-page modal (like Log Details or Booking Details) is open, close it and stay on dashboard
                const openPageModal = document.querySelector('.modal-overlay.active, .modal-overlay.show, #logDetailModal[style*="display: flex"], #logDetailModal[style*="display:flex"]');
                if (openPageModal && !openPageModal.classList.contains('custom-confirm-overlay')) {
                    if (typeof closeLogModal === 'function' && openPageModal.id === 'logDetailModal') {
                        closeLogModal();
                    } else if (typeof closeBookingModal === 'function') {
                        closeBookingModal();
                    } else if (typeof closeDriveModal === 'function') {
                        closeDriveModal();
                    } else {
                        openPageModal.classList.remove('active', 'show');
                        openPageModal.style.display = 'none';
                        document.body.style.overflow = '';
                        document.documentElement.classList.remove('modal-open');
                        document.body.classList.remove('modal-open');
                    }
                    history.pushState({ page: 'dashboard-lock' }, null, window.location.href);
                    return;
                }

                // Check if they are trying to go back (popped the 'dashboard-lock' state)
                if (this.isLoggedIn() && (!event.state || event.state.page !== 'dashboard-lock')) {
                    isConfirming = true;
                    
                    // Show custom confirmation modal
                    if (typeof showConfirm === 'function') {
                        const confirmed = await showConfirm({
                            title: 'Sign Out of SnailShutter?',
                            message: 'Are you sure you want to log out of your session? You will need to sign back in to access your dashboard.',
                            confirmText: 'Log Out',
                            cancelText: 'Stay',
                            type: 'danger',
                            icon: 'fa-right-from-bracket'
                        });

                        isConfirming = false;
                        if (confirmed) {
                            this.logout(true);
                        } else {
                            // User clicked Stay, push the state back onto stack to trap the back button again
                            history.pushState({ page: 'dashboard-lock' }, null, window.location.href);
                        }
                    } else {
                        // Native confirm fallback
                        const confirmed = confirm('Are you sure you want to log out of your account?');
                        if (confirmed) {
                            this.logout(true);
                        } else {
                            history.pushState({ page: 'dashboard-lock' }, null, window.location.href);
                        }
                        // Delay resetting the flag to prevent queued popstate events from triggering another confirm
                        setTimeout(() => {
                            isConfirming = false;
                        }, 500);
                    }
                }
            });
        }
    }

    redirectToDashboard() {
        const role = this.getUserRole();
        console.log('Redirecting to dashboard. Role:', role);
        console.log('Current user:', this.currentUser);

        let target = '/index.html';
        if (role === 'admin') {
            console.log('Redirecting to admin dashboard...');
            target = '/admin/dashboard.html';
        } else if (role === 'staff') {
            console.log('Redirecting to staff dashboard...');
            target = '/staff/dashboard.html';
        } else if (role === 'client') {
            console.log('Redirecting to client dashboard...');
            target = '/client/dashboard.html';
        }
        window.location.replace(target);
    }

    redirectToLogin() {
        window.location.href = '/auth/login.html';
    }

    redirectToHome() {
        // More robust redirection that handles subdirectories
        const path = window.location.pathname;
        if (path.includes('/admin/') || path.includes('/staff/') || path.includes('/client/') || path.includes('/auth/')) {
            window.location.href = '../index.html';
        } else {
            window.location.href = 'index.html';
        }
    }
}

const auth = new Auth();
window.auth = auth;
