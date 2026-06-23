import jwt from 'jsonwebtoken';
import { Log } from '../../logging-middleware/logger.js';

export const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header.' });
        }

        const token = authHeader.slice(7).trim();
        if (!token) {
            return res.status(401).json({ success: false, error: 'Bearer token not provided.' });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            await Log('backend', 'fatal', 'auth', 'JWT_SECRET is not configured.');
            return res.status(500).json({ success: false, error: 'Authentication is not configured.' });
        }

        const payload = jwt.verify(token, secret);
        req.user = {
            studentId: payload.studentId,
            name: payload.name,
            email: payload.email,
            rollNumber: payload.rollNumber,
        };

        return next();
    } catch (err) {
        await Log('backend', 'warn', 'auth', `Auth failure: ${err.message}`);
        return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
};
