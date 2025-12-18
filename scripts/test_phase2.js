// scripts/test_phase2.js

// Configuration
const BASE_URL = 'http://localhost:3000/api';
let driverToken = '';
let passengerToken = '';
let rideId = '';
let bookingId = '';
let notificationId = '';

const request = async (endpoint, method = 'GET', body = null, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, options);
        let data = {};
        try { data = await res.json(); } catch (e) { }
        console.log(`[${method}] ${endpoint} : ${res.status}`, data.success ? '✅' : '❌', data.message || '');
        return { status: res.status, data };
    } catch (err) {
        console.error(`Error requesting ${endpoint}:`, err.message);
        return null;
    }
};

const runTests = async () => {
    console.log('🚀 Démarrage tests Phase 2...');

    // Login Driver
    const dLogin = await request('/auth/login', 'POST', { email: 'driver@test.com', password: 'Password123!' }); // Assuming exists or will fail
    // We need valid users. Let's use the register flow quickly or reuse from prev test if DB persisted?
    // DB persists. Let's register new ones to be clean.

    // 1. Setup Utility Users
    const driverEmail = `d_${Date.now()}@test.com`;
    const passEmail = `p_${Date.now()}@test.com`;

    // Register Driver
    let r = await request('/auth/register', 'POST', {
        email: driverEmail, password: 'Password123!', first_name: 'Driver', last_name: 'Phase2', phone: '060000', profile_type: 'student', university: 'UM6P'
    });
    // Verify
    if (r.data.debug_code) await request('/auth/verify-code', 'POST', { email: driverEmail, code: r.data.debug_code });
    const dRes = await request('/auth/login', 'POST', { email: driverEmail, password: 'Password123!' });
    driverToken = dRes.data.token;

    // Register Passenger
    r = await request('/auth/register', 'POST', {
        email: passEmail, password: 'Password123!', first_name: 'Pass', last_name: 'Phase2', phone: '060000', profile_type: 'student', university: 'UM6P'
    });
    if (r.data.debug_code) await request('/auth/verify-code', 'POST', { email: passEmail, code: r.data.debug_code });
    const pRes = await request('/auth/login', 'POST', { email: passEmail, password: 'Password123!' });
    passengerToken = pRes.data.token;

    console.log('\n📋 1. Setup completed');

    // 2. Reservations (Driver Complete)
    // Create Ride
    const ride = await request('/rides', 'POST', {
        departure_station_id: 1, arrival_station_id: 2, departure_date: new Date().toISOString().split('T')[0], departure_time: '12:00', available_seats: 4, price_per_seat: 10
    }, driverToken);
    rideId = ride.data.ride.id;

    // Book
    const book = await request('/reservations', 'POST', { rideId: rideId, seatsBooked: 1 }, passengerToken);
    bookingId = book.data.reservation.id;

    // Confirm (Driver)
    await request(`/reservations/${bookingId}/confirm`, 'PUT', null, driverToken);

    // Complete (Driver) - NEW
    console.log('   Testing Complete Reservation...');
    await request(`/reservations/${bookingId}/complete`, 'PATCH', null, driverToken);

    // Get Ride Reservations (Driver) - NEW
    console.log('   Testing Get Ride Reservations...');
    const list = await request(`/reservations/ride/${rideId}`, 'GET', null, driverToken);
    if (list.data.bookings && list.data.bookings.length > 0) console.log('   -> Bookings found ✅');

    // 3. PayPal Professional
    console.log('\n📋 3. Testing PayPal Flows');
    // Create Order
    const order = await request('/payment/create-order', 'POST', { amount: "10.00", currency: "USD" }, passengerToken);
    if (order.data.approvalUrl) console.log('   -> Order Created ✅');

    // Capture (Mock)
    await request('/payment/capture-order', 'POST', { paymentId: 'PAY-MOCK', payerId: 'PAYER-MOCK' }, passengerToken);

    // 4. Notifications (Delete)
    console.log('\n📋 4. Testing Notification Delete');
    // Passenger should have notification from completion
    const notifs = await request('/notifications', 'GET', null, passengerToken);
    if (notifs.data.notifications.length > 0) {
        notificationId = notifs.data.notifications[0].id;
        await request(`/notifications/${notificationId}`, 'DELETE', null, passengerToken);
    }

    // 5. Change Password
    console.log('\n📋 5. Testing Change Password');
    await request('/auth/change-password', 'PUT', { currentPassword: 'Password123!', newPassword: 'NewPassword123!' }, driverToken);
    // Login with old (should fail)
    const failLogin = await request('/auth/login', 'POST', { email: driverEmail, password: 'Password123!' });
    if (failLogin.status === 401) console.log('   -> Old password rejected ✅');
    // Login with new
    const successLogin = await request('/auth/login', 'POST', { email: driverEmail, password: 'NewPassword123!' });
    if (successLogin.data.success) console.log('   -> New password accepted ✅');

    console.log('\n🏁 Phase 2 Tests Finished');
};

runTests();
