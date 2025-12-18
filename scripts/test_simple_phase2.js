// scripts/test_simple_phase2.js
const BASE_URL = 'http://localhost:3000/api';

async function test() {
    try {
        console.log('🏁 Starting Simple Phase 2 Test...');

        // 1. Register Driver
        const e = `d_${Date.now()}@t.com`;
        console.log(`👤 Registering ${e}...`);

        let r = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: e, password: 'Password123!', first_name: 'D', last_name: 'T', phone: '0600', profile_type: 'student', university: 'UM6P'
            })
        });
        let d = await r.json();
        if (!d.success) throw new Error('Register failed: ' + JSON.stringify(d));

        if (d.debug_code) {
            await fetch(`${BASE_URL}/auth/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: e, code: d.debug_code })
            });
        }

        // Login
        r = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: e, password: 'Password123!' })
        });
        d = await r.json();
        if (!d.success) throw new Error('Login failed');
        const token = d.token;
        console.log('🔑 Logged in');

        // 2. Create Ride
        r = await fetch(`${BASE_URL}/rides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                departure_station_id: 1, arrival_station_id: 2, departure_date: new Date().toISOString().split('T')[0], departure_time: '12:00', available_seats: 4, price_per_seat: 10
            })
        });
        d = await r.json();
        if (!d.success) throw new Error('Create ride failed: ' + JSON.stringify(d));
        const rideId = d.ride.id;
        console.log(`🚗 Ride Created: ${rideId}`);

        // 3. Test getRideReservations (New Endpoint)
        console.log('🧪 Testing GET /reservations/ride/:id ...');
        r = await fetch(`${BASE_URL}/reservations/ride/${rideId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`Status: ${r.status}`);
        d = await r.json();
        console.log('Response:', d);

        if (r.status === 200 && d.success) {
            console.log('✅ GET /reservations/ride/:id WORKS!');
        } else {
            console.error('❌ GET /reservations/ride/:id FAILED');
        }

    } catch (e) {
        console.error('🔥 Error:', e.message);
    }
}

test();
