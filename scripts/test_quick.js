// Quick test script
require('dotenv').config();
const path = require('path');
const BASE_URL = 'http://localhost:3000/api';

async function test() {
    try {
        const db = require(path.join(__dirname, '../config/db'));

        // Get a user with rides
        db.get('SELECT u.id, u.email FROM users u JOIN rides r ON r.driver_id = u.id LIMIT 1', [], async (err, user) => {
            if (err || !user) {
                console.log('No users with rides found');
                return;
            }

            console.log('Found user:', user);

            // Get a ride from this user
            db.get('SELECT id FROM rides WHERE driver_id = ? LIMIT 1', [user.id], async (err, ride) => {
                if (err || !ride) {
                    console.log('No rides found');
                    return;
                }

                console.log('Found ride:', ride.id);

                // Create token
                const jwt = require('jsonwebtoken');
                const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

                console.log('Testing with token for user', user.id);

                const response = await fetch(`${BASE_URL}/reservations/ride/${ride.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                console.log('Status:', response.status);
                const body = await response.json();
                console.log('Response:', JSON.stringify(body, null, 2));

                process.exit(0);
            });
        });

    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

test();
