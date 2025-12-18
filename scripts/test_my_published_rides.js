/**
 * Test script for "Mes Trajets Publiés" feature
 * Tests: myRides endpoint, ride reservations, and confirm/reject
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3000/api';
const DRIVER_ID = 9; // User who has published rides

// Generate token for testing
const token = jwt.sign({ id: DRIVER_ID }, process.env.JWT_SECRET, { expiresIn: '1d' });

async function testMyRides() {
    console.log('\n🚗 =======================================');
    console.log('🚗 TEST: /api/rides/my-rides');
    console.log('🚗 =======================================\n');

    try {
        const response = await fetch(`${BASE_URL}/rides/my-rides`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        console.log('📊 Status:', response.status);
        console.log('✅ Success:', data.success);
        console.log('📦 Number of rides:', data.rides?.length || 0);

        if (data.rides && data.rides.length > 0) {
            console.log('\n📋 First ride details:');
            const ride = data.rides[0];
            console.log('   - ID:', ride.id);
            console.log('   - Departure:', ride.departure_station);
            console.log('   - Arrival:', ride.arrival_station);
            console.log('   - Date:', ride.departure_date);
            console.log('   - Status:', ride.status);
            console.log('   - Booked seats:', ride.booked_seats);
            console.log('   - Active bookings:', ride.active_bookings);
            console.log('   - ⭐ Pending requests:', ride.pending_requests);
            console.log('   - Can delete:', ride.can_delete);

            return ride; // Return for further tests
        } else {
            console.log('⚠️  No rides found for this driver');
            return null;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        return null;
    }
}

async function testGetRideReservations(rideId) {
    console.log('\n👥 =======================================');
    console.log(`👥 TEST: /api/reservations/ride/${rideId}`);
    console.log('👥 =======================================\n');

    try {
        const response = await fetch(`${BASE_URL}/reservations/ride/${rideId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        console.log('📊 Status:', response.status);
        console.log('✅ Success:', data.success);
        console.log('📦 Number of reservations:', data.bookings?.length || 0);

        if (data.bookings && data.bookings.length > 0) {
            console.log('\n📋 Reservations:');
            data.bookings.forEach((booking, i) => {
                console.log(`\n   Reservation #${i + 1}:`);
                console.log('   - ID:', booking.id);
                console.log('   - Passenger:', `${booking.first_name} ${booking.last_name}`);
                console.log('   - Seats:', booking.seats_booked);
                console.log('   - Status:', booking.status);
                console.log('   - Phone:', booking.phone);
            });

            // Find a pending booking for confirm test
            const pendingBooking = data.bookings.find(b => b.status === 'pending');
            return pendingBooking || null;
        } else {
            console.log('⚠️  No reservations for this ride');
            return null;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        return null;
    }
}

async function testConfirmReservation(bookingId) {
    console.log('\n✅ =======================================');
    console.log(`✅ TEST: PUT /api/reservations/${bookingId}/confirm`);
    console.log('✅ =======================================\n');

    try {
        const response = await fetch(`${BASE_URL}/reservations/${bookingId}/confirm`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        console.log('📊 Status:', response.status);
        console.log('✅ Success:', data.success);
        console.log('💬 Message:', data.message);

        return data.success;
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('      MES TRAJETS PUBLIÉS - TEST SUITE');
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n');
    console.log(`Using driver ID: ${DRIVER_ID}`);
    console.log(`Token generated: ${token.substring(0, 30)}...`);

    // Test 1: Get my rides
    const ride = await testMyRides();

    if (ride) {
        // Test 2: Get reservations for first ride
        const pendingBooking = await testGetRideReservations(ride.id);

        // Test 3: Confirm a pending reservation (if exists)
        if (pendingBooking) {
            console.log(`\n📌 Found pending booking ID: ${pendingBooking.id}`);
            // Uncomment to actually confirm:
            // await testConfirmReservation(pendingBooking.id);
            console.log('⏭️  Skipping confirm test (uncomment to run)');
        }
    }

    console.log('\n✨ =======================================');
    console.log('✨ ALL TESTS COMPLETED');
    console.log('✨ =======================================\n');

    console.log('📚 Summary of available endpoints:');
    console.log('   GET  /api/rides/my-rides          → List driver\'s published rides');
    console.log('   GET  /api/reservations/ride/:id   → Get reservations for a ride');
    console.log('   PUT  /api/reservations/:id/confirm → Confirm a reservation');
    console.log('   PUT  /api/reservations/:id/reject  → Reject a reservation');
}

runAllTests();
