// Custom Alert and Modal System
let alertContainer = null;

function showAlert(message, type = 'success') {
    if (!alertContainer) {
        alertContainer = document.getElementById('alertContainer') || document.createElement('div');
        if (!alertContainer.id) {
            alertContainer.id = 'alertContainer';
            document.body.appendChild(alertContainer);
        }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'info-circle';
    if (type === 'success') iconClass = 'check-circle';
    else if (type === 'error') iconClass = 'exclamation-circle';
    else if (type === 'warning') iconClass = 'exclamation-triangle';

    toast.innerHTML = `
        <i class="fas fa-${iconClass}"></i>
        <div class="toast-content">${message}</div>
    `;

    alertContainer.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

/**
 * Premium Custom Confirmation Modal
 * @param {Object} options { title, message, confirmText, cancelText, type }
 * @returns {Promise<boolean>}
 */
function showConfirm(options = {}) {
    if (document.querySelector('.custom-confirm-overlay')) {
        console.warn('showConfirm: Modal overlay already active, suppressing duplicate.');
        return Promise.resolve(false);
    }

    const {
        title = 'Confirmation',
        message = 'Are you sure you want to proceed?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        type = 'confirm', // 'confirm' or 'danger'
        icon = null
    } = options;

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay custom-confirm-overlay';
        
        let iconClass = 'fa-question';
        if (icon) {
            iconClass = icon;
        } else if (type === 'danger') {
            iconClass = 'fa-right-from-bracket';
        } else {
            iconClass = 'fa-circle-check';
        }

        overlay.innerHTML = `
            <div class="modal-container custom-confirm-container">
                <div class="modal-header custom-confirm-header">
                    <div class="modal-icon ${type === 'danger' ? 'modal-icon-danger-glow' : 'modal-icon-confirm-glow'}">
                        <i class="fas ${iconClass}"></i>
                    </div>
                </div>
                <div class="modal-content custom-confirm-content">
                    <h3 class="modal-title">${title}</h3>
                    <p class="modal-message">${message}</p>
                </div>
                <div class="modal-footer custom-confirm-footer">
                    <button class="btn btn-modal-cancel" id="modalCancel">
                        ${cancelText}
                    </button>
                    <button class="btn ${type === 'danger' ? 'btn-danger-gradient' : 'btn-primary-gradient'} btn-modal-confirm" id="modalConfirm">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Force reflow for animation
        overlay.offsetHeight;
        overlay.classList.add('active');

        const cleanup = (result) => {
            overlay.classList.remove('active');
            if (!document.querySelector('.modal-overlay.active, .modal-overlay.show')) {
                document.body.style.overflow = '';
            }
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 300);
        };

        const onCancel = () => cleanup(false);
        const onConfirm = () => cleanup(true);

        overlay.querySelector('#modalCancel').addEventListener('click', onCancel);
        overlay.querySelector('#modalConfirm').addEventListener('click', onConfirm);
        
        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) onCancel();
        });
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function showLoading(element) {
    if (element) {
        element.disabled = true;
        element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }
}

function hideLoading(element, originalText) {
    if (element) {
        element.disabled = false;
        element.innerHTML = originalText;
    }
}

// Navigation and UI helpers
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    let overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar) {
        sidebar.classList.toggle('active');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sidebarOverlay';
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', toggleSidebar);
        }
        
        overlay.classList.toggle('active');
    }
}

// Initialize common functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth
    if (typeof auth !== 'undefined') {
        auth.updateUI();
    }

    // Handle sidebar toggle
    // Commented out to prevent double-triggering with inline onclick handlers in templates
    // const menuBtn = document.querySelector('.mobile-menu-btn');
    // if (menuBtn) {
    //     menuBtn.addEventListener('click', toggleSidebar);
    // }

    // Handle smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Handle landing nav scroll effect
    const landingNav = document.getElementById('landingNav');
    if (landingNav) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                landingNav.classList.add('scrolled');
            } else {
                landingNav.classList.remove('scrolled');
            }
        });
    }

    // Load admin notifications dynamically for pages under the admin or staff directory
    if (window.location.pathname.includes('/admin/') || window.location.pathname.includes('/staff/')) {
        const adminNotifScript = document.createElement('script');
        adminNotifScript.src = '/assets/js/admin_notifications.js';
        adminNotifScript.defer = true;
        document.body.appendChild(adminNotifScript);
    } else {
        // Run global maintenance mode check across all client tabs
        checkGlobalMaintenanceMode();
    }
});

// Global Client Maintenance Mode Check across all client tabs
async function checkGlobalMaintenanceMode() {
    if (typeof api === 'undefined' || !api.getPublicSettings) return;

    try {
        const res = await api.getPublicSettings();
        if (res && res.success && res.settings && res.settings.maintenanceMode === 'maintenance') {
            document.body.classList.add('maintenance-active');

            if (document.getElementById('maintenanceAlertBanner')) return;

            const banner = document.createElement('div');
            banner.id = 'maintenanceAlertBanner';
            banner.innerHTML = '<i class="fas fa-tools" style="flex-shrink: 0; color: #dc2626; font-size: 1.1rem;"></i> <span><strong>Studio Maintenance Mode Active:</strong> Online booking is currently paused for studio maintenance. Please check back later!</span>';

            document.body.appendChild(banner);

            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.paddingTop = '65px';
            }

            const multiBar = document.getElementById('multiSelectBar');
            if (multiBar) {
                multiBar.style.display = 'none';
            }

            const submitBtns = document.querySelectorAll('button[type="submit"], #submitBookingBtn, .btn-confirm-booking, #nextToStep2Btn, #multiSelectBtn');
            submitBtns.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.title = 'Online booking is paused during maintenance mode.';
            });
        }
    } catch (e) {
        console.warn('Maintenance check warning:', e);
    }
}

// Form validation helpers
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

function validateForm(formData) {
    const errors = [];
    
    if (!formData.email || !validateEmail(formData.email)) {
        errors.push('Valid email is required');
    }
    
    if (!formData.password || !validatePassword(formData.password)) {
        errors.push('Password must be at least 6 characters');
    }
    
    if (formData.fullName && formData.fullName.length < 2) {
        errors.push('Full name must be at least 2 characters');
    }
    
    return errors;
}
