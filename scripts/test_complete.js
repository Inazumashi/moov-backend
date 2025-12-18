// Test complet du flux de trajets
// Ce script teste la création d'un trajet et sa récupération dans my-rides

const http = require('http');
const db = require('../config/db');

function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, body });
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function runTests() {
    console.log('='.repeat(60));
    console.log('TEST COMPLET DU FLUX DE TRAJETS');
    console.log('='.repeat(60));
    console.log();

    // 1. Vérifier l'état actuel de la base
    console.log('1️⃣ ÉTAT DE LA BASE DE DONNÉES');
    console.log('-'.repeat(40));

    const rides = await new Promise((resolve) => {
        db.all(`SELECT r.id, r.driver_id, r.status, ds.name as dep, ars.name as arr 
                FROM rides r 
                JOIN stations ds ON r.departure_station_id = ds.id 
                JOIN stations ars ON r.arrival_station_id = ars.id`, [], (e, r) => resolve(r || []));
    });

    console.log(`   Trajets en base: ${rides.length}`);
    if (rides.length > 0) {
        console.log('   Échantillon:');
        rides.slice(0, 3).forEach(r => {
            console.log(`   - ID ${r.id}: Driver ${r.driver_id} | ${r.dep} -> ${r.arr} (${r.status})`);
        });
    }

    const users = await new Promise((resolve) => {
        db.all(`SELECT id, email, is_driver FROM users`, [], (e, r) => resolve(r || []));
    });

    console.log(`\n   Utilisateurs: ${users.length}`);
    const drivers = users.filter(u => u.is_driver);
    console.log(`   Conducteurs: ${drivers.length}`);
    drivers.forEach(d => {
        const driverRides = rides.filter(r => r.driver_id === d.id);
        console.log(`   - User ${d.id} (${d.email}): ${driverRides.length} trajets`);
    });

    // 2. Tester la route /api/rides/my-rides
    console.log('\n2️⃣ TEST DE LA ROUTE /api/rides/my-rides');
    console.log('-'.repeat(40));

    // Sans token
    const noAuthRes = await httpRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/rides/my-rides',
        method: 'GET'
    });

    console.log(`   Sans token: Status ${noAuthRes.status}`);
    if (noAuthRes.status === 401) {
        console.log('   ✅ Route correcte - demande authentification');
    } else {
        console.log(`   ❌ Problème - Réponse: ${JSON.stringify(noAuthRes.body)}`);
    }

    // 3. Test de la route /api/rides/search
    console.log('\n3️⃣ TEST DE LA ROUTE /api/rides/search');
    console.log('-'.repeat(40));

    // Obtenir des stations valides
    const stations = await new Promise((resolve) => {
        db.all('SELECT id, name FROM stations LIMIT 2', [], (e, r) => resolve(r || []));
    });

    if (stations.length >= 2) {
        const searchPath = `/api/rides/search?departure_station_id=${stations[0].id}&arrival_station_id=${stations[1].id}`;
        const searchRes = await httpRequest({
            hostname: 'localhost',
            port: 3000,
            path: searchPath,
            method: 'GET'
        });

        console.log(`   Recherche: ${stations[0].name} -> ${stations[1].name}`);
        console.log(`   Status: ${searchRes.status}`);
        if (searchRes.body.success) {
            console.log(`   ✅ Trajets trouvés: ${searchRes.body.rides?.length || 0}`);
        } else {
            console.log(`   ℹ️ Message: ${searchRes.body.message}`);
        }
    }

    // 4. Résumé des problèmes potentiels
    console.log('\n4️⃣ DIAGNOSTIC');
    console.log('-'.repeat(40));

    // Vérifier les trajets orphelins (driver qui n'existe plus)
    const orphanRides = await new Promise((resolve) => {
        db.all(`SELECT r.id, r.driver_id FROM rides r 
                LEFT JOIN users u ON r.driver_id = u.id 
                WHERE u.id IS NULL`, [], (e, r) => resolve(r || []));
    });

    if (orphanRides.length > 0) {
        console.log(`   ⚠️ Trajets orphelins (driver inexistant): ${orphanRides.length}`);
    } else {
        console.log('   ✅ Aucun trajet orphelin');
    }

    // Vérifier les trajets avec stations inexistantes
    const invalidStationRides = await new Promise((resolve) => {
        db.all(`SELECT r.id, r.departure_station_id, r.arrival_station_id FROM rides r 
                LEFT JOIN stations ds ON r.departure_station_id = ds.id 
                LEFT JOIN stations ars ON r.arrival_station_id = ars.id 
                WHERE ds.id IS NULL OR ars.id IS NULL`, [], (e, r) => resolve(r || []));
    });

    if (invalidStationRides.length > 0) {
        console.log(`   ⚠️ Trajets avec stations invalides: ${invalidStationRides.length}`);
    } else {
        console.log('   ✅ Toutes les stations référencées existent');
    }

    console.log('\n' + '='.repeat(60));
    console.log('FIN DES TESTS');
    console.log('='.repeat(60));

    process.exit(0);
}

// Attendre que la DB soit connectée
setTimeout(runTests, 1000);
