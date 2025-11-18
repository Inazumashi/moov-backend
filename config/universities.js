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

const isValidUniversityEmail = (email) => {
  return UNIVERSITIES.some(univ => email.endsWith(`@${univ.domain}`));
};

const getUniversityFromEmail = (email) => {
  return UNIVERSITIES.find(univ => email.endsWith(`@${univ.domain}`));
};

module.exports = {
  UNIVERSITIES,
  isValidUniversityEmail,
  getUniversityFromEmail
};