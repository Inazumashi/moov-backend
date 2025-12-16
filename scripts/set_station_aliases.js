const db = require('../config/db');

const aliases = [
  { name: 'EMI', alias: 'emi' },
  { name: 'ENSIAS', alias: 'ensias' }
];

db.serialize(() => {
  // Check if aliases column exists, add it if missing, then set aliases
  db.all(`PRAGMA table_info(stations)`, (err, cols) => {
    if (err) return console.error('PRAGMA error', err.message);
    const names = (cols || []).map(c => c.name);

    const doUpdates = () => {
      aliases.forEach(a => {
        db.run(`UPDATE stations SET aliases = ? WHERE LOWER(name) = LOWER(?)`, [a.alias, a.name], function(err) {
          if (err) console.error('Error setting alias for', a.name, err.message);
          else if (this.changes > 0) console.log(`Set alias '${a.alias}' on ${a.name}`);
        });
      });

      // Also set aliases for rows where name contains the university token
      aliases.forEach(a => {
        db.run(`UPDATE stations SET aliases = ? WHERE university_id IS NOT NULL AND (aliases IS NULL OR aliases = '') AND LOWER(name) LIKE ?`, [a.alias, `%${a.name.toLowerCase()}%`], function(err) {
          // ignore errors
        });
      });

      setTimeout(() => {
        console.log('Done updating aliases');
        db.all('SELECT id, name, aliases FROM stations', (err, rows) => {
          if (!err) console.log(rows.map(r => ({ id: r.id, name: r.name, aliases: r.aliases })));
          process.exit(0);
        });
      }, 500);
    };

    if (!names.includes('aliases')) {
      db.run(`ALTER TABLE stations ADD COLUMN aliases TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Could not add aliases column:', alterErr.message);
          return doUpdates();
        }
        console.log('Added aliases column to stations');
        doUpdates();
      });
    } else {
      doUpdates();
    }
  });
});
