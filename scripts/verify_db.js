// Vérification complète avec sortie dans un fichier
const db = require('../config/db');
const fs = require('fs');

let output = '';

function log(msg) {
    console.log(msg);
    output += msg + '\n';
}

db.all('SELECT id, email, is_driver FROM users', [], (e, users) => {
    log('=== UTILISATEURS ===');
    users.forEach(u => log(`ID: ${u.id}, Email: ${u.email}, Driver: ${u.is_driver}`));

    db.all(`SELECT r.id, r.driver_id, r.status, ds.name as dep, ars.name as arr 
            FROM rides r 
            JOIN stations ds ON r.departure_station_id = ds.id 
            JOIN stations ars ON r.arrival_station_id = ars.id`, [], (e, rides) => {
        log('\n=== TRAJETS ===');
        rides.forEach(r => log(`Ride ID: ${r.id}, Driver: ${r.driver_id}, Status: ${r.status}, ${r.dep} -> ${r.arr}`));

        log(`\nTotal trajets: ${rides.length}`);

        // Vérifier pour chaque driver
        const driverIds = [...new Set(rides.map(r => r.driver_id))];
        log(`\nDrivers uniques: ${driverIds.join(', ')}`);

        fs.writeFileSync('verification_output.txt', output);
        console.log('\n✅ Résultats sauvegardés dans verification_output.txt');
        process.exit(0);
    });
});
