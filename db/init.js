const db = require('../config/db');

db.serialize(() => {
  console.log("🛠️ Démarrage de l'initialisation de la base de données...");

  // 1. Table users (INTEGER au lieu de BOOLEAN)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    university TEXT NOT NULL,
    profile_type TEXT CHECK(profile_type IN ('student', 'staff', 'professor')) DEFAULT 'student',
    student_id TEXT,
    is_verified INTEGER DEFAULT 0,
    is_driver INTEGER DEFAULT 0,
    has_car INTEGER DEFAULT 0,
    car_model TEXT,
    car_seats INTEGER,
    rating REAL DEFAULT 5.0,
    total_trips INTEGER DEFAULT 0,
    premium_status TEXT DEFAULT 'free',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ Erreur users:', err.message);
    else console.log('✅ Table "users" prête');
  });

  // 2. Table verification_codes
  db.run(`CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('❌ Erreur verification_codes:', err.message);
    else console.log('✅ Table "verification_codes" prête');
  });

  // 3. Table universities
  db.run(`CREATE TABLE IF NOT EXISTS universities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    city TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  )`, (err) => {
    if (err) console.error('❌ Erreur universities:', err.message);
    else {
      console.log('✅ Table "universities" prête');
      const universities = [
        ['UM6P - Université Mohammed VI Polytechnique', 'um6p.ma', 'Benguerir'],
        ['UCA - Université Cadi Ayyad', 'uca.ma', 'Marrakech'],
        ['UIR - Université Internationale de Rabat', 'uir.ac.ma', 'Rabat'],
        ['ENSIAS', 'ensias.ma', 'Rabat'],
        ['EMI', 'emi.ac.ma', 'Rabat']
      ];
      universities.forEach(([name, domain, city]) => {
        db.run(`INSERT OR IGNORE INTO universities (name, domain, city) VALUES (?, ?, ?)`, [name, domain, city]);
      });
    }
  });

  // 4. Table stations
  db.run(`CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('university', 'train_station', 'bus_station', 'landmark', 'city')) DEFAULT 'landmark',
    city TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    university_id INTEGER,
    is_active INTEGER DEFAULT 1,
    search_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE SET NULL
  )`, (err) => {
    if (err) console.error('❌ Erreur stations:', err.message);
    else {
      console.log('✅ Table "stations" prête');
      db.run(`CREATE INDEX IF NOT EXISTS idx_stations_name ON stations(name)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_stations_city ON stations(city)`);
    }
  });

  // 5. Table rides
  db.run(`CREATE TABLE IF NOT EXISTS rides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_id INTEGER NOT NULL,
    departure_station_id INTEGER NOT NULL,
    arrival_station_id INTEGER NOT NULL,
    departure_date DATETIME NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_date DATETIME,
    arrival_time TEXT,
    available_seats INTEGER NOT NULL DEFAULT 4,
    price_per_seat REAL NOT NULL DEFAULT 20.0,
    status TEXT CHECK(status IN ('pending', 'active', 'completed', 'cancelled')) DEFAULT 'pending',
    recurrence TEXT CHECK(recurrence IN ('none', 'daily', 'weekly', 'monthly', 'custom')) DEFAULT 'none',
    recurrence_days TEXT,
    recurrence_end_date DATETIME,
    notes TEXT,
    vehicle_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (departure_station_id) REFERENCES stations(id) ON DELETE RESTRICT,
    FOREIGN KEY (arrival_station_id) REFERENCES stations(id) ON DELETE RESTRICT
  )`, (err) => {
    if (err) console.error('❌ Erreur rides:', err.message);
    else console.log('✅ Table "rides" prête');
  });

  // 6. Table generated_rides
  db.run(`CREATE TABLE IF NOT EXISTS generated_rides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_ride_id INTEGER NOT NULL,
    departure_date DATETIME NOT NULL,
    status TEXT CHECK(status IN ('pending', 'active', 'completed', 'cancelled')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_ride_id) REFERENCES rides(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('❌ Erreur generated_rides:', err.message);
    else console.log('✅ Table "generated_rides" prête');
  });

  // 7. Table favorite_stations
  db.run(`CREATE TABLE IF NOT EXISTS favorite_stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    station_id INTEGER NOT NULL,
    type TEXT CHECK(type IN ('departure', 'arrival', 'both')) DEFAULT 'both',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, station_id, type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('❌ Erreur favorite_stations:', err.message);
    else console.log('✅ Table "favorite_stations" prête');
  });

  // 8. Table popular_routes
  db.run(`CREATE TABLE IF NOT EXISTS popular_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    departure_station_id INTEGER NOT NULL,
    arrival_station_id INTEGER NOT NULL,
    search_count INTEGER DEFAULT 0,
    ride_count INTEGER DEFAULT 0,
    average_price REAL,
    last_searched DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(departure_station_id, arrival_station_id),
    FOREIGN KEY (departure_station_id) REFERENCES stations(id) ON DELETE CASCADE,
    FOREIGN KEY (arrival_station_id) REFERENCES stations(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('❌ Erreur popular_routes:', err.message);
    else console.log('✅ Table "popular_routes" prête');
  });

  // 9. Table bookings
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    passenger_id INTEGER NOT NULL,
    seats_booked INTEGER NOT NULL DEFAULT 1,
    status TEXT CHECK(status IN ('pending', 'confirmed', 'cancelled', 'completed')) DEFAULT 'pending',
    total_price REAL NOT NULL,
    booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    cancellation_date DATETIME,
    cancellation_reason TEXT,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    FOREIGN KEY (passenger_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(ride_id, passenger_id)
  )`, (err) => {
    if (err) console.error('❌ Erreur bookings:', err.message);
    else {
      console.log('✅ Table "bookings" prête');
      db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON bookings(passenger_id, status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_ride ON bookings(ride_id, status)`);
    }
  });

  // 10. Table reviews
  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    reviewed_id INTEGER NOT NULL,
    role_reviewed TEXT CHECK(role_reviewed IN ('driver', 'passenger')) NOT NULL,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(ride_id, reviewer_id, reviewed_id)
  )`, (err) => {
    if (err) console.error('❌ Erreur reviews:', err.message);
    else console.log('✅ Table "reviews" prête');
  });

  // 11. Table user_badges
  db.run(`CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_type TEXT CHECK(badge_type IN (
      'new_user', 'first_ride', 'frequent_traveler', 
      'top_driver', 'perfect_rating', 'community_leader',
      'premium_member', 'safety_first', 'eco_friendly'
    )) NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, badge_type)
  )`, (err) => {
    if (err) console.error('❌ Erreur user_badges:', err.message);
    else console.log('✅ Table "user_badges" prête');
  });

  // 12. Table favorite_rides
  db.run(`CREATE TABLE IF NOT EXISTS favorite_rides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ride_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, ride_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('❌ Erreur favorite_rides:', err.message);
    else console.log('✅ Table "favorite_rides" prête');
  });

  // 13. Table notifications
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK(type IN ('info', 'warning', 'success', 'booking', 'ride_update', 'system')) DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    related_entity_type TEXT,
    related_entity_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('❌ Erreur notifications:', err.message);
    else {
      console.log('✅ Table "notifications" prête');
      console.log("🏁 Initialisation terminée, démarrage des insertions de données de base...");
      
      // ✅ INSERTION DES STATIONS (Sans transaction imbriquée)
      const stations = [
        // UM6P - Benguerir (university_id = 1)
        ['UM6P - Entrée Principale', 'university', 'Benguerir', 'Lotissement 2070', 32.230, -7.933, 1],
        ['UM6P - Résidences', 'university', 'Benguerir', 'Résidences Green City', 32.232, -7.930, 1],
        ['Gare Benguerir', 'train_station', 'Benguerir', 'Gare ONCF', 32.245, -7.950, null],
        
        // UCA - Marrakech (university_id = 2)
        ['UCA - Faculté des Sciences Semlalia', 'university', 'Marrakech', 'Avenue Prince Moulay Abdellah', 31.641, -8.010, 2],
        ['Gare Marrakech', 'train_station', 'Marrakech', 'Avenue Hassan II', 31.633, -8.008, null],
        
        // UIR - Rabat (university_id = 3)
        ['UIR - Campus Technopolis', 'university', 'Rabat', 'Technopolis Rabat-Shore', 33.992, -6.792, 3],
        
        // ENSIAS - Rabat (university_id = 4)
        ['ENSIAS', 'university', 'Rabat', 'Avenue Mohamed Ben Abdellah Regragui', 33.981, -6.872, 4],
        
        // EMI - Rabat (university_id = 5)
        ['EMI', 'university', 'Rabat', 'Avenue des Nations Unies', 33.970, -6.860, 5],
        
        // Stations générales
        ['Gare Casa-Voyageurs', 'train_station', 'Casablanca', 'Place de la Gare', 33.590, -7.583, null],
        ['Aéroport Mohammed V', 'bus_station', 'Casablanca', 'Aéroport Mohammed V', 33.367, -7.590, null],
      ];
      
      const stationPlaceholders = stations.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const stationValues = stations.flat();

      db.run(`INSERT OR IGNORE INTO stations (name, type, city, address, latitude, longitude, university_id) 
              VALUES ${stationPlaceholders}`, 
        stationValues, 
        (err) => {
          if (err) {
            console.error('❌ Erreur insertion stations:', err.message);
          } else {
            console.log(`✅ ${stations.length} stations insérées !`);
          }

          // ✅ INSERTION DE L'UTILISATEUR DE TEST
          const hashedPassword = '92b45288289a0cc87920155b9cc815e98544e3391740924976451e6005d54a2a';
          
          db.run(`INSERT OR IGNORE INTO users 
            (email, password, first_name, last_name, university, profile_type, is_verified) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              'test@um6p.ma', 
              hashedPassword, 
              'Test', 
              'User', 
              'UM6P - Université Mohammed VI Polytechnique', 
              'student', 
              1
            ], 
            (err) => {
              if (err) {
                console.error('❌ Erreur insertion utilisateur test:', err.message);
              } else {
                console.log('✅ Utilisateur test inséré (test@um6p.ma / testpassword)');
              }
              console.log("✨ Base de données prête.");
            }
          );
        }
      );
    }
  });
});