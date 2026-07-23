class API {
    constructor() {
        this.baseURL = '/api';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = { ...options.headers };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        const config = {
            credentials: 'include',
            headers,
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            // Handle 401 Unauthorized globally
            // Don't redirect if we're already on login/register pages OR if it's a session check OR login attempt
            const isAuthPage = window.location.pathname.includes('/auth/');
            const isAuthEndpoint = url.includes('/auth/session') || url.includes('/auth/login');
            
            if (response.status === 401 && !isAuthPage && !isAuthEndpoint) {
                console.warn('API: Session expired or invalid. Redirecting to login...');
                if (window.auth) {
                    window.auth.currentUser = null;
                    sessionStorage.removeItem('currentUser');
                    setTimeout(() => {
                        window.location.href = '/auth/login.html';
                    }, 1000);
                }
            }

            const data = await response.json();

            if (!response.ok) {
                const error = new Error(data.error || 'Request failed');
                error.response = data;
                error.status = response.status;
                throw error;
            }

            return data;
        } catch (error) {
            // Only log if not a standard "not logged in" check
            if (!(error.status === 401 && url.includes('/auth/session'))) {
                console.error('API Error:', error);
            }
            throw error;
        }
    }

    // Auth endpoints
    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async register(userData) {
        return this.request('/auth/verify-register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getSession() {
        return this.request('/auth/session');
    }

    async logout() {
        return this.request('/auth/logout', {
            method: 'POST'
        });
    }

    async forgotPassword(email) {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    async resetPassword(email, otp, newPassword) {
        return this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, otp, new_password: newPassword })
        });
    }

    // OTP endpoints — uses real Node.js backend
    async sendOTP(email, name = '', phone = '') {
        return this.request('/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify({ email, name, phone })
        });
    }

    async verifyAndRegister(userData, otp) {
        return this.request('/auth/verify-register', {
            method: 'POST',
            body: JSON.stringify({ ...userData, otp })
        });
    }

    // Services endpoints
    async getServices(includeInactive = false) {
        return this.request(`/services${includeInactive ? '?all=true' : ''}`);
    }

    async createService(serviceData) {
        const body = serviceData instanceof FormData ? serviceData : JSON.stringify(serviceData);
        return this.request('/services', {
            method: 'POST',
            body: body
        });
    }

    async updateService(id, serviceData) {
        const body = serviceData instanceof FormData ? serviceData : JSON.stringify(serviceData);
        return this.request(`/services/${id}`, {
            method: 'PUT',
            body: body
        });
    }


    // Bookings endpoints
    async checkTimeSlots(date, serviceId, serviceIds = null) {
        let url = `/bookings/time-slots?date=${date}`;
        if (serviceIds) {
            url += `&service_ids=${serviceIds}`;
        } else if (serviceId) {
            url += `&service_id=${serviceId}`;
        }
        return this.request(url);
    }

    async getBookings() {
        return this.request('/bookings');
    }

    async createBooking(bookingData) {
        const body = bookingData instanceof FormData ? bookingData : JSON.stringify(bookingData);
        return this.request('/bookings', {
            method: 'POST',
            body: body
        });
    }

    async updateBooking(bookingId, action, status = null, staffId = null) {
        return this.request('/bookings', {
            method: 'PUT',
            body: JSON.stringify({ bookingId, action, status, staffId })
        });
    }

    // User management endpoints
    async getUsers() {
        return this.request('/users');
    }

    async createUser(userData) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateUser(userId, userData) {
        return this.request('/users/update_role', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, ...userData })
        });
    }

    async deleteUser(userId) {
        return this.request('/users/delete', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId })
        });
    }

    // New Profile methods
    async getUserProfile() {
        return this.request('/users/profile');
    }

    async updateUserProfile(userData) {
        return this.request('/users/profile', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updatePassword(passwordData) {
        return this.request('/users/password', {
            method: 'POST',
            body: JSON.stringify(passwordData)
        });
    }

    async uploadAvatar(formData) {
        // Special request for FormData (no Content-Type: application/json)
        const url = `${this.baseURL}/users/avatar`;
        const config = {
            method: 'POST',
            body: formData,
            credentials: 'include'
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Upload failed');
            return data;
        } catch (error) {
            console.error('Avatar Upload Error:', error);
            throw error;
        }
    }

    // Calendar endpoint
    async getCalendar(month, year) {
        return this.request(`/calendar?action=get_month&month=${month}&year=${year}`);
    }

    // Admin Analytics endpoint
    async getAnalytics() {
        return this.request('/admin/analytics');
    }

    // Admin Settings endpoints
    async getSettings() {
        return this.request('/admin/settings');
    }

    async getPublicSettings() {
        return this.request('/admin/settings/public');
    }

    async saveSettings(formData) {
        return this.request('/admin/settings', {
            method: 'POST',
            body: formData
        });
    }
}

const api = new API();

// Expose API to global window object
window.api = api;
console.log('API object exposed to window:', typeof window.api);
