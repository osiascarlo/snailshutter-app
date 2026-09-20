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

/**
 * Cancellation Reason Modal for Admin, Staff, and Client
 * @param {Object} options { role: 'admin'|'staff'|'client', bookingId: number|string }
 * @returns {Promise<{ confirmed: boolean, reason?: string }>}
 */
function showCancellationModal(options = {}) {
    if (document.querySelector('.cancellation-modal-overlay')) {
        console.warn('showCancellationModal: Modal overlay already active, suppressing duplicate.');
        return Promise.resolve({ confirmed: false });
    }

    const {
        role = 'admin',
        bookingId = null
    } = options;

    const isClient = role === 'client';

    const adminOptions = [
        { value: 'Fully booked / Scheduling conflict', label: 'Fully booked / Scheduling conflict' },
        { value: 'Invalid or unverified payment receipt', label: 'Invalid or unverified payment receipt' },
        { value: 'Client requested cancellation via phone / chat', label: 'Client requested cancellation via phone / chat' },
        { value: 'Studio maintenance / Equipment emergency', label: 'Studio maintenance / Equipment emergency' },
        { value: 'Other', label: 'Other / Custom reason (specify below)' }
    ];

    const clientOptions = [
        { value: 'Schedule conflict / Change of plans', label: 'Schedule conflict / Change of plans' },
        { value: 'Personal emergency', label: 'Personal emergency' },
        { value: 'Need to reschedule to another date', label: 'Need to reschedule to another date' },
        { value: 'Financial / Budget reasons', label: 'Financial / Budget reasons' },
        { value: 'Other', label: 'Other / Custom reason (specify below)' }
    ];

    const presetList = isClient ? clientOptions : adminOptions;

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay cancellation-modal-overlay';

        const radioItemsHtml = presetList.map((item, idx) => `
            <label style="display: flex; align-items: flex-start; gap: 0.65rem; padding: 0.6rem 0.75rem; border: 1px solid var(--color-border-soft, #e2e8f0); border-radius: 8px; cursor: pointer; transition: all 0.2s; background: #fff; margin-bottom: 0.4rem;" class="cancel-reason-option">
                <input type="radio" name="cancelReasonPreset" value="${item.value}" ${idx === 0 ? 'checked' : ''} style="margin-top: 0.2rem; cursor: pointer; accent-color: #dc2626;">
                <span style="font-size: 0.88rem; color: #1e293b; font-weight: 500; line-height: 1.35;">${item.label}</span>
            </label>
        `).join('');

        overlay.innerHTML = `
            <div class="modal-container" style="max-width: 520px; width: 92%; padding: 0; border-radius: 16px; background: white; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.25); overflow: hidden;">
                <div style="background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); color: white; padding: 1.25rem 1.5rem; position: relative;">
                    <button id="cancelModalCloseBtn" style="position: absolute; top: 1rem; right: 1rem; background: rgba(255,255,255,0.2); border: none; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.9rem;">
                        <i class="fas fa-times"></i>
                    </button>
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                            <i class="fas fa-calendar-times"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: white; font-family: var(--font-body, sans-serif);">
                                Cancel Booking ${bookingId ? `#${bookingId}` : ''}
                            </h3>
                            <p style="margin: 0.15rem 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.85);">
                                ${isClient ? 'Please let us know why you are cancelling this booking.' : 'Provide a reason so the client knows why this booking was cancelled.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div style="padding: 1.25rem 1.5rem; max-height: 70vh; overflow-y: auto;">
                    <div style="margin-bottom: 0.75rem;">
                        <label style="display: block; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 0.5rem;">
                            Select Reason:
                        </label>
                        <div id="cancelReasonOptionsList">
                            ${radioItemsHtml}
                        </div>
                    </div>

                    <div style="margin-bottom: 0.5rem;">
                        <label for="cancelCustomNote" style="display: block; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 0.4rem;">
                            Additional Note / Custom Details:
                        </label>
                        <textarea id="cancelCustomNote" rows="3" placeholder="${isClient ? 'Optional additional details about your cancellation...' : 'Provide specific details or instructions for the client (e.g., please rebook on available weekend)...'}" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.65rem 0.75rem; font-size: 0.88rem; font-family: inherit; resize: vertical; box-sizing: border-box; outline: none; transition: border-color 0.2s;"></textarea>
                        <div id="cancelErrorMsg" style="display: none; color: #dc2626; font-size: 0.8rem; font-weight: 600; margin-top: 0.35rem;">
                            <i class="fas fa-exclamation-circle"></i> Please specify a reason before submitting.
                        </div>
                    </div>
                </div>

                <div style="padding: 1rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.65rem; align-items: center;">
                    <button id="cancelModalDismissBtn" class="btn btn-secondary" style="padding: 0.5rem 1.15rem; font-size: 0.88rem; font-weight: 600; border-radius: 8px;">
                        Keep Booking
                    </button>
                    <button id="cancelModalSubmitBtn" class="btn btn-danger" style="background: #dc2626; color: white; border: none; padding: 0.5rem 1.25rem; font-size: 0.88rem; font-weight: 600; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                        <i class="fas fa-ban"></i> Confirm Cancellation
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Force reflow
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
            }, 250);
        };

        const onDismiss = () => cleanup({ confirmed: false });

        overlay.querySelector('#cancelModalCloseBtn').addEventListener('click', onDismiss);
        overlay.querySelector('#cancelModalDismissBtn').addEventListener('click', onDismiss);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) onDismiss();
        });

        // Focus & style options
        const noteArea = overlay.querySelector('#cancelCustomNote');
        const errorMsg = overlay.querySelector('#cancelErrorMsg');
        const radios = overlay.querySelectorAll('input[name="cancelReasonPreset"]');

        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                errorMsg.style.display = 'none';
                if (radio.value === 'Other') {
                    noteArea.focus();
                }
            });
        });

        overlay.querySelector('#cancelModalSubmitBtn').addEventListener('click', () => {
            const selectedRadio = overlay.querySelector('input[name="cancelReasonPreset"]:checked');
            const customNote = (noteArea.value || '').trim();
            const preset = selectedRadio ? selectedRadio.value : '';

            if (preset === 'Other' && !customNote) {
                errorMsg.textContent = 'Please specify the custom cancellation reason in the note field.';
                errorMsg.style.display = 'block';
                noteArea.focus();
                return;
            }

            let finalReason = '';
            if (preset === 'Other') {
                finalReason = customNote;
            } else if (customNote) {
                finalReason = `${preset} — ${customNote}`;
            } else {
                finalReason = preset || 'No specific reason provided.';
            }

            cleanup({ confirmed: true, reason: finalReason });
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
    if (typeof formatAsiaManilaDate === 'function') {
        return formatAsiaManilaDate(dateString, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    return new Date(dateString).toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila',
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

/**
 * Universal Skeleton Loader HTML Generators
 */
function getServiceSkeletonHTML(count = 6) {
    return Array.from({ length: count }).map(() => `
        <div class="service-card-skeleton">
            <div class="skeleton-img-wrap"></div>
            <div class="skeleton-body">
                <div class="skeleton skeleton-title" style="width: 70%; height: 1.25rem;"></div>
                <div class="skeleton skeleton-text" style="width: 95%; height: 0.82rem;"></div>
                <div class="skeleton skeleton-text" style="width: 65%; height: 0.82rem;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed #e2e8f0;">
                    <div class="skeleton skeleton-badge" style="width: 70px; height: 18px;"></div>
                    <div class="skeleton skeleton-badge" style="width: 50px; height: 18px;"></div>
                </div>
            </div>
        </div>
    `).join('');
}

function getBookingSkeletonHTML(count = 3) {
    return Array.from({ length: count }).map(() => `
        <div class="booking-card-skeleton">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="skeleton skeleton-title" style="width: 55%; height: 1.15rem; margin-bottom: 0;"></div>
                <div class="skeleton skeleton-badge" style="width: 55px; height: 18px;"></div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.4rem;">
                <div class="skeleton skeleton-text" style="width: 80%; height: 0.82rem; margin-bottom: 0;"></div>
                <div class="skeleton skeleton-text" style="width: 55%; height: 0.82rem; margin-bottom: 0;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem; padding-top: 0.5rem; border-top: 1px dashed #f1f5f9;">
                <div class="skeleton skeleton-badge" style="width: 75px; height: 20px;"></div>
                <div class="skeleton skeleton-text" style="width: 45px; height: 14px; margin-bottom: 0;"></div>
            </div>
        </div>
    `).join('');
}

function getTimeSlotSkeletonHTML(count = 8) {
    return Array.from({ length: count }).map(() => `
        <div class="time-slot-skeleton"></div>
    `).join('');
}

function getStatCardSkeletonHTML(count = 4) {
    return Array.from({ length: count }).map(() => `
        <div class="stat-card-skeleton">
            <div class="skeleton" style="width: 48px; height: 48px; border-radius: 12px;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.4rem;">
                <div class="skeleton skeleton-title" style="width: 40%; height: 1.5rem; margin-bottom: 0;"></div>
                <div class="skeleton skeleton-text" style="width: 60%; height: 0.8rem; margin-bottom: 0;"></div>
            </div>
        </div>
    `).join('');
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
            const href = this.getAttribute('href');
            if (!href || href === '#' || !href.startsWith('#')) return;
            try {
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            } catch (err) {
                // If invalid selector, do not prevent default navigation
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

    // Do NOT disable form submission or login on authentication pages
    const isAuthPage = window.location.pathname.includes('/auth/') || 
                       window.location.pathname.includes('login') || 
                       window.location.pathname.includes('register') ||
                       window.location.pathname.includes('forgot-password') ||
                       window.location.pathname.includes('reset-password');

    try {
        const res = await api.getPublicSettings();
        if (res && res.success && res.settings && res.settings.maintenanceMode === 'maintenance') {
            document.body.classList.add('maintenance-active');

            if (!document.getElementById('maintenanceAlertBanner')) {
                const banner = document.createElement('div');
                banner.id = 'maintenanceAlertBanner';
                banner.innerHTML = '<i class="fas fa-tools" style="flex-shrink: 0; color: #dc2626; font-size: 1.1rem;"></i> <span><strong>Studio Maintenance Mode Active:</strong> Online booking is currently paused for studio maintenance. Please check back later!</span>';
                document.body.appendChild(banner);

                const mainContent = document.querySelector('.main-content');
                if (mainContent) {
                    mainContent.style.paddingTop = '65px';
                }
            }

            const multiBar = document.getElementById('multiSelectBar');
            if (multiBar) {
                multiBar.style.display = 'none';
            }

            // Target ONLY booking-specific buttons, never login/auth/profile forms!
            if (!isAuthPage) {
                const bookingActionBtns = document.querySelectorAll(
                    '#submitBookingBtn, #submitBtn, .btn-confirm-booking, #nextToStep2Btn, #multiSelectBtn, #multiSelectBar button, form#bookingForm button[type="submit"]'
                );
                bookingActionBtns.forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                    btn.title = 'Online booking is paused during maintenance mode.';
                });
            }
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
    if (formData.firstName && formData.firstName.length < 2) {
        errors.push('First name must be at least 2 characters');
    }
    if (formData.lastName && formData.lastName.length < 2) {
        errors.push('Last name must be at least 2 characters');
    }
    
    return errors;
}

// ==========================================
// ASIA/MANILA TIMEZONE HELPERS (Render & Global)
// ==========================================
function parseAsiaManilaDate(dateVal) {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
        const trimmed = dateVal.trim();
        // Pure date "YYYY-MM-DD"
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return new Date(`${trimmed}T00:00:00+08:00`);
        }
        // If string lacks timezone offset or Z, it originates from MySQL (+08:00)
        if (!trimmed.includes('Z') && !trimmed.includes('+') && !trimmed.match(/-\d{2}:\d{2}$/)) {
            return new Date(trimmed.replace(' ', 'T') + '+08:00');
        }
        return new Date(trimmed);
    }
    return new Date(dateVal);
}

function formatAsiaManilaDateTime(dateVal, options = {}) {
    const d = parseAsiaManilaDate(dateVal);
    if (!d || isNaN(d.getTime())) return String(dateVal || '—');
    return d.toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        ...options
    });
}

function formatAsiaManilaDate(dateVal, options = {}) {
    const d = parseAsiaManilaDate(dateVal);
    if (!d || isNaN(d.getTime())) return String(dateVal || '—');
    return d.toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...options
    });
}

function formatAsiaManilaTime(dateVal, options = {}) {
    const d = parseAsiaManilaDate(dateVal);
    if (!d || isNaN(d.getTime())) return String(dateVal || '—');
    return d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        ...options
    });
}

// Expose globally
window.parseAsiaManilaDate = parseAsiaManilaDate;
window.formatAsiaManilaDateTime = formatAsiaManilaDateTime;
window.formatAsiaManilaDate = formatAsiaManilaDate;
window.formatAsiaManilaTime = formatAsiaManilaTime;

// ==========================================
// GOOGLE DRIVE LINK VALIDATION
// ==========================================
function isGoogleDriveLink(url) {
    if (!url || typeof url !== 'string') return false;
    let trimmed = url.trim();
    if (!trimmed) return false;
    if (!/^https?:\/\//i.test(trimmed)) {
        trimmed = 'https://' + trimmed;
    }
    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        return host === 'drive.google.com' || host === 'docs.google.com';
    } catch (e) {
        return false;
    }
}

function normalizeGoogleDriveLink(url) {
    if (!url || typeof url !== 'string') return '';
    let trimmed = url.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
        trimmed = 'https://' + trimmed;
    }
    return trimmed;
}

window.isGoogleDriveLink = isGoogleDriveLink;
window.normalizeGoogleDriveLink = normalizeGoogleDriveLink;

