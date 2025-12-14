// scripts/seedStations.js - VERSION CORRIGÉE
const db = require('../config/db');

const seedStations = () => {
  console.log('🌱 Initialisation des stations...');

  const stations = [
    // ==================== UM6P - Benguerir ====================
    ['UM6P - Campus Principal', 'university', 'Benguerir', 'Lotissement 2070, Benguerir', 32.230456, -7.933267, 1],
    ['UM6P - Résidences Étudiantes', 'university', 'Benguerir', 'Green City, Benguerir', 32.232189, -7.930456, 1],
    ['UM6P - Centre de Recherche', 'university', 'Benguerir', 'Green & Smart Building Park, Benguerir', 32.228745, -7.935678, 1],
    ['Gare ONCF Benguerir', 'train_station', 'Benguerir', 'Route de Marrakech, Benguerir', 32.245123, -7.950456, null],
    
    // ==================== UCA - Marrakech ====================
    ['UCA - Faculté des Sciences Semlalia', 'university', 'Marrakech', 'Avenue Prince Moulay Abdellah, Marrakech', 31.641789, -8.010123, 2],
    ['UCA - Faculté de Médecine et de Pharmacie', 'university', 'Marrakech', 'Rue Avicenne, Guéliz, Marrakech', 31.635456, -8.020789, 2],
    ['UCA - École Nationale de Commerce et de Gestion', 'university', 'Marrakech', 'Route de Safi, Marrakech', 31.630123, -8.015456, 2],
    ['Gare ONCF Marrakech', 'train_station', 'Marrakech', 'Avenue Hassan II, Marrakech', 31.633567, -8.008912, null],
    ['Aéroport Marrakech-Ménara', 'bus_station', 'Marrakech', 'Aéroport Marrakech-Ménara', 31.606789, -8.036123, null],
    
    // ==================== UIR - Rabat/Salé ====================
    ['UIR - Campus Technopolis', 'university', 'Salé', 'Technopolis Rabat-Shore, Rocade Rabat-Salé', 33.992345, -6.792678, 3],
    ['UIR - Campus Parc', 'university', 'Salé', 'Sala Al Jadida, Salé', 33.995678, -6.790123, 3],
    ['Gare ONCF Rabat-Agdal', 'train_station', 'Rabat', 'Avenue de la Gare, Agdal, Rabat', 33.981234, -6.872345, null],
    ['Gare ONCF Rabat-Ville', 'train_station', 'Rabat', 'Place de la Gare, Centre-Ville, Rabat', 34.020567, -6.833456, null],
    
    // ==================== ENSIAS - Rabat ====================
    ['ENSIAS', 'university', 'Rabat', 'Avenue Mohamed Ben Abdellah Regragui, Madinat Al Irfane, Rabat', 33.981567, -6.872123, 4],
    
    // ==================== EMI - Rabat ====================
    ['EMI - École Mohammadia d\'Ingénieurs', 'university', 'Rabat', 'Avenue Ibn Sina, Agdal, Rabat', 33.970123, -6.860456, 5],
    
    // ==================== POINTS DE DÉPART IMPORTANTS ====================
    // Casablanca
    ['Gare ONCF Casa-Voyageurs', 'train_station', 'Casablanca', 'Place de la Gare, Casablanca', 33.590123, -7.583456, null],
    ['Gare ONCF Casa-Port', 'train_station', 'Casablanca', 'Boulevard des Almohades, Casablanca', 33.600456, -7.590123, null],
    ['CTM Casablanca (Gare Routière)', 'bus_station', 'Casablanca', '23 Rue Léon l\'Africain, Casablanca', 33.588912, -7.585678, null],
    ['Aéroport Mohammed V', 'bus_station', 'Casablanca', 'Nouasseur, Casablanca', 33.367123, -7.590456, null],
    
    // Fès
    ['Gare ONCF Fès-Ville', 'train_station', 'Fès', 'Avenue des FAR, Fès', 34.033456, -5.000123, null],
    
    // Tanger
    ['Gare ONCF Tanger-Ville', 'train_station', 'Tanger', 'Place de la Gare, Tanger', 35.767123, -5.800456, null],
    ['Gare Tanger-Med', 'train_station', 'Tanger', 'Port Tanger-Med', 35.789456, -5.756123, null],
    
    // Autres villes universitaires
    ['Université Hassan II - Faculté des Sciences', 'university', 'Casablanca', 'Boulevard Cdt Driss El Harti, Casablanca', 33.572345, -7.623456, null],
    ['Université Mohammed V - Faculté des Sciences', 'university', 'Rabat', 'Avenue des Nations Unies, Rabat', 33.985678, -6.845123, null],
    
    // Points de rendez-vous populaires
    ['Médina de Marrakech (Jemaa el-Fna)', 'landmark', 'Marrakech', 'Place Jemaa el-Fna, Marrakech', 31.625789, -7.989123, null],
    ['Centre Commercial Morocco Mall', 'landmark', 'Casablanca', 'Boulevard de la Corniche, Casablanca', 33.567123, -7.678456, null],
    ['Tramway Rabat-Salé (Arrêt Agdal)', 'bus_station', 'Rabat', 'Station Agdal, Rabat', 33.978456, -6.867123, null]
  ];

  // D'abord vider la table si tu veux (optionnel)
  db.run('DELETE FROM stations', (err) => {
    if (err) console.error('Erreur suppression stations:', err);
    
    // Puis insérer les nouvelles
    let inserted = 0;
    stations.forEach(([name, type, city, address, lat, lng, university_id], index) => {
      db.run(`INSERT OR REPLACE INTO stations 
              (name, type, city, address, latitude, longitude, university_id) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [name, type, city, address, lat, lng, university_id], 
        (err) => {
          if (err) {
            console.error(`❌ Erreur insertion station ${name}:`, err.message);
          } else {
            inserted++;
            console.log(`✅ ${index + 1}. ${name} (${city})`);
          }
          
          // Quand toutes les insertions sont faites
          if (index === stations.length - 1) {
            setTimeout(() => {
              console.log(`\n🎉 ${inserted} stations initialisées avec succès !`);
            }, 1000);
          }
        }
      );
    });
  });
};

module.exports = seedStations;