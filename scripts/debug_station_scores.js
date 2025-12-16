const db = require('../config/db');
const Station = require('../models/station.model');

const query = 'EMI, Rabat';

db.serialize(() => {
  // Build SQL similar to Station.search
  let sql = `SELECT s.*, u.name as university_name
               FROM stations s
               LEFT JOIN universities u ON s.university_id = u.id
               WHERE s.is_active = 1
               AND (s.name LIKE ? OR s.city LIKE ? OR s.address LIKE ?)`;
  const params = [`%${query}%`, `%${query}%`, `%${query}%`];
  const keywords = query.toLowerCase().split(' ');
  keywords.forEach(keyword => {
    if (keyword.length > 2) {
      sql += ` OR LOWER(s.name) LIKE ? OR LOWER(s.city) LIKE ?`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
  });

  sql += ` ORDER BY 
    CASE 
      WHEN s.name LIKE ? THEN 1
      WHEN LOWER(s.name) LIKE LOWER(?) THEN 2
      WHEN s.city LIKE ? THEN 3
      WHEN s.address LIKE ? THEN 4
      ELSE 5
    END, s.search_count DESC, s.name ASC LIMIT 50`;
  params.push(`${query}%`, `${query}%`, `${query}%`, `${query}%`);

  db.all(sql, params, (err, stations) => {
    if (err) return console.error(err);
    console.log('Raw count:', stations.length);
    const scored = stations.map(s => ({ id: s.id, name: s.name, aliases: s.aliases, city: s.city, score: Station._scoreStation(s, query) }));
    scored.sort((a,b) => b.score - a.score);
    console.log('Top matches:');
    console.log(scored.slice(0,20));
    process.exit(0);
  });
});
