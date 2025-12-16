const rideController = require('../controllers/ride.controller');
const db = require('../config/db');

// Find a recent ride to delete
db.get("SELECT id, driver_id, status FROM rides WHERE status != 'cancelled' ORDER BY created_at DESC LIMIT 1", [], (err, row) => {
  if (err) return console.error('DB error', err);
  if (!row) return console.error('No rides found');
  const rideId = row.id;
  const driverId = row.driver_id;
  console.log('Attempting to permanently delete ride', rideId, 'for driver', driverId);

  // Mock req/res
  const req = { params: { id: String(rideId) }, userId: driverId, query: { permanent: '1' }, body: {} };
  const res = {
    status: (code) => ({ json: (obj) => { console.log('RES', code, obj); } }),
    json: (obj) => { console.log('RES 200', obj); }
  };

  // Call cancel which now supports permanent deletion
  rideController.cancel(req, res);
});
