
import pg from 'pg';
import 'dotenv/config';
import { Log } from '../../logging-middleware/logger.js';

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', async () => {
    await Log('backend', 'info', 'db', 'New PostgreSQL client connected from pool');
});

pool.on('error', async (err) => {
    await Log('backend', 'fatal', 'db', `Unexpected PostgreSQL pool error: ${err.message}`);
});

export const query = (text, params) => pool.query(text, params);
export default pool;
