const Station = require('../models/station.model');

Station.search('EMI, Rabat', 10, 0, (err, stations) => {
  if (err) return console.error('search err', err);
  console.log('Station.search results:', stations.map(s => ({ id: s.id, name: s.name, aliases: s.aliases })));
  process.exit(0);
});
