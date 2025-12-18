// Test HTTP direct pour my-rides
const http = require('http');

// Tester "my-rides" sans authentification - devrait retourner erreur auth, pas 404
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/rides/my-rides',
    method: 'GET'
};

console.log('Test 1: GET /api/rides/my-rides sans token');
const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);

        // Si on obtient 401 (non autorisé), ça veut dire que la route existe!
        // Si on obtient 500 avec "Trajet non trouvé", c'est le vieux bug
        if (res.statusCode === 401) {
            console.log('\n✅ SUCCÈS: La route /my-rides existe et demande une authentification');
        } else if (body.includes('Trajet non trouvé') || body.includes('my-rides')) {
            console.log('\n❌ ÉCHEC: La route est toujours interprétée comme /:id');
        }
    });
});

req.on('error', (e) => {
    console.error('Erreur:', e.message);
});

req.end();
