// scripts/seedStations.js
const db = require('../config/db');

const seedStations = () => {
  console.log('🌱 Initialisation des stations...');

  const stations = [
    // UM6P - Benguerir
    ['UM6P - Entrée Principale', 'university', 'Benguerir', 'Lotissement 2070, Benguerir', 32.230, -7.933, 1],
    ['UM6P - Résidences Étudiantes', 'university', 'Benguerir', 'Résidences Green City, Benguerir', 32.232, -7.930, 1],
    ['UM6P - Centre de Recherche', 'university', 'Benguerir', 'Green & Smart Building Park', 32.228, -7.935, 1],
    ['Gare Benguerir', 'train_station', 'Benguerir', 'Gare ONCF Benguerir', 32.245, -7.950, 1],
    
    // UCA - Marrakech
    ['UCA - Faculté des Sciences Semlalia', 'university', 'Marrakech', 'Avenue Prince Moulay Abdellah', 31.641, -8.010, 2],
    ['UCA - Faculté de Médecine', 'university', 'Marrakech', 'Rue Avicenne, Guéliz', 31.635, -8.020, 2],
    ['UCA - École Nationale de Commerce', 'university', 'Marrakech', 'Route de Safi', 31.630, -8.015, 2],
    ['Gare Marrakech', 'train_station', 'Marrakech', 'Avenue Hassan II', 31.633, -8.008, 2],
    ['Aéroport Marrakech-Ménara', 'bus_station', 'Marrakech', 'Aéroport Marrakech-Ménara', 31.606, -8.036, 2],
    
    // UIR - Rabat
    ['UIR - Campus Technopolis', 'university', 'Rabat', 'Technopolis Rabat-Shore, Rocade Rabat-Salé', 33.992, -6.792, 3],
    ['UIR - Campus Parc', 'university', 'Rabat', 'Sala Al Jadida', 33.995, -6.790, 3],
    ['Gare Rabat-Agdal', 'train_station', 'Rabat', 'Avenue de la Gare, Agdal', 33.981, -6.872, 3],
    ['Gare Rabat-Ville', 'train_station', 'Rabat', 'Place de la Gare, Centre-Ville', 34.020, -6.833, 3],
    
    // ENSIAS - Rabat
    ['ENSIAS', 'university', 'Rabat', 'Avenue Mohamed Ben Abdellah Regragui, Madinat Al Irfane', 33.981, -6.872, 4],
    
    // EMI - Rabat
    ['EMI', 'university', 'Rabat', 'Avenue des Nations Unies, Agdal', 33.970, -6.860, 5],
    
    // Points d'intérêt communs
    ['Gare Casa-Voyageurs', 'train_station', 'Casablanca', 'Place de la Gare Casa-Voyageurs', 33.590, -7.583, null],
    ['Aéroport Mohammed V', 'bus_station', 'Casablanca', 'Aéroport Mohammed V, Nouasseur', 33.367, -7.590, null],
    ['CTM Casa-Voyageurs', 'bus_station', 'Casablanca', 'Bd Bahnini, près de la gare', 33.588, -7.585, null],
    ['Gare Fès', 'train_station', 'Fès', 'Avenue des FAR', 34.033, -5.000, null],
    ['Gare Tanger', 'train_station', 'Tanger', 'Place de la Gare', 35.767, -5.800, null]
  ];

  stations.forEach(([name, type, city, address, lat, lng, university_id]) => {
    db.run(`INSERT OR IGNORE INTO stations 
            (name, type, city, address, latitude, longitude, university_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [name, type, city, address, lat, lng, university_id], 
      (err) => {
        if (err) console.error('Erreur insertion station:', err);
      }
    );
  });

  console.log('✅ Stations initialisées !');
};

module.exports = seedStations;