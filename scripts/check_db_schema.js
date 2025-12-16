const sqlite3 = require('sqlite3').verbose();
const dbPath = './moov.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Erreur ouverture DB:', err.message);
    process.exit(1);
  }
});

function showTableInfo(table) {
  db.all(`PRAGMA table_info(${table})`, (err, rows) => {
    if (err) {
      console.error(`Erreur PRAGMA table_info(${table}):`, err.message);
    } else if (!rows || rows.length === 0) {
      console.log(`Table '${table}' inexistante ou vide.`);
    } else {
      console.log(`Schéma de la table '${table}':`);
      rows.forEach(r => {
        console.log(`- ${r.cid}: ${r.name} (${r.type}) notnull=${r.notnull} dflt_value=${r.dflt_value} pk=${r.pk}`);
      });
    }
  });
}

console.log('Inspection de la base:', dbPath);
showTableInfo('bookings');
showTableInfo('users');
showTableInfo('stations');

setTimeout(() => db.close(), 500);
