// config/db.js

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./moov.db', (err) => {
  if (err) {
    console.error("❌ Erreur connexion SQLite :", err.message);
  } else {
    console.log("✅ Base SQLite connectée : moov.db");
  }
});

// Debug wrapper: log SQL statements in development to help trace "no such column" errors
if (process.env.NODE_ENV === 'development') {
  const wrap = (fnName) => {
    const orig = db[fnName].bind(db);
    db[fnName] = function(sql, params, cb) {
      try {
        if (typeof params === 'function') {
          db._lastSql = sql;
          db._lastParams = [];
          console.log('[SQL DEBUG]', fnName, sql);
          return orig(sql, params);
        }
        db._lastSql = sql;
        db._lastParams = Array.isArray(params) ? params : [];
        console.log('[SQL DEBUG]', fnName, sql, db._lastParams);
      } catch (e) {
        console.error('Erreur logging SQL:', e);
      }
      return orig(sql, params, cb);
    };
  };

  ['run', 'get', 'all', 'each'].forEach(wrap);
}

module.exports = db;
