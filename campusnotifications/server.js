import express from 'express';
import 'dotenv/config';
import { Log } from '../logging-middleware/logger.js';
import { auth } from './middleware/auth.middleware.js';
import { registerHandler, loginHandler } from './handlers/auth.handler.js';
import {
    listHandler,
    unreadHandler,
    priorityInboxHandler,
    markReadHandler,
    markAllReadHandler,
    broadcastHandler,
    streamHandler,
} from './handlers/notification.handler.js';

const app = express();
app.use(express.json());

app.get('/health', async (_, res) => {
    await Log('backend', 'debug', 'handler', 'Health check hit');
    res.json({ status: 'ok', service: 'campus-notifications' });
});

app.post('/api/auth/register', registerHandler);
app.post('/api/auth/login', loginHandler);


app.get('/api/notifications', auth, listHandler);
app.get('/api/notifications/unread', auth, unreadHandler);
app.get('/api/notifications/priority', auth, priorityInboxHandler);
app.get('/api/notifications/stream', auth, streamHandler);
app.patch('/api/notifications/read-all', auth, markAllReadHandler);
app.patch('/api/notifications/:id/read', auth, markReadHandler);
app.post('/api/notifications/broadcast', auth, broadcastHandler);

app.use(async (err, req, res, next) => {
    await Log('backend', 'error', 'handler',
        `Unhandled error on ${req.method} ${req.path}: ${err.message}`);
    res.status(500).json({ success: false, error: 'Unexpected server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
    await Log('backend', 'info', 'handler',
        `Campus Notification Server started on port ${PORT}`);
    console.log(`🚀 Campus Notifications running at http://localhost:${PORT}`);
});
