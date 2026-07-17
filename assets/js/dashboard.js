class Dashboard {
    constructor() {
        this.bookings = [];
        this.services = [];
        this.stats = {};
        this.init();
    }

    async init() {
        // Check authentication
        if (!auth.requireAuth()) {
            return;
        }

        // Load data based on user role
        await this.loadData();
        this.renderDashboard();
    }

    async loadData() {
        try {
            // Load bookings
            const bookingsResponse = await api.getBookings();
            if (bookingsResponse.success) {
                this.bookings = bookingsResponse.data;
            }

            // Load services (needed for booking)
            const servicesResponse = await api.getServices();
            if (servicesResponse.success) {
                this.services = servicesResponse.data;
            }

            // Calculate stats
            this.calculateStats();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showAlert('Failed to load dashboard data', 'error');
        }
    }

    calculateStats() {
        const role = auth.getUserRole();
        const today = new Date().toISOString().split('T')[0];
        
        if (role === 'client') {
            const totalBookings = this.bookings.length;
            const upcomingBookings = this.bookings.filter(b => 
                b.booking_date >= today && ['pending', 'confirmed'].includes(b.status)
            ).length;
            const completedBookings = this.bookings.filter(b => 
                b.status === 'completed'
            ).length;

            this.stats = {
                totalSessions: totalBookings,
                upcoming: upcomingBookings,
                completed: completedBookings
            };
        } else if (role === 'admin') {
            const totalBookings = this.bookings.length;
            const pendingBookings = this.bookings.filter(b => b.status === 'pending').length;
            const confirmedBookings = this.bookings.filter(b => b.status === 'confirmed').length;
            const completedBookings = this.bookings.filter(b => b.status === 'completed').length;

            this.stats = {
                totalBookings,
                pending: pendingBookings,
                confirmed: confirmedBookings,
                completed: completedBookings,
                totalUsers: 6, // Mock data
                activeUsers: 4,
                pendingUsers: 1
            };
        } else if (role === 'staff') {
            const myBookings = this.bookings.length;
            const todayBookings = this.bookings.filter(b => 
                b.booking_date === today
            ).length;
            const upcomingBookings = this.bookings.filter(b => 
                b.booking_date >= today && ['pending', 'confirmed'].includes(b.status)
            ).length;

            this.stats = {
                myBookings,
                today: todayBookings,
                upcoming: upcomingBookings
            };
        }
    }

    renderDashboard() {
        const role = auth.getUserRole();
        
        // Render stats
        this.renderStats();
        
        // Render services (for client and admin dashboards)
        if (role === 'client' || role === 'admin') {
            this.renderServices();
        }
        
        // Render recent bookings
        this.renderRecentBookings();
        
        // Update user info
        this.updateUserInfo();
    }

    renderStats() {
        const statsGrid = document.querySelector('.stats-grid');
        if (!statsGrid) return;

        const role = auth.getUserRole();
        let statsHTML = '';

        if (role === 'client') {
            statsHTML = `
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-camera"></i></div>
                    <div class="stat-value">${this.stats.totalSessions}</div>
                    <div class="stat-label">Total Sessions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-value">${this.stats.upcoming}</div>
                    <div class="stat-label">Upcoming</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-value">${this.stats.completed}</div>
                    <div class="stat-label">Completed</div>
                </div>
            `;
        } else if (role === 'admin') {
            statsHTML = `
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-calendar"></i></div>
                    <div class="stat-value">${this.stats.totalBookings}</div>
                    <div class="stat-label">Total Bookings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning"><i class="fas fa-clock"></i></div>
                    <div class="stat-value">${this.stats.pending}</div>
                    <div class="stat-label">Pending</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-check"></i></div>
                    <div class="stat-value">${this.stats.confirmed}</div>
                    <div class="stat-label">Confirmed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon info"><i class="fas fa-users"></i></div>
                    <div class="stat-value">${this.stats.totalUsers}</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-user-check"></i></div>
                    <div class="stat-value">${this.stats.activeUsers}</div>
                    <div class="stat-label">Active Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning"><i class="fas fa-user-clock"></i></div>
                    <div class="stat-value">${this.stats.pendingUsers}</div>
                    <div class="stat-label">Pending Users</div>
                </div>
            `;
        } else if (role === 'staff') {
            statsHTML = `
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-camera"></i></div>
                    <div class="stat-value">${this.stats.myBookings}</div>
                    <div class="stat-label">My Bookings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning"><i class="fas fa-calendar-day"></i></div>
                    <div class="stat-value">${this.stats.today}</div>
                    <div class="stat-label">Today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-value">${this.stats.upcoming}</div>
                    <div class="stat-label">Upcoming</div>
                </div>
            `;
        }

        statsGrid.innerHTML = statsHTML;
    }

    renderServices() {
        const servicesGrid = document.querySelector('.services-grid');
        if (!servicesGrid) return;

        const role = auth.getUserRole();

        if (this.services.length === 0) {
            servicesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📷</div>
                    <h3>No Services Available</h3>
                    <p>${role === 'admin' ? 'Add your first photography service!' : 'Check back later for our photography packages!'}</p>
                </div>
            `;
            return;
        }

        let servicesHTML = '';
        this.services.forEach(service => {
            let actionButton = '';
            if (role === 'client') {
                actionButton = `
                    <button class="btn btn-primary" onclick="dashboard.bookService(${service.id})">
                        <i class="fas fa-calendar-plus"></i> Book Now
                    </button>
                `;
            } else if (role === 'admin') {
                actionButton = `
                    <div class="service-actions">
                        <button class="btn btn-secondary btn-sm" onclick="dashboard.editService(${service.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="dashboard.deleteService(${service.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `;
            }

            servicesHTML += `
                <div class="service-card">
                    <div class="service-header">
                        <h4>${service.name}</h4>
                        <div class="service-price">${formatCurrency(service.price)}</div>
                    </div>
                    <div class="service-body">
                        <p>${service.description}</p>
                        <div class="service-meta">
                            <span><i class="fas fa-clock"></i> ${service.duration_minutes} minutes</span>
                        </div>
                    </div>
                    <div class="service-footer">
                        ${actionButton}
                    </div>
                </div>
            `;
        });

        servicesGrid.innerHTML = servicesHTML;
    }

    renderRecentBookings() {
        const tableBody = document.querySelector('.data-table tbody');
        if (!tableBody) return;

        const today = new Date().toISOString().split('T')[0];
        const role = auth.getUserRole();
        
        let recentBookings = [];
        
        if (role === 'client') {
            recentBookings = this.bookings.filter(b => 
                b.booking_date >= today && ['pending', 'confirmed'].includes(b.status)
            ).slice(0, 5);
        } else if (role === 'admin') {
            recentBookings = this.bookings.slice(0, 10);
        } else if (role === 'staff') {
            recentBookings = this.bookings.slice(0, 10);
        }

        if (recentBookings.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem;">
                        <div class="empty-state">
                            <div class="empty-icon">&#128247;</div>
                            <h3>No Bookings Found</h3>
                            <p>${role === 'client' ? 'Book your first photography session today!' : 'No bookings available'}</p>
                            ${role === 'client' ? '<a href="/client/book.html" class="btn btn-primary"><i class="fas fa-plus"></i> Book Now</a>' : ''}
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let tableHTML = '';
        recentBookings.forEach(booking => {
            const statusClass = `badge-${booking.status}`;
            const serviceName = booking.service_name || 'Unknown Service';
            const date = formatDate(booking.booking_date);
            const time = `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`;
            
            let actionCell = '';
            if (role === 'client' && booking.status === 'pending') {
                actionCell = `<button class="btn btn-danger btn-sm" onclick="dashboard.cancelBooking(${booking.id})">
                    <i class="fas fa-times"></i> Cancel
                </button>`;
            } else if (role === 'admin') {
                actionCell = `
                    <button class="btn btn-success btn-sm" onclick="dashboard.updateBookingStatus(${booking.id}, 'confirm')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="dashboard.updateBookingStatus(${booking.id}, 'complete')">
                        <i class="fas fa-trophy"></i>
                    </button>
                `;
            } else if (role === 'staff') {
                actionCell = `
                    <button class="btn btn-success btn-sm" onclick="dashboard.updateBookingStatus(${booking.id}, 'confirm')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="dashboard.updateBookingStatus(${booking.id}, 'complete')">
                        <i class="fas fa-trophy"></i>
                    </button>
                `;
            }

            if (role === 'client') {
                tableHTML += `
                    <tr>
                        <td style="font-weight:500;">${serviceName}</td>
                        <td>${date}</td>
                        <td>${time}</td>
                        <td>${booking.staff_name || 'To be assigned'}</td>
                        <td><span class="badge ${statusClass}">${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</span></td>
                        <td>${actionCell}</td>
                    </tr>
                `;
            } else if (role === 'admin') {
                tableHTML += `
                    <tr>
                        <td style="font-weight:500;">${serviceName}</td>
                        <td>${booking.client_name || 'Unknown'}</td>
                        <td>${date}</td>
                        <td>${time}</td>
                        <td><span class="badge ${statusClass}">${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</span></td>
                        <td>${actionCell}</td>
                    </tr>
                `;
            } else if (role === 'staff') {
                tableHTML += `
                    <tr>
                        <td style="font-weight:500;">${serviceName}</td>
                        <td>${booking.client_name || 'Unknown'}</td>
                        <td>${date}</td>
                        <td>${time}</td>
                        <td><span class="badge ${statusClass}">${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</span></td>
                        <td>${actionCell}</td>
                    </tr>
                `;
            }
        });

        tableBody.innerHTML = tableHTML;
    }

    updateUserInfo() {
        const userNameElements = document.querySelectorAll('[data-user-name]');
        const userRoleElements = document.querySelectorAll('[data-user-role]');
        const userInitialElements = document.querySelectorAll('[data-user-initial]');

        userNameElements.forEach(el => {
            el.textContent = auth.getUserName();
        });

        userRoleElements.forEach(el => {
            el.textContent = auth.getUserRole();
        });

        userInitialElements.forEach(el => {
            el.textContent = auth.getUserInitial();
        });
    }

    async cancelBooking(bookingId) {
        const confirmed = await showConfirm({
            title: 'Cancel Booking',
            message: 'Are you sure you want to cancel this booking?',
            confirmText: 'Confirm',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            const result = await api.updateBooking(bookingId, 'cancel');
            if (result.success) {
                showAlert('Booking cancelled successfully', 'success');
                await this.loadData();
                this.renderDashboard();
            } else {
                showAlert(result.error || 'Failed to cancel booking', 'error');
            }
        } catch (error) {
            showAlert(error.message || 'Failed to cancel booking', 'error');
        }
    }

    async updateBookingStatus(bookingId, action) {
        const actionText = action === 'confirm' ? 'confirm' : 'mark as complete';
        
        const confirmed = await showConfirm({
            title: `${action.charAt(0).toUpperCase() + action.slice(1)} Booking`,
            message: `Are you sure you want to ${actionText} this booking?`,
            confirmText: 'Confirm'
        });

        if (!confirmed) return;

        try {
            const result = await api.updateBooking(bookingId, action);
            if (result.success) {
                showAlert(`Booking ${actionText}ed successfully`, 'success');
                await this.loadData();
                this.renderDashboard();
            } else {
                showAlert(result.error || `Failed to ${actionText} booking`, 'error');
            }
        } catch (error) {
            showAlert(error.message || `Failed to ${actionText} booking`, 'error');
        }
    }

    bookService(serviceId) {
        // Redirect to booking page with service ID
        window.location.href = `/client/book.html?service=${serviceId}`;
    }

    editService(serviceId) {
        // Redirect to edit service page
        window.location.href = `/admin/edit-service.html?id=${serviceId}`;
    }

    async deleteService(serviceId) {
        const confirmed = await showConfirm({
            title: 'Delete Service',
            message: 'Are you sure you want to delete this service? This action cannot be undone.',
            confirmText: 'Delete',
            type: 'danger'
        });

        if (!confirmed) return;

        // In a real app, this would call API to delete service
        // For mock, we'll just show success message
        showAlert('Service deleted successfully', 'success');
        
        // Remove from local services array and re-render
        this.services = this.services.filter(s => s.id !== serviceId);
        this.renderServices();
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', function() {
    dashboard = new Dashboard();
});
