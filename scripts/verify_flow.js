const db = require('../config/db');
require('../db/init');
const Station = require('../models/station.model');
const Ride = require('../models/ride.model');

const to = (fn, ...args) => new Promise((resolve) => fn(...args, (err, res) => resolve({ err, res })));

(async () => {
  try {
    console.log('Starting verification flow (no server)');

    // 1) Autocomplete for EMI
    const { err: err1, res: stations } = await to(Station.search, 'EMI, Rabat', 5, 0);
    if (err1) return console.error('Autocomplete error:', err1);
    console.log('Autocomplete results:', stations.map(s => ({ id: s.id, name: s.name })));

    const dep = stations && stations[0] ? stations[0].id : null;
    if (!dep) return console.error('No departure station found');

    // 2) Pick an arrival station (popular first, different id)
    const { err: err2, res: popular } = await to(Station.getPopular, 10);
    if (err2) return console.error('Popular stations error:', err2);
    const arrObj = (popular || []).find(s => s.id !== dep) || popular[0];
    const arr = arrObj ? arrObj.id : null;
    console.log('Chosen departure id:', dep, 'arrival id:', arr);
    if (!arr) return console.error('No arrival station found');

    // 3) Find test user id
    const userRow = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', ['test@um6p.ma'], (e, r) => e ? reject(e) : resolve(r));
    });
    if (!userRow) return console.error('Test user not found');
    const driverId = userRow.id;
    console.log('Using driver id:', driverId);

    // 4) Create a ride
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const departure_date = `${yyyy}-${mm}-${dd}`;

    const rideData = {
      driver_id: driverId,
      departure_station_id: dep,
      arrival_station_id: arr,
      departure_date,
      departure_time: '12:00',
      arrival_date: null,
      arrival_time: null,
      available_seats: 3,
      price_per_seat: 5
    };

    const { err: err3, res: created } = await to(Ride.create, rideData);
    if (err3) return console.error('Create ride error:', err3);
    console.log('Ride created id:', created.id);

    // 5) Retrieve my rides for driver
    const myRides = await new Promise((resolve, reject) => {
      const sql = `SELECT r.id, r.departure_station_id, r.arrival_station_id, ds.name as departure_name, stat_arr.name as arrival_name
                   FROM rides r
                   JOIN stations ds ON r.departure_station_id = ds.id
                   JOIN stations stat_arr ON r.arrival_station_id = stat_arr.id
                   WHERE r.driver_id = ? ORDER BY r.created_at DESC LIMIT 5`;
      db.all(sql, [driverId], (e, rows) => e ? reject(e) : resolve(rows));
    });

    console.log('Recent rides for driver:', myRides.map(r => ({ id: r.id, dep_id: r.departure_station_id, dep_name: r.departure_name, arr_id: r.arrival_station_id, arr_name: r.arrival_name })));

    console.log('Verification flow completed.');
    process.exit(0);
  } catch (err) {
    console.error('Verification flow failed:', err);
    process.exit(2);
  }
})();
