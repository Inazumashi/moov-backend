// scripts/test_driver_actions.js
const BASE_URL = 'http://localhost:3000/api';

async function test() {
    try {
        console.log('🏁 Starting Driver Actions Verification...');

        // --- HELPER: Register & Login ---
        async function createAndLogin(prefix) {
            const email = `${prefix}_${Date.now()}@t.com`;
            const password = 'Password123!';

            // Register
            let r = await fetch(`${BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email, password, first_name: prefix, last_name: 'Test',
                    phone: '0600000000', profile_type: 'student', university: 'UM6P'
                })
            });
            let d = await r.json();
            if (!d.success) throw new Error(`Register ${prefix} failed: ` + JSON.stringify(d));

            // Verify
            if (d.debug_code) {
                await fetch(`${BASE_URL}/auth/verify-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code: d.debug_code })
                });
            }

            // Login
            r = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            d = await r.json();
            if (!d.success) throw new Error(`Login ${prefix} failed`);
            console.log(`🔑 Logged in as ${prefix} (ID: ${d.user.id})`);
            return { token: d.token, id: d.user.id };
        }

        // 1. Create Users
        const driver = await createAndLogin('driver');
        const passenger = await createAndLogin('passenger');

        // 2. Driver creates a Ride
        let r = await fetch(`${BASE_URL}/rides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driver.token}` },
            body: JSON.stringify({
                departure_station_id: 1, arrival_station_id: 2,
                departure_date: new Date().toISOString().split('T')[0],
                departure_time: '12:00', available_seats: 4, price_per_seat: 10
            })
        });
        let d = await r.json();
        if (!d.success) throw new Error('Create ride failed');
        const rideId = d.ride.id;
        console.log(`🚗 Ride Created: ${rideId}`);

        // 3. Passenger Books Ride
        r = await fetch(`${BASE_URL}/reservations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger.token}` },
            body: JSON.stringify({ rideId, seatsBooked: 1 })
        });
        d = await r.json();
        if (!d.success) throw new Error('Booking failed');
        const reservationId = d.reservation.id; // Corrected: access ID from reservation object if returned, or adapt based on actual response
        // Note: The controller returns `reservation: result`. Assuming `result` has `id` (sqlite run result usually has `lastID` but implementation details vary). 
        // Let's assume the controller returns the inserted object or ID. 
        // Checking controller code: `const result = await Reservation.create(...)`. 
        // Reservation.create usually returns `{ id: ..., ... }` or just the id. 
        // If it fails here, I'll debug.
        console.log(`🎟️ Reservation Created: ${d.reservation.id || 'Unknown ID'} (Status: ${d.reservation.status})`);
        const validReservationId = d.reservation.id;

        // 4. Driver checks Reservations (Verify passenger_id presence)
        r = await fetch(`${BASE_URL}/reservations/ride/${rideId}`, {
            headers: { 'Authorization': `Bearer ${driver.token}` }
        });
        d = await r.json();
        console.log('📋 Ride Reservations:', JSON.stringify(d.bookings, null, 2));

        const booking = d.bookings.find(b => b.id === validReservationId);
        if (!booking) throw new Error('Booking not found in list');

        if (booking.passenger_id === passenger.id) {
            console.log('✅ passenger_id is present and correct.');
        } else {
            console.error('❌ passenger_id is missing or incorrect!', booking);
            process.exit(1);
        }

        // 5. Driver Confirms Reservation
        console.log(`👍 Confirming reservation ${validReservationId}...`);
        r = await fetch(`${BASE_URL}/reservations/${validReservationId}/confirm`, {
            method: 'PUT', // Route defined as PUT
            headers: { 'Authorization': `Bearer ${driver.token}` }
        });
        d = await r.json();
        console.log('Confirmation response:', d);
        if (!d.success) throw new Error('Confirmation failed');

        // 6. Verify Status is Confirmed
        r = await fetch(`${BASE_URL}/reservations/ride/${rideId}`, {
            headers: { 'Authorization': `Bearer ${driver.token}` }
        });
        d = await r.json();
        const updatedBooking = d.bookings.find(b => b.id === validReservationId);
        if (updatedBooking.status === 'confirmed') {
            console.log('✅ Reservation status is now CONFIRMED.');
        } else {
            console.error(`❌ Reservation status is ${updatedBooking.status}, expected confirmed.`);
            process.exit(1);
        }

        console.log('🎉 ALL TESTS PASSED');

    } catch (e) {
        console.error('🔥 Error:', e.message);
        process.exit(1);
    }
}

test();
