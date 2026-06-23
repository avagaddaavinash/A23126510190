import { NotificationRepository } from '../repositories/notification.repository.js';
import { Log } from '../../logging-middleware/logger.js';

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

const AFFORDMED_API = 'http://4.224.186.213';
const TOKEN = process.env.AFFORDMED_TOKEN || '';
const AUTH_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
};

export const NotificationService = {

    async list(studentId, filters) {
        await Log('backend', 'info', 'service',
            `Listing notifications for student_id=${studentId}`);
        return NotificationRepository.getByStudent(studentId, filters);
    },

    async getUnread(studentId) {
        await Log('backend', 'info', 'service',
            `Fetching unread notifications for student_id=${studentId}`);
        return NotificationRepository.getUnreadByStudent(studentId);
    },

    async markRead(notifId, studentId) {
        await Log('backend', 'info', 'service',
            `Marking notification id=${notifId} as read`);
        const updated = await NotificationRepository.markAsRead(notifId, studentId);
        if (!updated) {
            await Log('backend', 'warn', 'service',
                `Notification id=${notifId} not found or not owned by student_id=${studentId}`);
            throw new Error('Notification not found or access denied.');
        }
        return updated;
    },

    async markAllRead(studentId) {
        const count = await NotificationRepository.markAllAsRead(studentId);
        await Log('backend', 'info', 'service',
            `Marked ${count} notifications as read for student_id=${studentId}`);
        return { updatedCount: count };
    },

    async getPriorityInbox(n = 10) {
        await Log('backend', 'info', 'service',
            `Fetching priority inbox — top ${n} from AffordMed notification API`);

        const res = await fetch(`${AFFORDMED_API}/evaluation-service/notifications`, {
            headers: AUTH_HEADERS,
        });
        const data = await res.json();

        if (!res.ok) {
            await Log('backend', 'error', 'service',
                `Notification API returned ${res.status}`);
            throw new Error(`Notification API error: ${res.status}`);
        }

        const notifications = data.notifications || [];
        await Log('backend', 'debug', 'service',
            `Received ${notifications.length} raw notifications, scoring for top ${n}`);

        const now = Date.now();

        const scored = notifications.map(notif => {
            const weight = TYPE_WEIGHT[notif.Type] || 0;
            const ageMs = now - new Date(notif.Timestamp).getTime();
            const ageMinutes = ageMs / 60000;
            const recency = Math.max(0, 1000 - ageMinutes); // decays over time
            const score = weight * 1000 + recency;

            return { ...notif, score, weight, ageMinutes: Math.round(ageMinutes) };
        });

        const topN = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, n);

        await Log('backend', 'info', 'service',
            `Priority inbox computed. Top result: Type=${topN[0]?.Type}, Score=${topN[0]?.score?.toFixed(1)}`);

        return topN;
    },

    async notifyAll(type, message, studentIds) {
        await Log('backend', 'info', 'service',
            `notifyAll triggered — type=${type}, targeting ${studentIds.length} students`);

        const insertedCount = await NotificationRepository.createForAllStudents(
            type, message, { broadcast: true }
        );

        await Log('backend', 'info', 'service',
            `DB bulk insert complete: ${insertedCount} notification rows created`);

        await Log('backend', 'info', 'service',
            `notifyAll complete. Email delivery should be handled by queue workers.`);

        return { success: true, notified: insertedCount };
    },
};
