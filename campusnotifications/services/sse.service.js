import { Log } from '../../logging-middleware/logger.js';

const clients = new Map();

export const SSEService = {

    async connect(studentId, res) {
        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        res.write('event: connected\ndata: {"status":"connected"}\n\n');

        clients.set(studentId, res);
        await Log('backend', 'info', 'service',
            `SSE connection opened for student_id=${studentId}. Active clients: ${clients.size}`);

        res.on('close', async () => {
            clients.delete(studentId);
            await Log('backend', 'info', 'service',
                `SSE connection closed for student_id=${studentId}. Active clients: ${clients.size}`);
        });

        const pingInterval = setInterval(() => {
            if (clients.has(studentId)) {
                res.write(': ping\n\n');
            } else {
                clearInterval(pingInterval);
            }
        }, 30000);
    },

    async pushToStudent(studentId, notification) {
        const client = clients.get(studentId);
        if (!client) {
            await Log('backend', 'debug', 'service',
                `SSE push skipped — student_id=${studentId} not connected`);
            return false;
        }

        const payload = JSON.stringify(notification);
        client.write(`event: notification\ndata: ${payload}\n\n`);

        await Log('backend', 'info', 'service',
            `SSE pushed to student_id=${studentId}: type=${notification.Type}`);
        return true;
    },

    async broadcast(notification) {
        await Log('backend', 'info', 'service',
            `Broadcasting to ${clients.size} connected SSE clients`);

        let delivered = 0;
        for (const [studentId, res] of clients.entries()) {
            try {
                res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
                delivered++;
            } catch (err) {
                await Log('backend', 'warn', 'service',
                    `SSE broadcast failed for student_id=${studentId}: ${err.message}`);
                clients.delete(studentId);
            }
        }

        await Log('backend', 'info', 'service',
            `Broadcast complete — delivered to ${delivered}/${clients.size + delivered} clients`);
        return delivered;
    },

    getActiveCount: () => clients.size,
};
