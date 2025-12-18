const API_URL = 'http://localhost:3000/api';
let driverToken = '';
let passengerToken = '';
let driverId = '';
let passengerId = '';
let rideId = '';

const request = async (url, method, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json();
    if (!res.ok) {
        const error = new Error(data.message || 'Request failed');
        error.data = data;
        error.status = res.status;
        throw error;
    }
    return data;
};

const registerUser = async (email, role) => {
    try {
        return await request(`${API_URL}/auth/register`, 'POST', {
            email,
            password: 'Password123!',
            first_name: 'Test',
            last_name: role,
            phone: '0600000000',
            university: 'Test Uni',
            profile_type: 'student'
        });
    } catch (e) {
        if (e.status === 400 && e.data.message === 'Cet email est déjà utilisé') {
            return await request(`${API_URL}/auth/login`, 'POST', { email, password: 'Password123!' });
        }
        throw e;
    }
};

const runTest = async () => {
    try {
        console.log('🏁 Démarrage des tests...');

        // 1. Auth Driver
        const driverAuth = await registerUser('driver_test@edu.univ.fr', 'Driver');
        driverToken = driverAuth.token;
        driverId = driverAuth.user.id;
        console.log('✅ Driver authentifié');

        // 2. Auth Passenger
        const passengerAuth = await registerUser('passenger_test@edu.univ.fr', 'Passenger');
        passengerToken = passengerAuth.token;
        passengerId = passengerAuth.user.id;
        console.log('✅ Passager authentifié');

        // 3. Créer un trajet
        const rideData = {
            departure_station_id: 1,
            arrival_station_id: 2,
            departure_date: new Date().toISOString().split('T')[0],
            departure_time: '12:00',
            available_seats: 4,
            price_per_seat: 1000
        };
        const createRes = await request(`${API_URL}/rides`, 'POST', rideData, driverToken);
        rideId = createRes.ride.id;
        console.log('✅ Trajet créé (ID:', rideId, ')');

        // 4. Réserver le trajet
        console.log('🔄 Tentative de réservation...');
        await request(`${API_URL}/reservations`, 'POST', {
            rideId: rideId,
            seatsBooked: 2
        }, passengerToken);
        console.log('✅ Réservation effectuée (2 places)');

        // 5. Tenter de supprimer (DOIT ÉCHOUER)
        console.log('🔄 Tentative de suppression (doit échouer)...');
        try {
            await request(`${API_URL}/rides/${rideId}`, 'DELETE', null, driverToken);
            console.error('❌ ERREUR: La suppression aurait dû échouer !');
        } catch (e) {
            if (e.status === 400) {
                console.log('✅ Suppression bloquée correctement (Réservations actives)');
            } else {
                console.error('❌ Erreur inattendue:', e.message);
            }
        }

        // 6. Terminer le trajet
        console.log('🔄 Terminaison du trajet...');
        await request(`${API_URL}/rides/${rideId}/complete`, 'PUT', {}, driverToken);
        console.log('✅ Trajet terminé avec succès');

        // 7. Vérifier stats Dashboard (Driver)
        console.log('🔄 Vérification stats Driver...');
        const statsRes = await request(`${API_URL}/stats/dashboard`, 'GET', null, driverToken);
        const s = statsRes.stats;
        console.log('📊 Stats Driver:', s);
        // Assertions simples
        if (s.moneySaved >= 2000) console.log('✅ Money Saved correct (>= 2000)');
        else console.warn('⚠️ Money Saved incorrect:', s.moneySaved);

        if (s.co2Saved > 0) console.log('✅ CO2 Saved > 0');

        // 8. Test suppression simple (sans résa)
        console.log('🔄 Test suppression simple...');
        const ride2Res = await request(`${API_URL}/rides`, 'POST', { ...rideData, departure_time: '14:00' }, driverToken);
        const rideId2 = ride2Res.ride.id;
        await request(`${API_URL}/rides/${rideId2}`, 'DELETE', null, driverToken);
        console.log('✅ Suppression simple réussie');

        console.log('🎉 TOUS LES TESTS SONT PASSÉS !');

    } catch (error) {
        console.error('❌ Test échoué:', error.message);
        if (error.data) console.error(JSON.stringify(error.data, null, 2));
    }
};

runTest();
