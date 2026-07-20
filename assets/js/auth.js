class Auth {
    constructor() {
        this.currentUser = null;
        this.backButtonInterceptorInitialized = false;
        this.init();
    }

    async init() {
        try {
            console.log('Auth.js: Initializing auth system...');

            // 1. Restore from sessionStorage synchronously first to avoid blocking page load checks
            const storedUser = sessionStorage.getItem('currentUser');
            if (storedUser) {
                this.currentUser = JSON.parse(storedUser);
                console.log('Auth.js: Synchronously restored cached user:', this.currentUser);
                this.updateUI();
                this.setupBackButtonInterceptor();
            }

            // 2. Verify and sync with backend in the background
            if (typeof api !== 'undefined') {
                const response = await api.getSession();
                if (response.success) {
                    const serverUser = response.data;
                    
                    // Check if role changed
                    const roleChanged = !this.currentUser || this.currentUser.role !== serverUser.role;
                    
                    this.currentUser = serverUser;
                    sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    console.log('Auth.js: Restored user from API session:', this.currentUser);
                    
                    this.updateUI();
                    this.setupBackButtonInterceptor();

                    // If the role changed (e.g. from admin to client), re-evaluate authorization
                    if (roleChanged) {
                        console.log('Auth.js: Role changed, re-evaluating authorization...');
                        if (window.location.pathname.includes('/admin/')) {
                            this.requireAuth('admin');
                        } else if (window.location.pathname.includes('/client/')) {
                            this.requireAuth('client');
                        }
                    }
                } else {
                    console.log('Auth.js: API session check returned success:false');
                    const wasLoggedIn = this.currentUser !== null;
                    this.currentUser = null;
                    sessionStorage.removeItem('currentUser');
                    this.updateUI();

                    // Redirect to login only if we were logged in or are on a protected page
                    if (wasLoggedIn || window.location.pathname.includes('/admin/') || window.location.pathname.includes('/client/')) {
                        this.redirectToLogin();
                    }
                }
            } else {
                console.log('Auth.js: API not available, falling back to sessionStorage');
                if (!storedUser) {
                    this.currentUser = null;
                }
            }
        } catch (error) {
            console.log('Auth.js: Session check failed, user not logged in:', error);
            const wasLoggedIn = this.currentUser !== null;
            this.currentUser = null;
            sessionStorage.removeItem('currentUser');
            this.updateUI();

            // Redirect to login only if we were logged in or are on a protected page
            if (wasLoggedIn || window.location.pathname.includes('/admin/') || window.location.pathname.includes('/client/')) {
                this.redirectToLogin();
            }
        }
    }

    async login(email, password) {
        try {
            console.log('Auth.js: Attempting login with:', { email, password });
            const response = await api.login(email, password);
            console.log('Auth.js: API response received:', response);

            if (response.success) {
                this.currentUser = response.data;
                sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                console.log('Auth.js: Login successful, current user set:', this.currentUser);
                this.updateUI();
                return { success: true, data: response.data, message: 'Login successful' };
            }
            console.log('Auth.js: Login failed, API returned success:false');
            return { success: false, error: response.error || 'Login failed' };
        } catch (error) {
            console.log('Auth.js: Login exception:', error);
            return { success: false, error: error.message };
        }
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
        // Show confirmation dialog if the premium modal system is available
        if (!force && typeof showConfirm === 'function') {
            const confirmed = await showConfirm({
                title: 'Log Out',
                message: 'Are you sure you want to log out of your account?',
                confirmText: 'Log Out',
                cancelText: 'Stay',
                type: 'danger'
            });
            if (!confirmed) return;
        }

        try {
            await api.logout();
            this.currentUser = null;
            sessionStorage.removeItem('currentUser');
            this.redirectToHome();
        } catch (error) {
            console.error('Logout error:', error);
            this.currentUser = null;
            sessionStorage.removeItem('currentUser');
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

    getUserName() {
        return this.currentUser ? this.currentUser.name : null;
    }

    getUserInitial() {
        const name = this.getUserName();
        return name ? name.charAt(0).toUpperCase() : '';
    }

    requireAuth(role = null) {
        if (!this.isLoggedIn()) {
            this.redirectToLogin();
            return false;
        }

        if (role && this.getUserRole() !== role) {
            this.redirectToDashboard();
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
                el.textContent = this.getUserRole();
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
        const isDashboardHome = path.endsWith('/dashboard.html');
        
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
                if (isConfirming) return;

                // Prevent duplicate modals if one is already showing in the DOM
                if (document.querySelector('.modal-overlay')) return;

                // Check if they are trying to go back (popped the 'dashboard-lock' state)
                if (this.isLoggedIn() && (!event.state || event.state.page !== 'dashboard-lock')) {
                    isConfirming = true;
                    
                    // Show custom confirmation modal
                    if (typeof showConfirm === 'function') {
                        const confirmed = await showConfirm({
                            title: 'Log Out',
                            message: 'Are you sure you want to log out of your account?',
                            confirmText: 'Log Out',
                            cancelText: 'Stay',
                            type: 'danger'
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
                        isConfirming = true;
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
