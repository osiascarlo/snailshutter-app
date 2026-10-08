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
            const data = await response.json();
            
            // Handle 401 Unauthorized globally or 403 Deactivated
            // Don't redirect if we're already on login/register pages OR if it's a login attempt
            const isAuthPage = window.location.pathname.includes('/auth/');
            const isLoginEndpoint = url.includes('/auth/login');
            const isSessionEndpoint = url.includes('/auth/session');
            const isUnloading = (typeof window !== 'undefined' && window.isUnloading) || (window.auth && window.auth.isUnloading);
            
            if (!isUnloading && (
                (response.status === 401 && !isAuthPage && !isSessionEndpoint && !isLoginEndpoint) ||
                (response.status === 403 && data && data.deactivated && !isAuthPage && !isLoginEndpoint)
            )) {
                console.warn('API: Session expired, invalid, or deactivated. Redirecting to login...');
                if (window.auth) {
                    window.auth.currentUser = null;
                    if (typeof window.auth.setStoredUser === 'function') {
                        window.auth.setStoredUser(null);
                    } else {
                        sessionStorage.removeItem('currentUser');
                        localStorage.removeItem('currentUser');
                    }
                    const errorParam = data && data.deactivated ? '?error=deactivated' : '';
                    setTimeout(() => {
                        if (!window.isUnloading && !(window.auth && window.auth.isUnloading)) {
                            window.location.href = `/auth/login.html${errorParam}`;
                        }
                    }, 500);
                }
            }

            if (!response.ok) {
                const error = new Error(data.error || 'Request failed');
                error.response = data;
                error.status = response.status;
                throw error;
            }

            return data;
        } catch (error) {
            // Ignore aborted requests or navigation in-flight drops
            const isAborted = error.name === 'AbortError' || 
                              (error.message && error.message.includes('abort')) ||
                              (typeof window !== 'undefined' && window.isUnloading) || 
                              (window.auth && window.auth.isUnloading);

            if (!isAborted && !(error.status === 401 && url.includes('/auth/session')) && !(error.status === 403 && error.response?.deactivated)) {
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
    async getServices(params = false) {
        if (typeof params === 'object' && params !== null) {
            const query = new URLSearchParams(params).toString();
            return this.request(`/services?${query}`);
        }
        return this.request(`/services${params === true ? '?all=true' : ''}`);
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

    async getBookings(params = {}) {
        let url = '/bookings';
        if (typeof params === 'string') {
            url += `?sort=${encodeURIComponent(params)}`;
        } else if (params && typeof params === 'object') {
            const query = new URLSearchParams(params).toString();
            if (query) url += `?${query}`;
        }
        return this.request(url);
    }

    async getStudioBookings() {
        return this.request('/bookings/studio-bookings');
    }

    async createBooking(bookingData) {
        const body = bookingData instanceof FormData ? bookingData : JSON.stringify(bookingData);
        return this.request('/bookings', {
            method: 'POST',
            body: body
        });
    }

    async updateBooking(bookingId, action, status = null, staffId = null, reason = null) {
        return this.request('/bookings', {
            method: 'PUT',
            body: JSON.stringify({ bookingId, action, status, staffId, reason })
        });
    }

    async updateBookingVenue(bookingId, venueData) {
        return this.request(`/bookings/${bookingId}/venue`, {
            method: 'PUT',
            body: JSON.stringify(venueData)
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

    async triggerReminders() {
        return this.request('/admin/settings/send-reminders', {
            method: 'POST'
        });
    }

    // Admin System Logs endpoints
    async getSystemLogs(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/admin/logs${query ? `?${query}` : ''}`);
    }

    async exportSystemLogs(params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = `${this.baseURL}/admin/logs/export${query ? `?${query}` : ''}`;
        const response = await fetch(url, {
            credentials: 'include'
        });

        if (!response.ok) {
            let errorMsg = 'Failed to export system logs';
            try {
                const errData = await response.json();
                errorMsg = errData.error || errorMsg;
            } catch (e) {}
            throw new Error(errorMsg);
        }

        const blob = await response.blob();
        let filename = 'snailshutter_system_logs.csv';
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.includes('filename=')) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
            if (matches && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        a.remove();
        return { success: true, filename };
    }

    async pruneSystemLogs(keepDays = 30) {
        return this.request(`/admin/logs?keep_days=${keepDays}`, {
            method: 'DELETE'
        });
    }

    // Reviews & Feedback endpoints
    async submitReview(data) {
        return this.request('/reviews', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getMyReviews() {
        return this.request('/reviews/my');
    }

    async getBookingReview(bookingId) {
        return this.request(`/reviews/booking/${bookingId}`);
    }

    async getServiceReviews(serviceId) {
        return this.request(`/reviews/service/${serviceId}`);
    }

    async getReviewStats() {
        return this.request('/reviews/stats');
    }

    async getAllReviews(limit = 20) {
        return this.request(`/reviews?limit=${limit}`);
    }

    async deleteReview(reviewId) {
        return this.request(`/reviews/${reviewId}`, {
            method: 'DELETE'
        });
    }

    // Database Backup & Disaster Recovery Endpoints
    async getBackupStats() {
        return this.request('/admin/backup/stats');
    }

    async getBackupsList() {
        return this.request('/admin/backup/list');
    }

    async createBackup(notes = '') {
        return this.request('/admin/backup/create', {
            method: 'POST',
            body: JSON.stringify({ notes })
        });
    }

    async downloadBackup(filename) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`/api/admin/backup/download/${encodeURIComponent(filename)}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Download failed' }));
            throw new Error(err.error || `Download failed with status ${res.status}`);
        }
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        a.remove();
        return { success: true, filename };
    }

    async deleteBackup(filename) {
        return this.request(`/admin/backup/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
    }

    async restoreBackup(filename) {
        return this.request('/admin/backup/restore', {
            method: 'POST',
            body: JSON.stringify({ filename })
        });
    }

    async uploadRestoreBackup(file) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const formData = new FormData();
        formData.append('backupFile', file);

        const res = await fetch('/api/admin/backup/upload-restore', {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to restore uploaded backup');
        }
        return data;
    }
}

const api = new API();

// Expose API to global window object
window.api = api;
console.log('API object exposed to window:', typeof window.api);
