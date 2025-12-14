const UNIVERSITIES = [
  {
    id: 1,
    name: 'UM6P - Université Mohammed VI Polytechnique',
    domain: 'um6p.ma',
    city: 'Benguerir'
  },
  {
    id: 2,
    name: 'UCA - Université Cadi Ayyad',
    domain: 'uca.ma', 
    city: 'Marrakech'
  },
  {
    id: 3,
    name: 'UIR - Université Internationale de Rabat',
    domain: 'uir.ma',
    city: 'Rabat'
  }
  // Ajoutez d'autres universités au besoin
];

// Accept emails that end with the university domain or any subdomain
const isValidUniversityEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase();
  return UNIVERSITIES.some(univ => {
    const domain = univ.domain.toLowerCase();
    // matches @domain or @*.domain (subdomains allowed)
    return new RegExp(`@([^.@]+\.)*${domain}$`).test(lower);
  });
};

const getUniversityFromEmail = (email) => {
  if (!email || typeof email !== 'string') return null;
  const lower = email.toLowerCase();
  return UNIVERSITIES.find(univ => {
    const domain = univ.domain.toLowerCase();
    return new RegExp(`@([^.@]+\.)*${domain}$`).test(lower);
  }) || null;
};

module.exports = {
  UNIVERSITIES,
  isValidUniversityEmail,
  getUniversityFromEmail
};