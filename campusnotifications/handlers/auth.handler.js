import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { Log } from '../../logging-middleware/logger.js';

const SALT_ROUNDS = 10;
const JWT_EXPIRY = '8h';

// ── POST /api/auth/register ───────────────────────────────────────────────────
export const registerHandler = async (req, res) => {
    try {
        const { name, email, password, rollNumber, department } = req.body;
        if (!name || !email || !password || !rollNumber) {
            return res.status(400).json({ success: false, error: 'name, email, password, rollNumber required.' });
        }

        await Log('backend', 'info', 'handler',
            `Registration attempt for email=${email}, roll=${rollNumber}`);

        const existing = await query('SELECT student_id FROM students WHERE email=$1 OR roll_number=$2', [email, rollNumber]);
        if (existing.rows.length) {
            await Log('backend', 'warn', 'handler',
                `Registration failed — email/roll already exists: ${email}`);
            return res.status(409).json({ success: false, error: 'Email or roll number already registered.' });
        }

        const hashed = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await query(
            `INSERT INTO students (name, email, password, roll_number, department)
             VALUES ($1,$2,$3,$4,$5) RETURNING student_id, name, email, roll_number`,
            [name, email, hashed, rollNumber, department || null]
        );

        await Log('backend', 'info', 'handler',
            `New student registered: student_id=${result.rows[0].student_id}, roll=${rollNumber}`);

        return res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err) {
        await Log('backend', 'error', 'handler', `registerHandler: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Registration failed.' });
    }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export const loginHandler = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'email and password required.' });
        }

        await Log('backend', 'info', 'handler', `Login attempt: email=${email}`);

        const result = await query(
            `SELECT s.*
             FROM students s WHERE s.email = $1 AND s.active = TRUE`,
            [email]
        );
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            await Log('backend', 'warn', 'handler', `Login failed: invalid credentials for email=${email}`);
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { studentId: user.student_id, name: user.name, email: user.email, rollNumber: user.roll_number },
            process.env.JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        await Log('backend', 'info', 'handler',
            `Login successful: student_id=${user.student_id}, name=${user.name}`);

        return res.status(200).json({
            success: true,
            token,
            user: { studentId: user.student_id, name: user.name, email: user.email, rollNumber: user.roll_number },
        });
    } catch (err) {
        await Log('backend', 'error', 'handler', `loginHandler: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Login failed.' });
    }
};
