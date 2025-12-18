-- Créer un compte premium de test
INSERT INTO users (
  email, password, first_name, last_name, phone, 
  university, profile_type, is_verified, premium_status
) VALUES (
  'premium@um6p.ma',
  '$2a$10$X7.G.t.f.h.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z', -- Hash pour 'Premium123!' (Exemple, à remplacer par vrai hash généré)
  'Premium',
  'Tester',
  '+212600000000',
  'UM6P - Université Mohammed VI Polytechnique',
  'student',
  1,
  'premium'
);
