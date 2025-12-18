// Script pour examiner l'état actuel de la base de données
const db = require('../config/db');

console.log('=== EXAMEN DE LA BASE DE DONNÉES ===\n');

// Vérifier les trajets
db.all('SELECT * FROM rides', [], (err, rides) => {
    if (err) {
        console.error('Erreur rides:', err);
        return;
    }
    console.log(`📍 TRAJETS TOTAUX: ${rides.length}`);
    console.log(JSON.stringify(rides, null, 2));

    // Vérifier les utilisateurs conducteurs
    db.all('SELECT id, email, first_name, is_driver FROM users WHERE is_driver = 1', [], (err, drivers) => {
        if (err) {
            console.error('Erreur drivers:', err);
            return;
        }
        console.log(`\n🚗 CONDUCTEURS: ${drivers.length}`);
        console.log(JSON.stringify(drivers, null, 2));

        // Vérifier les stations
        db.all('SELECT * FROM stations LIMIT 5', [], (err, stations) => {
            if (err) {
                console.error('Erreur stations:', err);
                return;
            }
            console.log(`\n📍 STATIONS (5 premières): ${stations.length}`);
            console.log(JSON.stringify(stations, null, 2));

            console.log('\n=== FIN DE L\'EXAMEN ===');
            process.exit(0);
        });
    });
});
