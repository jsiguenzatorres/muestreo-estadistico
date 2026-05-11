// Shared CORS helper — restrictive origin, valid credentials support
const ALLOWED_ORIGINS = [
    'https://muestreo.ianovatechsystems.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
];

const CORS_HEADERS = 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization';

export function setCors(req, res) {
    const origin = req.headers.origin || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS);
    res.setHeader('Vary', 'Origin');
}

export function handlePreflight(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
}
