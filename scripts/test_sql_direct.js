// Direct test of the SQL query used in getRideReservations (FIXED)
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./moov.db');

async function testQuery() {
    // Get a ride ID first
    db.get('SELECT id, driver_id FROM rides LIMIT 1', [], (err, ride) => {
        if (err || !ride) {
            console.log('No rides or error:', err);
            db.close();
            return;
        }

        console.log('Test ride:', ride);

        const rideId = ride.id;
        const userId = ride.driver_id;

        // FIXED SQL (removed profile_picture)
        const sql = `
            SELECT 
                b.id, b.status, b.seats_booked,
                u.first_name, u.last_name, u.phone
            FROM bookings b
            JOIN users u ON b.passenger_id = u.id
            JOIN rides r ON b.ride_id = r.id
            WHERE b.ride_id = ? AND r.driver_id = ?
        `;

        console.log('Testing SQL query...');
        console.log('rideId:', rideId, 'userId:', userId);

        db.all(sql, [rideId, userId], (queryErr, rows) => {
            if (queryErr) {
                console.error('Query ERROR MESSAGE:', queryErr.message);
                console.error('Query ERROR CODE:', queryErr.code);
            } else {
                console.log('SUCCESS! Bookings count:', rows.length);
                console.log('Bookings:', JSON.stringify(rows, null, 2));
            }

            db.close();
        });
    });
}

testQuery();
