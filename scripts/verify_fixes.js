const db = require('../config/db');

const BASE_URL = 'http://localhost:3000/api';
let AUTH_TOKEN = '';
let USER_ID = '';

async function login() {
    console.log('🔑 Authenticating...');
    try {
        const email = 'test@um6p.ma';
        const password = 'testpassword';

        // Check if we can login
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(JSON.stringify(data));
        }

        AUTH_TOKEN = data.token;
        USER_ID = data.user.id;
        console.log('✅ Logged in as existing user:', USER_ID);
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        return false;
    }
}

async function verifyUnreadByConversation() {
    console.log('\n🧪 Testing GET /chat/unread-by-conversation (Fix for 500 error)...');
    try {
        const response = await fetch(`${BASE_URL}/chat/unread-by-conversation`, {
            headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
        });
        const data = await response.json();

        console.log('✅ Status:', response.status);
        console.log('✅ Data:', data);

        if (response.status === 200 && data.success) {
            console.log('✅ SUCCESS: 500 Error seems fixed.');
        } else {
            console.log('❌ UNEXPECTED RESPONSE');
        }
    } catch (error) {
        console.error('❌ FAILED:', error.message);
    }
}

async function verifyNewMessagesRoute() {
    console.log('\n🧪 Testing GET /chat/conversations/:id/new-messages (Fix for 404 error)...');
    try {
        const response = await fetch(`${BASE_URL}/chat/conversations/99999/new-messages?since=2024-01-01`, {
            headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
        });
        const data = await response.json();

        console.log('✅ Status:', response.status);
        console.log('✅ Body:', data);

        // We expect 403 Access Denied or 200 Success, BUT NOT "Route non trouvée"
        if (data.message === 'Route non trouvée') {
            console.log('❌ FAILURE: Route still not found.');
        } else {
            console.log('✅ SUCCESS: Route exists (returned logic error or success).');
        }
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

async function verifyReservationsForRide() {
    console.log('\n🧪 Testing GET /reservations/for-ride/:rideId (Fix for 404 error)...');
    try {
        const response = await fetch(`${BASE_URL}/reservations/for-ride/99999`, {
            headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
        });
        const data = await response.json();

        console.log('✅ Status:', response.status);
        console.log('✅ Body:', data);

        if (data.message === 'Route non trouvée') {
            console.log('❌ FAILURE: Route still not found.');
        } else {
            console.log('✅ SUCCESS: Route exists (returned logic error or success).');
        }
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

async function run() {
    if (await login()) {
        await verifyUnreadByConversation();
        await verifyNewMessagesRoute();
        await verifyReservationsForRide();
    }
}

run();
