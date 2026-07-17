// Shared Sidebar Loader
class SidebarLoader {
    static async loadSidebar() {
        try {
            const response = await fetch('/client/components/sidebar.html');
            const sidebarHTML = await response.text();
            
            // Find sidebar placeholder or create one
            let sidebarContainer = document.querySelector('.sidebar');
            if (!sidebarContainer) {
                // If no sidebar exists, insert it at the beginning of body
                const dashboardLayout = document.querySelector('.dashboard-layout');
                if (dashboardLayout) {
                    dashboardLayout.insertAdjacentHTML('afterbegin', sidebarHTML);
                } else {
                    document.body.insertAdjacentHTML('afterbegin', `
                        <div class="dashboard-layout">
                            ${sidebarHTML}
                            <main class="main-content">
                                <!-- Content will be loaded here -->
                            </main>
                        </div>
                    `);
                }
            }
            
            // Initialize active navigation
            this.setActiveNavigation();
            
        } catch (error) {
            console.error('Failed to load sidebar:', error);
        }
    }
    
    static setActiveNavigation() {
        const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
        const navLinks = {
            'dashboard': 'nav-dashboard',
            'book': 'nav-book', 
            'calendar': 'nav-calendar',
            'bookings': 'nav-bookings'
        };
        
        // Remove all active classes
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Add active class to current page
        const activeId = navLinks[currentPage];
        if (activeId) {
            document.getElementById(activeId)?.classList.add('active');
        }
    }
}

// Auto-load sidebar when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    SidebarLoader.loadSidebar();
});

// Export for use in other files
window.SidebarLoader = SidebarLoader;
