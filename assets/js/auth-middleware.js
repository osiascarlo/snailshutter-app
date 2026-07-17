// Authentication Middleware for Dashboard Protection
class AuthMiddleware {
    constructor() {
        // Wait for auth to be available
        this.auth = null;
        this.initAuth();
    }

    initAuth() {
        if (typeof auth !== 'undefined') {
            this.auth = auth;
        } else {
            // Retry after a short delay
            setTimeout(() => this.initAuth(), 100);
        }
    }

    // Protect dashboard routes
    protectDashboard(requiredRole = null) {
        // Wait for auth to be initialized
        if (!this.auth) {
            setTimeout(() => this.protectDashboard(requiredRole), 100);
            return false;
        }

        // Check if user is logged in
        if (!this.auth.isLoggedIn()) {
            this.redirectToLogin();
            return false;
        }

        // Check if user has required role
        if (requiredRole && this.auth.getUserRole() !== requiredRole) {
            this.showAccessDenied();
            return false;
        }

        // Update dashboard UI with user info
        this.updateDashboardUI();
        return true;
    }

    // Redirect to login page
    redirectToLogin() {
        window.location.href = '/auth/login.html';
    }

    // Show access denied message
    showAccessDenied() {
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8f9fa;">
                <div style="text-align: center; padding: 3rem; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px;">
                    <div style="font-size: 4rem; color: #dc3545; margin-bottom: 1rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 style="color: #dc3545; margin-bottom: 1rem;">Access Denied</h2>
                    <p style="color: #6c757d; margin-bottom: 2rem;">You don't have permission to access this dashboard.</p>
                    <button onclick="window.location.href='/index.html'" class="btn btn-primary">
                        <i class="fas fa-home"></i> Go to Home
                    </button>
                </div>
            </div>
        `;
    }

    // Update dashboard UI with user information
    updateDashboardUI() {
        const userName = this.auth.getUserName();
        const userRole = this.auth.getUserRole();
        const userInitial = this.auth.getUserInitial();

        // Update user name elements
        document.querySelectorAll('[data-user-name]').forEach(el => {
            el.textContent = userName || 'User';
        });

        // Update user role elements
        document.querySelectorAll('[data-user-role]').forEach(el => {
            el.textContent = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User';
        });

        // Update user initial elements
        document.querySelectorAll('[data-user-initial]').forEach(el => {
            el.textContent = userInitial || 'U';
        });

        // Update role-specific navigation
        this.updateRoleNavigation();
    }

    // Update navigation based on user role
    updateRoleNavigation() {
        const role = this.auth.getUserRole();

        // Hide all role-specific navigation items
        document.querySelectorAll('[data-nav-role]').forEach(el => {
            el.style.display = 'none';
        });

        // Show navigation items for current role
        if (role) {
            document.querySelectorAll(`[data-nav-role="${role}"]`).forEach(el => {
                el.style.display = '';
            });
            document.querySelectorAll('[data-nav-role="authenticated"]').forEach(el => {
                el.style.display = '';
            });
        }
    }

    // Logout functionality
    async logout() {
        console.log('Logout called in auth middleware');
        if (this.auth) {
            this.auth.logout();
        } else {
            sessionStorage.clear();
            window.location.href = '/index.html';
        }
    }

    // Check session validity
    async checkSession() {
        // Don't call API - just check if auth has a current user
        if (this.auth && this.auth.isLoggedIn()) {
            this.updateDashboardUI();
            return true;
        } else {
            this.redirectToLogin();
            return false;
        }
    }

    // Initialize dashboard with authentication
    initDashboard(requiredRole = null) {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.protectDashboard(requiredRole);
                this.setupLogoutHandlers();
            });
        } else {
            this.protectDashboard(requiredRole);
            this.setupLogoutHandlers();
        }
    }

    // Separate method for setting up logout handlers
    setupLogoutHandlers() {
        const logoutElements = document.querySelectorAll('[data-logout]');
        console.log('Found logout elements:', logoutElements.length);

        logoutElements.forEach(el => {
            console.log('Setting up logout listener for:', el);
            el.addEventListener('click', (e) => {
                console.log('Logout button clicked');
                e.preventDefault();
                this.logout();
            });
        });
    }
}

// Create global instance
const authMiddleware = new AuthMiddleware();
