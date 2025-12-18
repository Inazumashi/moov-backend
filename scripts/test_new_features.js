// scripts/test_new_features.js

// Configuration
const BASE_URL = 'http://localhost:3000/api';
let authToken = '';
let driverToken = '';
let rideId = '';
let bookingId = '';

// Helper pour les requêtes
const request = async (endpoint, method = 'GET', body = null, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await res.json();
        console.log(`[${method}] ${endpoint} : ${res.status}`, data.success ? '✅' : '❌', data.message || '');
        return { status: res.status, data };
    } catch (err) {
        console.error(`Error requesting ${endpoint}:`, err.message);
        return null;
    }
};

const runTests = async () => {
    console.log('🚀 Démarrage des tests des nouvelles fonctionnalités...');

    // 1. Inscription Passager
    const passengerEmail = `pass_${Date.now()}@um6p.ma`;
    console.log(`\n📋 1. Inscription Passager (${passengerEmail})`);
    const r1 = await request('/auth/register', 'POST', {
        email: passengerEmail,
        password: 'Password123!',
        first_name: 'Passenger',
        last_name: 'Test',
        university: 'UM6P',
        profile_type: 'student',
        phone: '0600000000'
    });
    if (r1.data.success) {
        // Login to get token (since register returns needs_verification)
        // Wait, simulated verification needed? Mock verification code?
        // For test, we can use the `debug_code` if returned, or we need to access DB.
        // But wait, `register` returns token (temporary) which might work for verification but not login?
        // Actually `login` checks `is_verified`.
        console.log('   -> Passager inscrit. Besoin vérification.');
        // Hack: Login anyway? No, backend blocks.
        // We need to verify.
        // Test script cannot easily read email.
        // BUT `register` in dev mode returns `debug_code`!
        if (r1.data.debug_code) {
            await request('/auth/verify-code', 'POST', { email: passengerEmail, code: r1.data.debug_code });
            const login = await request('/auth/login', 'POST', { email: passengerEmail, password: 'Password123!' });
            authToken = login.data.token;
        }
    }

    // 2. Inscription Conducteur
    const driverEmail = `driver_${Date.now()}@um6p.ma`;
    console.log(`\n📋 2. Inscription Conducteur (${driverEmail})`);
    const r2 = await request('/auth/register', 'POST', {
        email: driverEmail,
        password: 'Password123!',
        first_name: 'Driver',
        last_name: 'Test',
        university: 'UM6P',
        profile_type: 'student',
        phone: '0611111111'
    });
    if (r2.data.debug_code) {
        await request('/auth/verify-code', 'POST', { email: driverEmail, code: r2.data.debug_code });
        const login = await request('/auth/login', 'POST', { email: driverEmail, password: 'Password123!' });
        driverToken = login.data.token;
    }

    // 3. Création Trajet (Conducteur)
    console.log('\n📋 3. Création Trajet');
    const ride = await request('/rides', 'POST', {
        departure_station_id: 1,
        arrival_station_id: 2,
        departure_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        departure_time: '10:00',
        available_seats: 4,
        price_per_seat: 50
    }, driverToken);
    if (ride.data.success) rideId = ride.data.ride.id;

    // 4. Réservation (Passager)
    console.log('\n📋 4. Réservation');
    const book = await request('/reservations', 'POST', {
        rideId: rideId,
        seatsBooked: 2
    }, authToken);
    if (book.data.success) bookingId = book.data.reservation.id;

    // 5. Voir demandes conducteur
    console.log('\n📋 5. Driver: Voir demandes');
    const reqs = await request('/reservations/driver-requests', 'GET', null, driverToken);
    console.log('   -> Requests count:', reqs.data.requests ? reqs.data.requests.length : 0);

    // 6. Confirmer réservation
    console.log(`\n📋 6. Driver: Confirmer réservation ${bookingId}`);
    await request(`/reservations/${bookingId}/confirm`, 'PUT', null, driverToken);

    // 7. Voir notifications (Passager)
    console.log('\n📋 7. Passager: Voir notifications');
    const notifs = await request('/notifications', 'GET', null, authToken);
    console.log('   -> Notifications:', notifs.data.notifications ? notifs.data.notifications.length : 0);
    if (notifs.data.notifications && notifs.data.notifications.length > 0) {
        console.log('   -> Last notif:', notifs.data.notifications[0].message);
    }

    // 8. Stats Dashboard (Non-Premium)
    console.log('\n📋 8. Passager: Stats Dashboard (Free)');
    await request('/stats/dashboard', 'GET', null, authToken); // Should fail 403

    // 9. Payment Premium
    console.log('\n📋 9. Passager: Devenir Premium');
    await request('/payment/premium', 'POST', {}, authToken);

    // 10. Stats Dashboard (Premium)
    console.log('\n📋 10. Passager: Stats Dashboard (Premium)');
    await request('/stats/dashboard', 'GET', null, authToken); // Should succeed

    // 11. Suggestions (Set Preference)
    console.log('\n📋 11. Suggestions: Set Prefs');
    await request('/rides/preferences', 'POST', {
        key: 'frequent_route_home_uni',
        value: JSON.stringify({ departure_city: 'Benguerir', arrival_city: 'Marrakech' })
    }, authToken);

    // 12. Suggestions (Get)
    console.log('\n📋 12. Suggestions: Get');
    await request('/rides/suggestions', 'GET', null, authToken);

    console.log('\n🏁 Tests terminés.');
};

runTests();
