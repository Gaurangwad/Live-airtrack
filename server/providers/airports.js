// A compact set of major world airports used by the flight simulator and
// for resolving destinations/ETA on tracked flights.
export const AIRPORTS = [
  { iata: 'JFK', name: 'New York JFK', lat: 40.6413, lon: -73.7781, city: 'New York' },
  { iata: 'LAX', name: 'Los Angeles', lat: 33.9416, lon: -118.4085, city: 'Los Angeles' },
  { iata: 'ORD', name: 'Chicago O’Hare', lat: 41.9742, lon: -87.9073, city: 'Chicago' },
  { iata: 'ATL', name: 'Atlanta', lat: 33.6407, lon: -84.4277, city: 'Atlanta' },
  { iata: 'SFO', name: 'San Francisco', lat: 37.6213, lon: -122.379, city: 'San Francisco' },
  { iata: 'LHR', name: 'London Heathrow', lat: 51.47, lon: -0.4543, city: 'London' },
  { iata: 'CDG', name: 'Paris Charles de Gaulle', lat: 49.0097, lon: 2.5479, city: 'Paris' },
  { iata: 'FRA', name: 'Frankfurt', lat: 50.0379, lon: 8.5622, city: 'Frankfurt' },
  { iata: 'AMS', name: 'Amsterdam Schiphol', lat: 52.3105, lon: 4.7683, city: 'Amsterdam' },
  { iata: 'MAD', name: 'Madrid Barajas', lat: 40.4983, lon: -3.5676, city: 'Madrid' },
  { iata: 'IST', name: 'Istanbul', lat: 41.2753, lon: 28.7519, city: 'Istanbul' },
  { iata: 'DXB', name: 'Dubai', lat: 25.2532, lon: 55.3657, city: 'Dubai' },
  { iata: 'DOH', name: 'Doha', lat: 25.2731, lon: 51.6081, city: 'Doha' },
  { iata: 'DEL', name: 'Delhi', lat: 28.5562, lon: 77.1, city: 'Delhi' },
  { iata: 'BOM', name: 'Mumbai', lat: 19.0896, lon: 72.8656, city: 'Mumbai' },
  { iata: 'SIN', name: 'Singapore Changi', lat: 1.3644, lon: 103.9915, city: 'Singapore' },
  { iata: 'HKG', name: 'Hong Kong', lat: 22.308, lon: 113.9185, city: 'Hong Kong' },
  { iata: 'PEK', name: 'Beijing Capital', lat: 40.0799, lon: 116.6031, city: 'Beijing' },
  { iata: 'PVG', name: 'Shanghai Pudong', lat: 31.1443, lon: 121.8083, city: 'Shanghai' },
  { iata: 'HND', name: 'Tokyo Haneda', lat: 35.5494, lon: 139.7798, city: 'Tokyo' },
  { iata: 'NRT', name: 'Tokyo Narita', lat: 35.772, lon: 140.3929, city: 'Tokyo' },
  { iata: 'ICN', name: 'Seoul Incheon', lat: 37.4602, lon: 126.4407, city: 'Seoul' },
  { iata: 'SYD', name: 'Sydney', lat: -33.9399, lon: 151.1753, city: 'Sydney' },
  { iata: 'MEL', name: 'Melbourne', lat: -37.6733, lon: 144.8433, city: 'Melbourne' },
  { iata: 'GRU', name: 'São Paulo Guarulhos', lat: -23.4356, lon: -46.4731, city: 'São Paulo' },
  { iata: 'EZE', name: 'Buenos Aires', lat: -34.8222, lon: -58.5358, city: 'Buenos Aires' },
  { iata: 'JNB', name: 'Johannesburg', lat: -26.1392, lon: 28.246, city: 'Johannesburg' },
  { iata: 'CAI', name: 'Cairo', lat: 30.1219, lon: 31.4056, city: 'Cairo' },
  { iata: 'YYZ', name: 'Toronto Pearson', lat: 43.6777, lon: -79.6248, city: 'Toronto' },
  { iata: 'MEX', name: 'Mexico City', lat: 19.4361, lon: -99.0719, city: 'Mexico City' },
];

const byIata = new Map(AIRPORTS.map((a) => [a.iata, a]));
export const airportByIata = (iata) => byIata.get(iata);
