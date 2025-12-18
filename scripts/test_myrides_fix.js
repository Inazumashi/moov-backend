// Test du fix my-rides
// Ce script teste si la route /api/rides/my-rides fonctionne correctement

const http = require('http');

// D'abord, on se connecte pour obtenir un token
function login(email, password) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ email, password });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function getMyRides(token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/rides/my-rides',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

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
        req.end();
    });
}

async function test() {
    console.log('=== TEST DU FIX MY-RIDES ===\n');

    // Essayer de se connecter
    console.log('1. Connexion avec un utilisateur existant...');
    try {
        const loginRes = await login('test@um6p.ma', 'Test123!');
        console.log('   Réponse login:', loginRes.success ? '✅ Succès' : '❌ Échec');

        if (loginRes.success && loginRes.token) {
            console.log('\n2. Test de la route /api/rides/my-rides...');
            const myRidesRes = await getMyRides(loginRes.token);
            console.log('   Status HTTP:', myRidesRes.status);
            console.log('   Succès:', myRidesRes.body.success ? '✅' : '❌');

            if (myRidesRes.body.success) {
                console.log('   Nombre de trajets:', myRidesRes.body.rides?.length || 0);
                if (myRidesRes.body.rides && myRidesRes.body.rides.length > 0) {
                    console.log('\n   📍 Trajets trouvés:');
                    myRidesRes.body.rides.forEach((r, i) => {
                        console.log(`   ${i + 1}. ${r.departure_station} -> ${r.arrival_station} (${r.departure_date})`);
                    });
                }
            } else {
                console.log('   Message d\'erreur:', myRidesRes.body.message);
            }
        } else {
            console.log('   Message:', loginRes.message);
        }
    } catch (err) {
        console.error('Erreur:', err.message);
    }

    console.log('\n=== FIN DU TEST ===');
}

test();
