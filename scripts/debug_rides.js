
const db = require('../config/db');

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function debug() {
    try {
        console.log("=== CHECKING FOR ANY RIDES ===");
        const rides = await runAsync("SELECT * FROM rides LIMIT 5");
        console.log(JSON.stringify(rides, null, 2));

        if (rides.length === 0) {
            console.log("NO RIDES IN DATABASE.");
            return;
        }

        const ride = rides[0];
        const driverId = ride.driver_id;
        console.log(`\nFound Ride ID ${ride.id} with Driver ID ${driverId}`);

        console.log("\n=== TESTING QUERY FOR THIS DRIVER ===");
        const controllerSql = `SELECT r.id, r.driver_id,
           ds.name as departure_station,
           ars.name as arrival_station
          FROM rides r
          JOIN stations ds ON r.departure_station_id = ds.id
          JOIN stations ars ON r.arrival_station_id = ars.id
          WHERE r.driver_id = ?`;

        const result = await runAsync(controllerSql, [driverId]);
        console.log(`Query returned ${result.length} rows.`);

        if (result.length === 0) {
            console.log("Query returned 0 rows! Checking stations...");
            const depStation = await runAsync("SELECT * FROM stations WHERE id = ?", [ride.departure_station_id]);
            const arrStation = await runAsync("SELECT * FROM stations WHERE id = ?", [ride.arrival_station_id]);

            console.log(`Departure Station ID: ${ride.departure_station_id} -> Found: ${depStation.length > 0}`);
            if (depStation.length > 0) console.log(JSON.stringify(depStation[0]));

            console.log(`Arrival Station ID: ${ride.arrival_station_id} -> Found: ${arrStation.length > 0}`);
            if (arrStation.length > 0) console.log(JSON.stringify(arrStation[0]));
        } else {
            console.log("Query works for this driver. The user might be logged in as someone else?");
            console.log(JSON.stringify(result, null, 2));
        }

    } catch (err) {
        console.error(err);
    }
}

setTimeout(debug, 1000);
