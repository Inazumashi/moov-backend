const db = require('../config/db');

db.serialize(() => {
  console.log('--- Stations ---');
  db.all('SELECT id, name, city, address FROM stations ORDER BY id', (err, stations) => {
    if (err) return console.error('Stations error:', err.message);
    stations.forEach(s => console.log(s));

    console.log('\n--- Last 20 Rides ---');
    db.all(`SELECT r.id, r.driver_id, r.departure_station_id, r.arrival_station_id, r.departure_date, ds.name as departure_name, stat_arr.name as arrival_name
            FROM rides r
            LEFT JOIN stations ds ON r.departure_station_id = ds.id
            LEFT JOIN stations stat_arr ON r.arrival_station_id = stat_arr.id
            ORDER BY r.id DESC LIMIT 20`, (err2, rides) => {
      if (err2) return console.error('Rides error:', err2.message);
      rides.forEach(r => console.log(r));
      process.exit(0);
    });
  });
});
