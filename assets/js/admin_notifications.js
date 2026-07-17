/**
 * admin_notifications.js
 * Real-time new booking notifications for SnailShutter admin pages.
 */

(function () {
    let eventSource = null;

    // Only run if user is admin
    async function init() {
        if (typeof auth === 'undefined') return;
        
        // Wait for auth to initialize if it hasn't
        if (!auth.currentUser) {
            await auth.init();
        }

        if (!auth.isLoggedIn() || (auth.getUserRole() !== 'admin' && auth.getUserRole() !== 'staff')) {
            return;
        }

        console.log('[Notifications] Initializing admin notification center...');
        createNotificationUI();
        renderNotifications();
        connectSSE();
    }

    function createNotificationUI() {
        if (document.getElementById('adminNotificationCenter')) return;

        // Container
        const container = document.createElement('div');
        container.className = 'admin-notification-center';
        container.id = 'adminNotificationCenter';

        // Floating Bell Icon & dropdown
        container.innerHTML = `
            <button class="notification-bell-btn" id="notificationBellBtn" aria-label="Notifications">
                <i class="fas fa-bell"></i>
                <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
            </button>
            <div class="notification-dropdown" id="notificationDropdown">
                <div class="dropdown-header">
                    <h4>New Bookings</h4>
                    <button class="btn-mark-all" id="markAllReadBtn">Mark all read</button>
                </div>
                <div class="dropdown-body" id="notificationList">
                    <div class="empty-notifications">
                        <i class="fas fa-calendar-check"></i>
                        <p>No new bookings</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Click handler to toggle dropdown
        const bellBtn = document.getElementById('notificationBellBtn');
        const dropdown = document.getElementById('notificationDropdown');
        
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        // Click outside closes dropdown
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        // Mark all read button
        const markAllBtn = document.getElementById('markAllReadBtn');
        markAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markAllRead();
        });
    }

    function getStoredNotifications() {
        const data = sessionStorage.getItem('admin_notifications');
        return data ? JSON.parse(data) : [];
    }

    function saveNotifications(notifications) {
        sessionStorage.setItem('admin_notifications', JSON.stringify(notifications));
    }

    function markAsRead(id) {
        const list = getStoredNotifications();
        const updated = list.map(n => {
            if (n.id === id) {
                return { ...n, read: true };
            }
            return n;
        });
        saveNotifications(updated);
        renderNotifications();
    }

    function markAllRead() {
        const list = getStoredNotifications();
        const updated = list.map(n => ({ ...n, read: true }));
        saveNotifications(updated);
        renderNotifications();
    }

    function renderNotifications() {
        const list = getStoredNotifications();
        const badge = document.getElementById('notificationBadge');
        const listContainer = document.getElementById('notificationList');
        
        if (!badge || !listContainer) return;

        const unreadCount = list.filter(n => !n.read).length;

        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        if (list.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-calendar-check"></i>
                    <p>No new bookings</p>
                </div>
            `;
        } else {
            listContainer.innerHTML = list.map(n => {
                const formattedDate = new Date(n.booking_date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                const timeAgo = formatTimeAgo(new Date(n.created_at));
                
                return `
                    <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
                        <div class="notification-item-icon">
                            <i class="fas fa-camera"></i>
                        </div>
                        <div class="notification-item-content">
                            <div class="notification-text">
                                <strong>${escapeHtml(n.client_name)}</strong> booked <strong>${escapeHtml(n.service_name)}</strong>
                            </div>
                            <div class="notification-meta">
                                <span class="notification-time-details">
                                    <i class="far fa-calendar-alt"></i> ${formattedDate} @ ${n.start_time}
                                </span>
                                <span class="notification-ago">${timeAgo}</span>
                            </div>
                        </div>
                        ${!n.read ? `<button class="btn-item-read" title="Mark as read" data-mark-read-id="${n.id}"><i class="fas fa-circle"></i></button>` : ''}
                    </div>
                `;
            }).join('');

            // Click handler to mark item read and redirect when clicked
            listContainer.querySelectorAll('.notification-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const id = item.getAttribute('data-id');
                    if (id) {
                        markAsRead(parseInt(id));
                        
                        const rolePath = auth.getUserRole() === 'admin' ? 'admin' : 'staff';
                        const targetUrl = `/${rolePath}/bookings.html#booking-${id}`;
                        if (window.location.pathname.includes(`/${rolePath}/bookings.html`) && window.location.hash === `#booking-${id}`) {
                            // Already on target page and same booking highlighted - force re-run highlight trigger
                            window.dispatchEvent(new HashChangeEvent('hashchange'));
                        } else {
                            window.location.href = targetUrl;
                        }
                    }
                });
            });
        }
    }

    function connectSSE() {
        eventSource = new EventSource('/api/availability/admin-stream', { withCredentials: true });

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'new_booking') {
                    handleNewBooking(data.booking);
                }
            } catch (err) {
                console.error('[Notifications] SSE parsing error:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('[Notifications] SSE error, reconnecting...', err);
        };
    }

    function handleNewBooking(booking) {
        console.log('[Notifications] New booking received:', booking);

        // Add to stored notifications
        const list = getStoredNotifications();
        
        // Prevent duplicate IDs (in case of double reconnect/messages)
        if (list.some(n => n.id === booking.id)) return;

        list.unshift({
            id: booking.id,
            client_name: booking.client_name,
            service_name: booking.service_name,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            created_at: booking.created_at || new Date().toISOString(),
            read: false
        });

        // Keep last 20 notifications only
        if (list.length > 20) {
            list.pop();
        }

        saveNotifications(list);
        renderNotifications();
        playChime();
        ringBell();

        // Show standard toast alert if showAlert function exists
        if (typeof showAlert === 'function') {
            showAlert(`New Booking: ${booking.client_name} booked ${booking.service_name} on ${new Date(booking.booking_date).toLocaleDateString()} @ ${booking.start_time}`, 'success');
        }

        // Custom window event for pages to hook into if they wish
        window.dispatchEvent(new CustomEvent('newBookingReceived', { detail: booking }));
    }

    function ringBell() {
        const bellBtn = document.getElementById('notificationBellBtn');
        if (!bellBtn) return;

        bellBtn.classList.remove('ring-animation');
        void bellBtn.offsetWidth; // Trigger reflow to restart animation
        bellBtn.classList.add('ring-animation');
    }

    function playChime() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const now = audioCtx.currentTime;
            
            // Sweet notification double chime
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(659.25, now); // E5
            gain1.gain.setValueAtTime(0.12, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880.00, now + 0.1); // A5
            gain2.gain.setValueAtTime(0.12, now + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            
            osc1.start(now);
            osc1.stop(now + 0.4);
            
            osc2.start(now + 0.1);
            osc2.stop(now + 0.6);
        } catch (e) {
            console.warn('[Notifications] Audio chime could not play:', e);
        }
    }

    function formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 5) return 'Just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Explicitly close EventSource on page unload to prevent HTTP/1.1 connection queue limits
    function cleanup() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
            console.log('[Notifications] Closed SSE connection on page unload.');
        }
    }

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);

    // Run on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
