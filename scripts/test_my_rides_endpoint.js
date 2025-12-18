
require('dotenv').config();
const jwt = require('jsonwebtoken');

const driverId = 9; // User with rides

// Generate Token
const token = jwt.sign({ id: driverId }, process.env.JWT_SECRET, { expiresIn: '1d' });
console.log(`Using Token for Driver ${driverId}`);

fetch('http://localhost:3000/api/rides/my-rides', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
})
    .then(res => {
        console.log("Status Code:", res.status);
        return res.json();
    })
    .then(data => {
        console.log("Full Response:", JSON.stringify(data, null, 2));
    })
    .catch(err => {
        console.error("Fetch error:", err);
    });
