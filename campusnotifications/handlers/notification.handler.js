import { NotificationService } from '../services/notification.service.js';
import { SSEService } from '../services/sse.service.js';
import { Log } from '../../logging-middleware/logger.js';

export const listHandler = async (req, res) => {
    try {
        const { type, limit, offset } = req.query;
        const studentId = req.user.studentId;

        await Log('backend', 'info', 'handler',
            `GET /notifications — student_id=${studentId}, type=${type || 'all'}`);

        const data = await NotificationService.list(studentId, {
            type,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0,
        });

        return res.status(200).json({ success: true, count: data.length, notifications: data });
    } catch (err) {
        await Log('backend', 'error', 'handler', `listHandler error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to fetch notifications.' });
    }
};

export const unreadHandler = async (req, res) => {
    try {
        const studentId = req.user.studentId;
        await Log('backend', 'info', 'handler',
            `GET /notifications/unread — student_id=${studentId}`);

        const data = await NotificationService.getUnread(studentId);
        return res.status(200).json({ success: true, count: data.length, notifications: data });
    } catch (err) {
        await Log('backend', 'error', 'handler', `unreadHandler error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to fetch unread.' });
    }
};

export const priorityInboxHandler = async (req, res) => {
    try {
        const n = parseInt(req.query.n) || 10;
        await Log('backend', 'info', 'handler',
            `GET /notifications/priority?n=${n} — student_id=${req.user.studentId}`);

        const topN = await NotificationService.getPriorityInbox(n);
        return res.status(200).json({ success: true, count: topN.length, notifications: topN });
    } catch (err) {
        await Log('backend', 'error', 'handler', `priorityInboxHandler error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to fetch priority inbox.' });
    }
};

export const markReadHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const studentId = req.user.studentId;

        await Log('backend', 'info', 'handler',
            `PATCH /notifications/${id}/read — student_id=${studentId}`);

        const updated = await NotificationService.markRead(id, studentId);
        return res.status(200).json({ success: true, notification: updated });
    } catch (err) {
        const status = err.message.includes('not found') ? 404 : 500;
        await Log('backend', 'warn', 'handler', `markReadHandler: ${err.message}`);
        return res.status(status).json({ success: false, error: err.message });
    }
};

export const markAllReadHandler = async (req, res) => {
    try {
        const studentId = req.user.studentId;
        await Log('backend', 'info', 'handler',
            `PATCH /notifications/read-all — student_id=${studentId}`);

        const result = await NotificationService.markAllRead(studentId);
        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        await Log('backend', 'error', 'handler', `markAllReadHandler error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to mark all as read.' });
    }
};

export const broadcastHandler = async (req, res) => {
    try {
        const { type, message } = req.body;
        if (!type || !message) {
            return res.status(400).json({ success: false, error: '"type" and "message" are required.' });
        }

        await Log('backend', 'info', 'handler',
            `POST /notifications/broadcast — type=${type}, message="${message}"`);

        const result = await NotificationService.notifyAll(type, message, []);

        await SSEService.broadcast({ Type: type, Message: message, Timestamp: new Date().toISOString() });

        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        await Log('backend', 'error', 'handler', `broadcastHandler error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Broadcast failed.' });
    }
};

export const streamHandler = async (req, res) => {
    const studentId = req.user.studentId;
    await Log('backend', 'info', 'handler',
        `GET /notifications/stream — student_id=${studentId} opening SSE connection`);
    await SSEService.connect(studentId, res);
};
