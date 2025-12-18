// scripts/check_rides.js
const db = require('../config/db');

const email = 'test@um6p.ma';

db.get('SELECT id, first_name FROM users WHERE email = ?', [email], (err, user) => {
    if (err) { console.error(err); return; }
    if (!user) { console.log('User not found'); return; }

    console.log(`Checking rides for user: ${user.id} (${user.first_name})`);

    db.all('SELECT * FROM rides WHERE driver_id = ?', [user.id], (err, rides) => {
        if (err) console.error(err);
        console.log(`Found ${rides.length} rides.`);
        rides.forEach(r => console.log(`- Ride ${r.id}: ${r.departure_date} ${r.status}`));
    });
});
