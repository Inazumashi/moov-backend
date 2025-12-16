// Démarre le serveur dans le même processus si besoin
try { require('../server'); } catch (e) { /* ignore if already started */ }

(async () => {
  const base = process.env.BASE || 'http://localhost:3001';
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@um6p.ma', password: 'testpassword' })
  });
  const loginJson = await login.json().catch(() => null);
  console.log('LOGIN:', login.status, loginJson);
  if (!login.ok) return process.exit(1);
  const token = loginJson.token;

  // Get popular stations
  const stationsRes = await fetch(base + '/api/stations/popular');
  const stationsJson = await stationsRes.json();
  console.log('STATIONS:', stationsRes.status, stationsJson);
  const stations = stationsJson.stations || [];
  let usableStations = stations;
  if (usableStations.length < 2) {
    // Fallback: use Station.getPopular directly from the model
    try {
      const Station = require('../models/station.model');
      usableStations = await new Promise((resolve, reject) => {
        Station.getPopular(20, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
    } catch (e) {
      console.error('Erreur fallback stations:', e.message || e);
    }
  }

  if (usableStations.length < 2) {
    console.error('Pas assez de stations pour tester');
    return process.exit(1);
  }

  const dep = usableStations[0].id;
  const arr = usableStations[1].id;

  // Create a ride
  const now = new Date();
  const dateStr = now.toISOString().slice(0,10);
  const createRes = await fetch(base + '/api/rides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      departure_station_id: dep,
      arrival_station_id: arr,
      departure_date: dateStr,
      departure_time: '12:00',
      available_seats: 3,
      price_per_seat: 10
    })
  });
  const createJson = await createRes.json().catch(() => null);
  console.log('CREATE RIDE:', createRes.status, createJson);
  if (!createRes.ok) return process.exit(1);
  const rideId = createJson.ride && createJson.ride.id ? createJson.ride.id : (createJson.id || null);
  if (!rideId) {
    console.error('Impossible de récupérer l\'ID du trajet créé');
    return process.exit(1);
  }

  // Try permanent delete via /remove
  const delRes = await fetch(base + `/api/rides/${rideId}/remove`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const delJson = await delRes.json().catch(() => null);
  console.log('DELETE /remove:', delRes.status, delJson);

  if (!delRes.ok) {
    // Try query param fallback
    const delRes2 = await fetch(base + `/api/rides/${rideId}?permanent=1`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const delJson2 = await delRes2.json().catch(() => null);
    console.log('DELETE ?permanent=1:', delRes2.status, delJson2);
  }

  console.log('Test terminé');
  process.exit(0);
})();
