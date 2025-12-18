const db = require('../config/db');

const preferenceController = {
    // Définir les trajets habituels (ou préférences)
    setFrequentRoute: (req, res) => {
        const userId = req.userId;
        const { key, value } = req.body; // key: 'home_school', value: 'Rabat-Benguerir' or JSON

        if (!key || !value) return res.status(400).json({ success: false, message: 'Clé et valeur requises' });

        const valStr = typeof value === 'object' ? JSON.stringify(value) : value;

        const sql = `INSERT INTO user_preferences (user_id, key, value) 
                 VALUES (?, ?, ?) 
                 ON CONFLICT(user_id, key) DO UPDATE SET value = ?`;

        db.run(sql, [userId, key, valStr, valStr], (err) => {
            if (err) {
                console.error('Erreur setFrequentRoute:', err);
                return res.status(500).json({ success: false, message: 'Erreur serveur' });
            }
            res.json({ success: true, message: 'Préférence enregistrée' });
        });
    },

    // Obtenir des suggestions basées sur les préférences
    getSuggestions: (req, res) => {
        const userId = req.userId;

        // 1. Récupérer les routes fréquentes (ex: home_university)
        const prefSql = `SELECT value FROM user_preferences WHERE user_id = ? AND key = 'frequent_route_home_uni'`;

        db.get(prefSql, [userId], (err, pref) => {
            if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });

            let criteria = null;
            if (pref && pref.value) {
                try {
                    // Supposons que value est JSON: { departure_city: 'Rabat', arrival_city: 'Benguerir' }
                    criteria = JSON.parse(pref.value);
                } catch (e) {
                    console.warn('Erreur parsage preference:', e);
                }
            }

            // Si pas de critères, retourner suggestions génériques (random ou newest)
            const limit = 5;
            let sql, params;

            if (criteria && criteria.departure_city && criteria.arrival_city) {
                // Suggestions basées sur la route habituelle
                sql = `SELECT r.*, u.first_name, u.rating, u.is_verified, 
                       ds.name as departure_station_name, as.name as arrival_station_name, ds.city as departure_city, as.city as arrival_city
                FROM rides r
                JOIN users u ON r.driver_id = u.id
                JOIN stations ds ON r.departure_station_id = ds.id
                JOIN stations as ON r.arrival_station_id = as.id
                WHERE r.status = 'active'
                AND r.available_seats > 0
                AND ds.city LIKE ?
                AND as.city LIKE ?
                AND r.departure_date >= date('now')
                ORDER BY r.departure_date ASC
                LIMIT ?`;
                params = [`%${criteria.departure_city}%`, `%${criteria.arrival_city}%`, limit];
            } else {
                // Fallback: trajets récents actifs
                sql = `SELECT r.*, u.first_name, u.rating, u.is_verified,
                       ds.name as departure_station_name, as.name as arrival_station_name, ds.city as departure_city, as.city as arrival_city
                FROM rides r
                JOIN users u ON r.driver_id = u.id
                JOIN stations ds ON r.departure_station_id = ds.id
                JOIN stations as ON r.arrival_station_id = as.id
                WHERE r.status = 'active'
                AND r.available_seats > 0
                AND r.departure_date >= date('now')
                ORDER BY r.created_at DESC
                LIMIT ?`;
                params = [limit];
            }

            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Erreur suggestions:', err);
                    return res.status(500).json({ success: false, message: 'Erreur serveur' });
                }
                res.json({ success: true, suggestions: rows || [], criteria: criteria || 'generic' });
            });
        });
    }
};

module.exports = preferenceController;
