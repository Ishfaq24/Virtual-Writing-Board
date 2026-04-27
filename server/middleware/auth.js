const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';

    try {
        const payload = jwt.verify(token, secret);
        req.user = {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
        };
        return next();
    } catch (_error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

module.exports = {
    requireAuth,
};
