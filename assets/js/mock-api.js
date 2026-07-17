// Mock API for testing without PHP backend
class MockAPI {
    constructor() {
        this.users = [
            {
                id: 1,
                email: 'admin@studio.com',
                password: 'admin123',
                name: 'Admin User',
                role: 'admin'
            },
            {
                id: 2,
                email: 'maria@studio.com',
                password: 'admin123',
                name: 'Maria Garcia',
                role: 'staff'
            },
            {
                id: 3,
                email: 'carlos@studio.com',
                password: 'admin123',
                name: 'Carlos Rodriguez',
                role: 'staff'
            },
            {
                id: 4,
                email: 'juan@gmail.com',
                password: 'admin123',
                name: 'Juan Santos',
                role: 'client'
            }
        ];
        this.currentUser = null;
    }

    async login(email, password) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('='.repeat(50));
        console.log('LOGIN ATTEMPT');
        console.log('='.repeat(50));
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log(`Total users in database: ${this.users.length}`);
        console.log('All users:', this.users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role })));
        
        const user = this.users.find(u => u.email === email && u.password === password);
        
        console.log(`Found user: ${user ? 'YES' : 'NO'}`);
        if (user) {
            console.log(`User details:`, { id: user.id, email: user.email, name: user.name, role: user.role });
        }
        console.log('='.repeat(50));
        
        if (user) {
            this.currentUser = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            };
            
            // Store in sessionStorage
            sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            
            console.log('Login successful! Current user set:', this.currentUser);
            
            return {
                success: true,
                data: this.currentUser
            };
        }
        
        console.log('Login failed: Invalid email or password');
        return {
            success: false,
            error: 'Invalid email or password'
        };
    }

    async logout() {
        this.currentUser = null;
        sessionStorage.removeItem('currentUser');
        return { success: true };
    }

    async getSession() {
        // Check sessionStorage for current user
        const storedUser = sessionStorage.getItem('currentUser');
        
        if (storedUser) {
            this.currentUser = JSON.parse(storedUser);
            return {
                success: true,
                data: this.currentUser
            };
        }
        
        return {
            success: false,
            error: 'No active session'
        };
    }

    async register(userData) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if user already exists
        const existingUser = this.users.find(u => u.email === userData.email);
        if (existingUser) {
            return {
                success: false,
                error: 'Email already registered'
            };
        }
        
        // Create new user (client role only)
        const newUser = {
            id: this.users.length + 1,
            email: userData.email,
            password: userData.password,
            name: userData.fullName,
            phone: userData.phone || '',
            role: 'client', // Force client role
            status: 'active',
            email_verified: false,
            created_at: new Date().toISOString()
        };
        
        this.users.push(newUser);
        
        // Store in sessionStorage
        sessionStorage.setItem('users', JSON.stringify(this.users));
        
        return {
            success: true,
            message: 'Registration successful! Please check your email for verification.',
            data: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                role: newUser.role,
                status: newUser.status
            }
        };
    }

    // OTP Verification Methods
    async sendOTP(email) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP in sessionStorage (in real app, this would be sent via email)
        const otpData = {
            email: email,
            otp: otp,
            timestamp: Date.now(),
            expires_at: Date.now() + (10 * 60 * 1000), // 10 minutes
            attempts: 0,
            max_attempts: 3
        };
        
        sessionStorage.setItem('currentOTP', JSON.stringify(otpData));
        
        // Simulate sending email with detailed information
        const emailContent = {
            to: email,
            subject: 'SnailShutter - Email Verification Code',
            body: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 10px;">
                        <h2 style="color: #007bff; margin-bottom: 20px;">SnailShutter Photography</h2>
                        <h3 style="color: #333; margin-bottom: 10px;">Email Verification</h3>
                        <p style="color: #666; margin-bottom: 30px;">Thank you for registering with SnailShutter! Please use the verification code below to complete your registration.</p>
                        
                        <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px;">Your Verification Code:</p>
                            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 10px 0;">${otp}</div>
                        </div>
                        
                        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; color: #856404; font-size: 14px;">
                                <strong>Important:</strong> This code will expire in 10 minutes. Please do not share this code with anyone.
                            </p>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 30px;">
                            If you didn't request this verification, please ignore this email or contact our support team.
                        </p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <p style="color: #999; font-size: 12px; margin: 0;">
                                SnailShutter Photography Studio<br>
                                Professional Photography Services<br>
                                © 2024 SnailShutter. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            `
        };
        
        // Log the email content for testing (in production, this would be sent via email service)
        console.log('='.repeat(50));
        console.log('EMAIL SIMULATION - OTP VERIFICATION');
        console.log('='.repeat(50));
        console.log(`To: ${emailContent.to}`);
        console.log(`Subject: ${emailContent.subject}`);
        console.log(`OTP Code: ${otp}`);
        console.log(`Expires: ${new Date(otpData.expires_at).toLocaleString()}`);
        console.log('='.repeat(50));
        console.log('EMAIL CONTENT:');
        console.log(emailContent.body);
        console.log('='.repeat(50));
        
        // Store email in session for debugging
        sessionStorage.setItem('lastEmail', JSON.stringify({
            ...emailContent,
            otp: otp,
            sent_at: new Date().toISOString()
        }));
        
        return {
            success: true,
            message: 'Verification code sent to your email',
            otp: otp, // Return OTP for testing (remove in production)
            email: email,
            expires_at: otpData.expires_at
        };
    }

    async verifyAndRegister(userData, otp) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Debug logging
        console.log('='.repeat(50));
        console.log('OTP VERIFICATION ATTEMPT');
        console.log('='.repeat(50));
        console.log(`Email: ${userData.email}`);
        console.log(`Entered OTP: "${otp}"`);
        console.log(`OTP Length: ${otp.length}`);
        
        // Get stored OTP
        const storedOTPData = sessionStorage.getItem('currentOTP');
        if (!storedOTPData) {
            console.log('ERROR: No OTP data found in session');
            return {
                success: false,
                error: 'No verification code found. Please request a new one.'
            };
        }
        
        const otpData = JSON.parse(storedOTPData);
        console.log(`Stored OTP: "${otpData.otp}"`);
        console.log(`Stored Email: "${otpData.email}"`);
        console.log(`Expires: ${new Date(otpData.expires_at).toLocaleString()}`);
        console.log(`Attempts: ${otpData.attempts}/${otpData.max_attempts}`);
        console.log('='.repeat(50));
        
        // Check if email matches
        if (otpData.email !== userData.email) {
            console.log('ERROR: Email mismatch');
            return {
                success: false,
                error: 'Email mismatch. Please try again.'
            };
        }
        
        // Check if OTP has expired
        if (Date.now() > otpData.expires_at) {
            console.log('ERROR: OTP expired');
            sessionStorage.removeItem('currentOTP');
            return {
                success: false,
                error: 'Verification code has expired. Please request a new one.'
            };
        }
        
        // Check attempts
        if (otpData.attempts >= otpData.max_attempts) {
            console.log('ERROR: Too many attempts');
            sessionStorage.removeItem('currentOTP');
            return {
                success: false,
                error: 'Too many failed attempts. Please request a new verification code.'
            };
        }
        
        // Increment attempts
        otpData.attempts++;
        sessionStorage.setItem('currentOTP', JSON.stringify(otpData));
        
        // Check if OTP matches - be very precise about comparison
        const enteredOTP = otp.trim();
        const storedOTP = otpData.otp.toString().trim();
        
        console.log(`Comparison:`);
        console.log(`  Entered: "${enteredOTP}" (length: ${enteredOTP.length})`);
        console.log(`  Stored: "${storedOTP}" (length: ${storedOTP.length})`);
        console.log(`  Match: ${enteredOTP === storedOTP}`);
        console.log(`  Strict equality: ${enteredOTP === storedOTP}`);
        console.log(`  Type check - Entered: ${typeof enteredOTP}, Stored: ${typeof storedOTP}`);
        
        // Try multiple comparison methods to ensure success
        const isMatch = enteredOTP === storedOTP || 
                        enteredOTP === otpData.otp || 
                        otp === storedOTP || 
                        otp === otpData.otp;
        
        console.log(`  Final match result: ${isMatch}`);
        
        if (!isMatch) {
            const remainingAttempts = otpData.max_attempts - otpData.attempts;
            console.log(`ERROR: OTP mismatch - ${remainingAttempts} attempts remaining`);
            return {
                success: false,
                error: `Invalid verification code. ${remainingAttempts} attempts remaining.`
            };
        }
        
        console.log('SUCCESS: OTP verified!');
        
        // Check if user already exists
        const existingUser = this.users.find(u => u.email === userData.email);
        if (existingUser) {
            console.log('ERROR: Email already registered');
            sessionStorage.removeItem('currentOTP');
            return {
                success: false,
                error: 'Email already registered'
            };
        }
        
        // Create new user with verified email
        const newUser = {
            id: this.users.length + 1,
            email: userData.email,
            password: userData.password,
            name: userData.fullName,
            phone: userData.phone || '',
            role: 'client', // Force client role
            status: 'active',
            email_verified: true,
            verification_date: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        
        this.users.push(newUser);
        
        // Store in sessionStorage
        sessionStorage.setItem('users', JSON.stringify(this.users));
        
        // Clear OTP
        sessionStorage.removeItem('currentOTP');
        
        console.log(`User created: ${newUser.name} (${newUser.email})`);
        
        // Return success response
        const successResponse = {
            success: true,
            message: 'Account created successfully! Your email has been verified.',
            data: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                role: newUser.role,
                status: newUser.status,
                email_verified: newUser.email_verified,
                verification_date: newUser.verification_date
            }
        };
        
        console.log('API returning success response:', successResponse);
        return successResponse;
    }

    // Mock services API
    async getServices() {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        return {
            success: true,
            data: [
                {
                    id: 1,
                    name: '18th Birthday Package',
                    description: 'Professional 18th birthday photography session with complete coverage',
                    price: 1500,
                    duration_minutes: 60,
                    is_active: 1
                },
                {
                    id: 2,
                    name: 'Event Coverage',
                    description: 'Complete event photography coverage',
                    price: 5000,
                    duration_minutes: 240,
                    is_active: 1
                },
                {
                    id: 3,
                    name: 'Product Photography',
                    description: 'High-quality product photography for businesses',
                    price: 2000,
                    duration_minutes: 120,
                    is_active: 1
                },
                {
                    id: 4,
                    name: 'Wedding Photography',
                    description: 'Complete wedding day coverage',
                    price: 10000,
                    duration_minutes: 480,
                    is_active: 1
                },
                {
                    id: 5,
                    name: 'Corporate Headshots',
                    description: 'Professional headshots for business profiles',
                    price: 800,
                    duration_minutes: 30,
                    is_active: 1
                },
                {
                    id: 6,
                    name: 'Food Photography',
                    description: 'Beautiful food photography for restaurants',
                    price: 2500,
                    duration_minutes: 180,
                    is_active: 1
                },
                {
                    id: 7,
                    name: 'Real Estate Photography',
                    description: 'Professional property photography for listings',
                    price: 3500,
                    duration_minutes: 150,
                    is_active: 1
                },
                {
                    id: 8,
                    name: 'Fashion Photography',
                    description: 'Creative fashion photography for brands and designers',
                    price: 6000,
                    duration_minutes: 300,
                    is_active: 1
                }
            ]
        };
    }

    // Mock bookings API
    async getBookings() {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get current user from sessionStorage if not set
        if (!this.currentUser) {
            const currentUser = sessionStorage.getItem('currentUser');
            if (currentUser) {
                this.currentUser = JSON.parse(currentUser);
            }
        }
        
        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }
        
        // Return mock bookings based on user role
        if (this.currentUser.role === 'admin') {
            return {
                success: true,
                data: [
                    {
                        id: 1,
                        service_name: 'Portrait Photography',
                        client_name: 'John Doe',
                        booking_date: '2026-03-15',
                        start_time: '10:00',
                        end_time: '11:00',
                        status: 'confirmed'
                    },
                    {
                        id: 2,
                        service_name: 'Event Coverage',
                        client_name: 'Jane Smith',
                        booking_date: '2026-03-20',
                        start_time: '14:00',
                        end_time: '18:00',
                        status: 'pending'
                    },
                    {
                        id: 3,
                        service_name: 'Wedding Photography',
                        client_name: 'Mike Johnson',
                        booking_date: '2026-03-25',
                        start_time: '09:00',
                        end_time: '17:00',
                        status: 'confirmed'
                    }
                ]
            };
        } else if (this.currentUser.role === 'staff') {
            return {
                success: true,
                data: [
                    {
                        id: 1,
                        service_name: 'Portrait Photography',
                        client_name: 'John Doe',
                        booking_date: '2026-03-15',
                        start_time: '10:00',
                        end_time: '11:00',
                        status: 'confirmed'
                    },
                    {
                        id: 3,
                        service_name: 'Wedding Photography',
                        client_name: 'Mike Johnson',
                        booking_date: '2026-03-25',
                        start_time: '09:00',
                        end_time: '17:00',
                        status: 'confirmed'
                    }
                ]
            };
        } else if (this.currentUser.role === 'client') {
            return {
                success: true,
                data: [
                    {
                        id: 1,
                        service_name: 'Portrait Photography',
                        booking_date: '2026-03-15',
                        start_time: '10:00',
                        end_time: '11:00',
                        staff_name: 'Maria Garcia',
                        status: 'confirmed'
                    },
                    {
                        id: 2,
                        service_name: 'Event Coverage',
                        booking_date: '2026-04-10',
                        start_time: '14:00',
                        end_time: '18:00',
                        staff_name: 'Carlos Rodriguez',
                        status: 'pending'
                    }
                ]
            };
        }
        
        return { success: true, data: [] };
    }

    // Mock booking update API
    async updateBooking(bookingId, action) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }
        
        // For mock, we'll just return success
        const actionText = action === 'confirm' ? 'confirmed' : 
                          action === 'complete' ? 'completed' : 
                          action === 'cancel' ? 'cancelled' : 'updated';
        
        return {
            success: true,
            message: `Booking ${actionText} successfully`
        };
    }

    // Mock create booking API
    async createBooking(bookingData) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get current user from sessionStorage if not set
        if (!this.currentUser) {
            const currentUser = sessionStorage.getItem('currentUser');
            if (currentUser) {
                this.currentUser = JSON.parse(currentUser);
            }
        }
        
        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }
        
        // Check for conflicts
        const conflicts = this.checkBookingConflicts(bookingData);
        if (conflicts.length > 0) {
            return {
                success: false,
                error: 'Booking conflict detected',
                conflicts: conflicts
            };
        }
        
        // In a real app, this would save to database
        // For mock, we'll just return success
        const newBooking = {
            id: Math.floor(Math.random() * 1000) + 1,
            ...bookingData,
            status: 'pending',
            created_at: new Date().toISOString(),
            has_conflict: false
        };
        
        return {
            success: true,
            message: 'Booking created successfully',
            data: newBooking
        };
    }
    
    // Conflict detection method
    checkBookingConflicts(newBooking) {
        const conflicts = [];
        
        // Mock existing bookings (in real app, this would query database)
        // Use current year to avoid conflicts with past dates
        const currentYear = new Date().getFullYear();
        const existingBookings = [
            {
                booking_date: `${currentYear}-03-15`,
                start_time: '10:00',
                end_time: '11:00',
                service_name: 'Portrait Photography'
            },
            {
                booking_date: `${currentYear}-03-20`,
                start_time: '14:00',
                end_time: '16:00',
                service_name: 'Event Coverage'
            },
            {
                booking_date: `${currentYear}-03-25`,
                start_time: '09:00',
                end_time: '12:00',
                service_name: 'Wedding Photography'
            }
        ];
        
        existingBookings.forEach(booking => {
            if (booking.booking_date === newBooking.booking_date) {
                // Check time overlap
                const newStart = newBooking.start_time;
                const newEnd = newBooking.end_time;
                const existingStart = booking.start_time;
                const existingEnd = booking.end_time;
                
                if ((newStart >= existingStart && newStart < existingEnd) ||
                    (newEnd > existingStart && newEnd <= existingEnd) ||
                    (newStart <= existingStart && newEnd >= existingEnd)) {
                    conflicts.push({
                        booking: booking,
                        conflict_type: 'time_overlap'
                    });
                }
            }
        });
        
        return conflicts;
    }

    // Mock users API
    async getUsers() {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get current user from sessionStorage if not set
        if (!this.currentUser) {
            const currentUser = sessionStorage.getItem('currentUser');
            if (currentUser) {
                this.currentUser = JSON.parse(currentUser);
            }
        }
        
        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }
        
        // Get all users from different sources
        let allUsers = [
            {
                id: 1,
                first_name: 'Admin',
                last_name: 'User',
                email: 'admin@studio.com',
                role: 'admin',
                status: 'active',
                phone: '+63 912 345 6789',
                created_at: '2024-01-15T10:00:00Z',
                booking_count: 0,
                notes: 'Main administrator account'
            },
            {
                id: 2,
                first_name: 'Maria',
                last_name: 'Garcia',
                email: 'maria@studio.com',
                role: 'staff',
                status: 'active',
                phone: '+63 923 456 7890',
                created_at: '2024-01-10T08:30:00Z',
                booking_count: 12,
                notes: 'Senior photographer'
            },
            {
                id: 3,
                first_name: 'Carlos',
                last_name: 'Rodriguez',
                email: 'carlos@studio.com',
                role: 'staff',
                status: 'active',
                phone: '+63 934 567 8901',
                created_at: '2024-01-08T14:20:00Z',
                booking_count: 8,
                notes: 'Photographer'
            },
            {
                id: 4,
                first_name: 'Juan',
                last_name: 'Santos',
                email: 'juan@gmail.com',
                role: 'client',
                status: 'active',
                phone: '+63 945 678 9012',
                created_at: '2024-01-05T11:15:00Z',
                booking_count: 3,
                notes: 'Regular client'
            }
        ];
        
        // Add dynamically created users from sessionStorage
        const sessionUsers = JSON.parse(sessionStorage.getItem('users') || '[]');
        const dynamicUsers = sessionUsers.map((user, index) => ({
            id: 100 + index, // Start from 100 to avoid conflicts
            first_name: user.name.split(' ')[0] || user.name,
            last_name: user.name.split(' ').slice(1).join(' ') || '',
            email: user.email,
            role: user.role || 'client',
            status: user.status || 'active',
            phone: user.phone || '',
            created_at: user.created_at || new Date().toISOString(),
            booking_count: 0,
            notes: 'Registered via website'
        }));
        
        // Add locally stored users from localStorage
        const localUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const localDynamicUsers = localUsers.map((user, index) => ({
            id: 200 + index, // Start from 200 to avoid conflicts
            first_name: user.name.split(' ')[0] || user.name,
            last_name: user.name.split(' ').slice(1).join(' ') || '',
            email: user.email,
            role: user.role || 'client',
            status: user.status || 'active',
            phone: user.phone || '',
            created_at: user.created_at || new Date().toISOString(),
            booking_count: 0,
            notes: 'Registered via website'
        }));
        
        // Combine all users
        allUsers = [...allUsers, ...dynamicUsers, ...localDynamicUsers];
        
        return {
            success: true,
            data: allUsers
        };
    }
    
    async createUser(userData) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }
        
        // Check if email already exists
        const existingUsers = await this.getUsers();
        const emailExists = existingUsers.data.some(user => user.email === userData.email);
        
        if (emailExists) {
            return { success: false, error: 'Email already exists' };
        }
        
        // Create new user
        const newUser = {
            id: Math.floor(Math.random() * 1000) + 10,
            ...userData,
            created_at: new Date().toISOString(),
            booking_count: 0
        };
        
        return {
            success: true,
            message: 'User created successfully',
            data: newUser
        };
    }
    
    async updateUser(userId, userData) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }
        
        // Check if user exists
        const existingUsers = await this.getUsers();
        const userIndex = existingUsers.data.findIndex(user => user.id === parseInt(userId));
        
        if (userIndex === -1) {
            return { success: false, error: 'User not found' };
        }
        
        // Check if email already exists (excluding current user)
        if (userData.email) {
            const emailExists = existingUsers.data.some(user => 
                user.email === userData.email && user.id !== parseInt(userId)
            );
            
            if (emailExists) {
                return { success: false, error: 'Email already exists' };
            }
        }
        
        return {
            success: true,
            message: 'User updated successfully',
            data: { ...existingUsers.data[userIndex], ...userData }
        };
    }
    
    async deleteUser(userId) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }
        
        // Check if user exists
        const existingUsers = await this.getUsers();
        const user = existingUsers.data.find(user => user.id === parseInt(userId));
        
        if (!user) {
            return { success: false, error: 'User not found' };
        }
        
        // Prevent deletion of admin users
        if (user.role === 'admin') {
            return { success: false, error: 'Cannot delete admin users' };
        }
        
        return {
            success: true,
            message: 'User deleted successfully'
        };
    }
    async checkTimeSlots(date, serviceId) {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Generate mock time slots based on date and service
        const dayOfWeek = new Date(date).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Different slots for different services
        let slots = [];
        if (serviceId === 1) { // 18th Birthday Package
            slots = [
                { id: 1, start_time: '09:00', end_time: '10:00', slot_label: '9:00 AM - 10:00 AM' },
                { id: 2, start_time: '10:00', end_time: '11:00', slot_label: '10:00 AM - 11:00 AM' },
                { id: 3, start_time: '14:00', end_time: '15:00', slot_label: '2:00 PM - 3:00 PM' },
                { id: 4, start_time: '15:00', end_time: '16:00', slot_label: '3:00 PM - 4:00 PM' }
            ];
        } else if (serviceId === 4) { // Wedding Photography
            slots = [
                { id: 1, start_time: '08:00', end_time: '12:00', slot_label: '8:00 AM - 12:00 PM' },
                { id: 2, start_time: '14:00', end_time: '18:00', slot_label: '2:00 PM - 6:00 PM' }
            ];
        } else {
            // Default slots for other services
            slots = [
                { id: 1, start_time: '09:00', end_time: '10:00', slot_label: '9:00 AM - 10:00 AM' },
                { id: 2, start_time: '10:00', end_time: '11:00', slot_label: '10:00 AM - 11:00 AM' },
                { id: 3, start_time: '11:00', end_time: '12:00', slot_label: '11:00 AM - 12:00 PM' },
                { id: 4, start_time: '14:00', end_time: '15:00', slot_label: '2:00 PM - 3:00 PM' },
                { id: 5, start_time: '15:00', end_time: '16:00', slot_label: '3:00 PM - 4:00 PM' },
                { id: 6, start_time: '16:00', end_time: '17:00', slot_label: '4:00 PM - 5:00 PM' }
            ];
        }
        
        // Check for existing bookings and conflicts
        const existingBookings = [
            { booking_date: '2026-03-15', start_time: '10:00', end_time: '11:00' },
            { booking_date: '2026-03-20', start_time: '14:00', end_time: '16:00' },
            { booking_date: '2026-03-25', start_time: '09:00', end_time: '12:00' }
        ];
        
        const bookedSlots = [];
        const conflictSlots = [];
        
        existingBookings.forEach(booking => {
            if (booking.booking_date === date) {
                slots.forEach(slot => {
                    if ((slot.start_time >= booking.start_time && slot.start_time < booking.end_time) ||
                        (slot.end_time > booking.start_time && slot.end_time <= booking.end_time)) {
                        bookedSlots.push(slot.start_time);
                    }
                });
            }
        });
        
        // Simulate some slots being booked on weekends
        if (isWeekend) {
            bookedSlots.push('09:00', '15:00');
        } else {
            bookedSlots.push('10:00', '14:00');
        }
        
        return {
            success: true,
            available_slots: slots.filter(slot => !bookedSlots.includes(slot.start_time)),
            booked_slots: bookedSlots,
            conflict_slots: conflictSlots
        };
    }
}

// Replace the original api with mock
const mockAPI = new MockAPI();

// Override the api object
if (typeof window.api !== 'undefined') {
    console.log('='.repeat(50));
    console.log('MOCK API OVERRIDE: api object found, overriding methods...');
    console.log('='.repeat(50));
    
    // Keep original methods but replace with mock implementations
    window.api.login = mockAPI.login.bind(mockAPI);
    console.log('MOCK API: api.login overridden');
    
    window.api.logout = mockAPI.logout.bind(mockAPI);
    window.api.getSession = mockAPI.getSession.bind(mockAPI);
    window.api.register = mockAPI.register.bind(mockAPI);
    window.api.sendOTP = mockAPI.sendOTP.bind(mockAPI);
    window.api.verifyAndRegister = mockAPI.verifyAndRegister.bind(mockAPI);
    window.api.getServices = mockAPI.getServices.bind(mockAPI);
    window.api.getBookings = mockAPI.getBookings.bind(mockAPI);
    console.log('MOCK API: getBookings bound successfully');
    console.log('MOCK API: getBookings method type:', typeof window.api.getBookings);
    window.api.updateBooking = mockAPI.updateBooking.bind(mockAPI);
    window.api.createBooking = mockAPI.createBooking.bind(mockAPI);
    window.api.checkTimeSlots = mockAPI.checkTimeSlots.bind(mockAPI);
    window.api.getUsers = mockAPI.getUsers.bind(mockAPI);
    window.api.createUser = mockAPI.createUser.bind(mockAPI);
    window.api.updateUser = mockAPI.updateUser.bind(mockAPI);
    window.api.deleteUser = mockAPI.deleteUser.bind(mockAPI);
    
    console.log('MOCK API: All methods overridden successfully');
    console.log('='.repeat(50));
} else {
    console.log('MOCK API ERROR: api object not found!');
}
