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
    const {
        title = 'Confirmation',
        message = 'Are you sure you want to proceed?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        type = 'confirm' // 'confirm' or 'danger'
    } = options;

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const iconClass = type === 'danger' ? 'fa-exclamation-triangle modal-icon-danger' : 'fa-question-circle modal-icon-confirm';

        overlay.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <div class="modal-icon ${type === 'danger' ? 'modal-icon-danger' : 'modal-icon-confirm'}">
                        <i class="fas ${iconClass.split(' ')[0]}"></i>
                    </div>
                </div>
                <div class="modal-content">
                    <h3 class="modal-title">${title}</h3>
                    <p class="modal-message">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary btn-sm" id="modalCancel">${cancelText}</button>
                    <button class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'} btn-sm" id="modalConfirm">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Force reflow for animation
        overlay.offsetHeight;
        overlay.classList.add('active');

        const cleanup = (result) => {
            overlay.classList.remove('active');
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
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
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
    const menuBtn = document.querySelector('.mobile-menu-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', toggleSidebar);
    }

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
    }
});

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
