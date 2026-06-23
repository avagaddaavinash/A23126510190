import { query } from '../config/db.js';
import { Log } from '../../logging-middleware/logger.js';

export const NotificationRepository = {

    async getByStudent(studentId, { limit = 50, offset = 0, type } = {}) {
        await Log('backend', 'debug', 'repository',
            `getByStudent: student_id=${studentId}, type=${type || 'all'}, limit=${limit}`);

        let sql = `
            SELECT id, notification_type, message, is_read, created_at, metadata
            FROM notifications
            WHERE student_id = $1
        `;
        const vals = [studentId];

        if (type) {
            vals.push(type);
            sql += ` AND notification_type = $${vals.length}`;
        }

        sql += ` ORDER BY created_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`;
        vals.push(limit, offset);

        const result = await query(sql, vals);
        return result.rows;
    },

    async getUnreadByStudent(studentId) {
        await Log('backend', 'debug', 'repository',
            `getUnreadByStudent: student_id=${studentId} — using partial index`);

        const sql = `
            SELECT id, notification_type, message, created_at, metadata
            FROM notifications
            WHERE student_id = $1
              AND is_read = FALSE
            ORDER BY created_at DESC;
        `;
        const result = await query(sql, [studentId]);
        return result.rows;
    },

    async markAsRead(notifId, studentId) {
        await Log('backend', 'info', 'repository',
            `Marking notification ${notifId} as read for student_id=${studentId}`);

        const sql = `
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = $1 AND student_id = $2
            RETURNING *;
        `;
        const result = await query(sql, [notifId, studentId]);
        return result.rows[0] || null;
    },

    async markAllAsRead(studentId) {
        await Log('backend', 'info', 'repository',
            `Marking ALL notifications as read for student_id=${studentId}`);

        const sql = `
            UPDATE notifications
            SET is_read = TRUE
            WHERE student_id = $1 AND is_read = FALSE
            RETURNING id;
        `;
        const result = await query(sql, [studentId]);
        return result.rowCount;
    },

    async createForAllStudents(type, message, metadata = {}) {
        await Log('backend', 'info', 'repository',
            `Bulk creating notification type="${type}" for all students`);

        const sql = `
            INSERT INTO notifications (student_id, notification_type, message, metadata)
            SELECT student_id, $1, $2, $3
            FROM students
            WHERE active = TRUE
            RETURNING id;
        `;
        const result = await query(sql, [type, message, JSON.stringify(metadata)]);
        await Log('backend', 'info', 'repository',
            `Bulk notification inserted for ${result.rowCount} students`);
        return result.rowCount;
    },

    async getRecentPlacementStudents() {
        await Log('backend', 'debug', 'repository',
            'Fetching students with placement notifications in last 7 days');

        const sql = `
            SELECT DISTINCT s.student_id, s.name, s.email, s.roll_number
            FROM notifications n
            JOIN students s ON s.student_id = n.student_id
            WHERE n.notification_type = 'Placement'
              AND n.created_at >= NOW() - INTERVAL '7 days';
        `;
        const result = await query(sql, []);
        return result.rows;
    },

    async getTopN(studentId, n = 10) {
        await Log('backend', 'debug', 'repository',
            `getTopN: fetching top ${n} priority notifications for student_id=${studentId}`);

        const sql = `
            SELECT
                id, notification_type, message, is_read, created_at, metadata,
                CASE notification_type
                    WHEN 'Placement' THEN 3
                    WHEN 'Result'    THEN 2
                    WHEN 'Event'     THEN 1
                    ELSE 0
                END AS type_weight,
                EXTRACT(EPOCH FROM (NOW() - created_at)) AS age_seconds
            FROM notifications
            WHERE student_id = $1 AND is_read = FALSE
            ORDER BY
                type_weight DESC,
                created_at  DESC
            LIMIT $2;
        `;
        const result = await query(sql, [studentId, n]);
        return result.rows;
    },

    async getUnreadCount(studentId) {
        const result = await query(
            `SELECT COUNT(*) AS count FROM notifications WHERE student_id = $1 AND is_read = FALSE;`,
            [studentId]
        );
        return parseInt(result.rows[0].count);
    },
};
