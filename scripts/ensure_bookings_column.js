const db = require('../config/db');

console.log('Checking bookings table schema...');

db.serialize(() => {
  db.all("PRAGMA table_info(bookings)", (err, cols) => {
    if (err) {
      console.error('PRAGMA error:', err.message || err);
      process.exit(1);
    }

    const names = (cols || []).map(c => c.name);
    console.log('Columns before:', names);

    if (names.includes('passenger_id')) {
      console.log('passenger_id already present.');
      process.exit(0);
    }

    console.log('passenger_id missing — adding column...');
    db.run('ALTER TABLE bookings ADD COLUMN passenger_id INTEGER', (alterErr) => {
      if (alterErr) {
        console.error('ALTER TABLE failed:', alterErr.message || alterErr);
        process.exit(1);
      }

      console.log('Column passenger_id added. Creating index...');
      db.run('CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON bookings(passenger_id, status)', (idxErr) => {
        if (idxErr) console.error('Index creation error:', idxErr.message || idxErr);

        db.all("PRAGMA table_info(bookings)", (e, newCols) => {
          if (e) console.error('PRAGMA after error:', e.message || e);
          else console.log('Columns after:', (newCols || []).map(c => c.name));
          console.log('Migration complete.');
          process.exit(0);
        });
      });
    });
  });
});
