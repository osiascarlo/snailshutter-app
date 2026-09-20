/**
 * admin_notifications.js
 * Persistent real-time and offline new booking notifications for SnailShutter admin/staff pages.
 * Ensures notifications are functional and visible even if admin/staff was offline/logged out when bookings were created.
 */

(function () {
    let eventSource = null;
    let isInitialized = false;

    // Only run if user is admin or staff
    async function init() {
        if (typeof auth === 'undefined') return;
        
        // Wait for auth to initialize if it hasn't
        if (!auth.currentUser) {
            await auth.init();
        }

        if (!auth.isLoggedIn() || (auth.getUserRole() !== 'admin' && auth.getUserRole() !== 'staff')) {
            return;
        }

        if (isInitialized) return;
        isInitialized = true;

        console.log('[Notifications] Initializing admin notification center...');
        createNotificationUI();
        
        // 1. Immediately render cached notifications from localStorage (zero delay/flicker)
        renderNotifications();
        
        // 2. Fetch recent bookings from server to catch any bookings created while admin was logged out/offline
        await loadInitialNotifications();
        
        // 3. Connect real-time SSE stream for live bookings
        connectSSE();

        // 4. Sync across browser tabs
        window.addEventListener('storage', handleStorageChange);

        // 5. Listen to local booking status changes
        window.addEventListener('bookingStatusChanged', handleBookingStatusChanged);
    }

    function getUserId() {
        try {
            if (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.id) {
                return auth.currentUser.id;
            }
            if (typeof auth !== 'undefined' && typeof auth.getUserId === 'function') {
                return auth.getUserId();
            }
        } catch (e) {}
        return 'default';
    }

    function getReadMap() {
        try {
            const uid = getUserId();
            const raw = localStorage.getItem(`admin_notifs_read_${uid}`);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveReadMap(map) {
        try {
            const uid = getUserId();
            localStorage.setItem(`admin_notifs_read_${uid}`, JSON.stringify(map));
        } catch (e) {
            console.error('[Notifications] Failed to save read map:', e);
        }
    }

    function getStoredNotifications() {
        try {
            const uid = getUserId();
            const data = localStorage.getItem(`admin_notifications_${uid}`);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function saveNotifications(notifications) {
        try {
            const uid = getUserId();
            localStorage.setItem(`admin_notifications_${uid}`, JSON.stringify(notifications));
        } catch (e) {
            console.error('[Notifications] Failed to save notifications:', e);
        }
    }

    function createNotificationUI() {
        if (document.getElementById('adminNotificationCenter')) return;

        // Container
        const container = document.createElement('div');
        container.className = 'admin-notification-center';
        container.id = 'adminNotificationCenter';

        // Bell Button
        container.innerHTML = `
            <button class="notification-bell-btn" id="notificationBellBtn" aria-label="Notifications" title="Notifications">
                <i class="fas fa-bell"></i>
                <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
            </button>
        `;

        // Check if page has a .page-hero to integrate into
        const pageHero = document.querySelector('.page-hero');
        if (pageHero) {
            container.classList.add('in-hero');
            pageHero.appendChild(container);
        } else {
            container.classList.add('floating');
            document.body.appendChild(container);
        }

        // Create dropdown portaled directly to document.body to prevent clipping by overflow:hidden
        let dropdown = document.getElementById('notificationDropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'notification-dropdown';
            dropdown.id = 'notificationDropdown';
            dropdown.innerHTML = `
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
            `;
            document.body.appendChild(dropdown);
        }

        const bellBtn = document.getElementById('notificationBellBtn');

        function positionDropdown() {
            if (!bellBtn || !dropdown) return;
            const rect = bellBtn.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.top = `${rect.bottom + 10}px`;
            dropdown.style.right = `${Math.max(16, window.innerWidth - rect.right)}px`;
            dropdown.style.zIndex = '99999';
        }

        // Click handler to toggle dropdown
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willBeActive = !dropdown.classList.contains('active');
            if (willBeActive) {
                positionDropdown();
            }
            dropdown.classList.toggle('active');
        });

        // Reposition on window resize or scroll
        window.addEventListener('resize', () => {
            if (dropdown.classList.contains('active')) positionDropdown();
        });
        window.addEventListener('scroll', () => {
            if (dropdown.classList.contains('active')) positionDropdown();
        }, { passive: true });

        // Click outside closes dropdown
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target) && !dropdown.contains(e.target)) {
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

    async function loadInitialNotifications() {
        try {
            let bookings = [];
            if (typeof api !== 'undefined' && typeof api.getBookings === 'function') {
                const res = await api.getBookings();
                if (res && res.data) {
                    bookings = res.data;
                }
            } else {
                const res = await fetch('/api/bookings', { credentials: 'include' });
                const json = await res.json();
                if (json && json.data) {
                    bookings = json.data;
                }
            }

            if (!Array.isArray(bookings)) return;

            const readMap = getReadMap();

            // Sort newest first by created_at or id
            const sorted = [...bookings].sort((a, b) => {
                const parseD = (val) => (typeof window.parseAsiaManilaDate === 'function' ? window.parseAsiaManilaDate(val) : new Date(val));
                const timeA = (parseD(a.created_at || a.booking_date) || new Date()).getTime();
                const timeB = (parseD(b.created_at || b.booking_date) || new Date()).getTime();
                if (timeB !== timeA) return timeB - timeA;
                return (b.id || 0) - (a.id || 0);
            });

            // Take the most recent 25 bookings
            const recent = sorted.slice(0, 25);

            const notifs = recent.map(b => {
                const id = b.id;
                let isRead = false;
                if (readMap.hasOwnProperty(id)) {
                    isRead = Boolean(readMap[id]);
                } else {
                    // If not yet recorded in readMap:
                    // Completed or cancelled bookings are treated as already read
                    if (b.status === 'completed' || b.status === 'cancelled') {
                        isRead = true;
                    } else {
                        // Pending or newly confirmed bookings are unread
                        isRead = false;
                    }
                }

                return {
                    id: b.id,
                    client_name: b.client_name || 'Client',
                    service_name: b.service_name || 'Photography Session',
                    booking_date: b.booking_date,
                    start_time: b.start_time,
                    end_time: b.end_time,
                    status: b.status || 'pending',
                    created_at: b.created_at || new Date().toISOString(),
                    read: isRead
                };
            });

            saveNotifications(notifs);
            renderNotifications();

            const unreadCount = notifs.filter(n => !n.read).length;
            if (unreadCount > 0) {
                ringBell();
            }

        } catch (err) {
            console.error('[Notifications] Error fetching initial notifications:', err);
            renderNotifications();
        }
    }

    function markAsRead(id) {
        const readMap = getReadMap();
        readMap[id] = true;
        saveReadMap(readMap);

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
        const readMap = getReadMap();
        const list = getStoredNotifications();
        list.forEach(n => {
            readMap[n.id] = true;
        });
        saveReadMap(readMap);

        const updated = list.map(n => ({ ...n, read: true }));
        saveNotifications(updated);
        renderNotifications();
    }

    function handleStorageChange(e) {
        const uid = getUserId();
        if (e.key === `admin_notifications_${uid}` || e.key === `admin_notifs_read_${uid}`) {
            renderNotifications();
        }
    }

    function handleBookingStatusChanged(e) {
        const { bookingId, status } = e.detail || {};
        if (!bookingId) return;
        const list = getStoredNotifications();
        const item = list.find(n => n.id === parseInt(bookingId));
        if (item) {
            item.status = status;
            saveNotifications(list);
            renderNotifications();
        }
    }

    function renderNotifications() {
        const list = getStoredNotifications();
        const badge = document.getElementById('notificationBadge');
        const listContainer = document.getElementById('notificationList');
        
        if (!badge || !listContainer) return;

        const unreadCount = list.filter(n => !n.read).length;

        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
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
                let formattedDate = '—';
                if (n.booking_date) {
                    try {
                        formattedDate = typeof window.formatAsiaManilaDate === 'function'
                            ? window.formatAsiaManilaDate(n.booking_date, { month: 'short', day: 'numeric', year: 'numeric' })
                            : new Date(n.booking_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
                    } catch (e) {
                        formattedDate = n.booking_date;
                    }
                }
                const createdDate = (typeof window.parseAsiaManilaDate === 'function' ? window.parseAsiaManilaDate(n.created_at) : null) || new Date(n.created_at || Date.now());
                const timeAgo = formatTimeAgo(createdDate);
                
                let statusBadge = '';
                const st = (n.status || 'pending').toLowerCase();
                if (st === 'pending') {
                    statusBadge = `<span style="font-size:0.65rem; font-weight:700; padding:0.1rem 0.45rem; border-radius:20px; text-transform:uppercase; background:#fef3c7; color:#92400e; margin-left:0.35rem;">Pending</span>`;
                } else if (st === 'confirmed') {
                    statusBadge = `<span style="font-size:0.65rem; font-weight:700; padding:0.1rem 0.45rem; border-radius:20px; text-transform:uppercase; background:#ecfdf5; color:#065f46; margin-left:0.35rem;">Confirmed</span>`;
                } else if (st === 'completed') {
                    statusBadge = `<span style="font-size:0.65rem; font-weight:700; padding:0.1rem 0.45rem; border-radius:20px; text-transform:uppercase; background:#ede9fe; color:#5b21b6; margin-left:0.35rem;">Completed</span>`;
                } else if (st === 'cancelled') {
                    statusBadge = `<span style="font-size:0.65rem; font-weight:700; padding:0.1rem 0.45rem; border-radius:20px; text-transform:uppercase; background:#fee2e2; color:#991b1b; margin-left:0.35rem;">Cancelled</span>`;
                }

                return `
                    <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
                        <div class="notification-item-icon">
                            <i class="fas fa-camera"></i>
                        </div>
                        <div class="notification-item-content">
                            <div class="notification-text">
                                <strong>${escapeHtml(n.client_name)}</strong> booked <strong>${escapeHtml(n.service_name)}</strong>
                                ${statusBadge}
                            </div>
                            <div class="notification-meta">
                                <span class="notification-time-details">
                                    <i class="far fa-calendar-alt"></i> ${formattedDate} @ ${n.start_time || '—'}
                                </span>
                                <span class="notification-ago">${timeAgo}</span>
                            </div>
                        </div>
                        ${!n.read ? `<button class="btn-item-read" title="Mark as read" data-mark-read-id="${n.id}"><i class="fas fa-circle"></i></button>` : ''}
                    </div>
                `;
            }).join('');

            // Individual mark-read button handler
            listContainer.querySelectorAll('.btn-item-read').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.getAttribute('data-mark-read-id');
                    if (id) {
                        markAsRead(parseInt(id));
                    }
                });
            });

            // Click handler on item to mark read and redirect
            listContainer.querySelectorAll('.notification-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.getAttribute('data-id');
                    if (id) {
                        markAsRead(parseInt(id));
                        
                        const rolePath = auth.getUserRole() === 'admin' ? 'admin' : 'staff';
                        const targetUrl = `/${rolePath}/bookings.html#booking-${id}`;
                        
                        if (window.location.pathname.includes(`/${rolePath}/bookings.html`)) {
                            if (window.location.hash === `#booking-${id}`) {
                                window.dispatchEvent(new HashChangeEvent('hashchange'));
                            } else {
                                window.location.hash = `#booking-${id}`;
                            }
                            if (typeof openBookingDetailsModal === 'function') {
                                openBookingDetailsModal(parseInt(id));
                            }
                        } else {
                            window.location.href = targetUrl;
                        }
                    }
                });
            });
        }
    }

    function connectSSE() {
        try {
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
        } catch (e) {
            console.error('[Notifications] Failed to start EventSource:', e);
        }
    }

    function handleNewBooking(booking) {
        console.log('[Notifications] New booking received via SSE:', booking);

        const list = getStoredNotifications();
        
        // If already in list, update it
        const existingIndex = list.findIndex(n => n.id === booking.id);
        const newNotif = {
            id: booking.id,
            client_name: booking.client_name || 'Client',
            service_name: booking.service_name || 'Photography Session',
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            status: booking.status || 'pending',
            created_at: booking.created_at || new Date().toISOString(),
            read: false
        };

        if (existingIndex >= 0) {
            list[existingIndex] = newNotif;
        } else {
            list.unshift(newNotif);
        }

        // Keep last 25 notifications
        if (list.length > 25) {
            list.pop();
        }

        saveNotifications(list);
        renderNotifications();
        playChime();
        ringBell();

        // Show standard toast alert if showAlert function exists
        if (typeof showAlert === 'function') {
            const dateStr = booking.booking_date ? (typeof window.formatAsiaManilaDate === 'function' ? window.formatAsiaManilaDate(booking.booking_date) : new Date(booking.booking_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' })) : '';
            showAlert(`New Booking: ${booking.client_name} booked ${booking.service_name} on ${dateStr} @ ${booking.start_time}`, 'success');
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
        if (!date || isNaN(date.getTime())) return 'Recently';
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
        return String(str)
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
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('bookingStatusChanged', handleBookingStatusChanged);
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
