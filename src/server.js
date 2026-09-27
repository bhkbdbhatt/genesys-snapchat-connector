const express = require('express');
const config = require('../config/default');
const logger = require('./utils/logger');
const snapchatService = require('./services/snapchatService');
const genesysService = require('./services/genesysService');
const { snapchatToGenesys, genesysToSnapchat } = require('./utils/mapper');

const app = express();

// Raw body parser for Snapchat HMAC verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv
    });
});

/**
 * Inbound Webhook: Snapchat -> Service -> Genesys Cloud
 */
app.post('/webhooks/snapchat', async (req, res) => {
    const signature = req.headers['x-snap-signature'];

    // 1. Verify HMAC Signature
    if (!snapchatService.verifySignature(req.rawBody, signature)) {
        logger.warn('Unauthorized Snapchat webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
        const snapEvent = req.body;
        logger.info('Received webhook from Snapchat', { eventType: snapEvent.event_type });

        // Handle webhook challenge/verification if Snapchat sends one
        if (snapEvent.challenge) {
            return res.status(200).json({ challenge: snapEvent.challenge });
        }

        // 2. Map payload from Snapchat format to Genesys Open Messaging v2 format
        const genesysPayload = snapchatToGenesys(snapEvent);

        // 3. Post to Genesys Cloud Inbound Open Messaging Endpoint
        await genesysService.sendInboundMessageToGenesys(genesysPayload);

        return res.status(200).json({ status: 'PROCESSED' });
    } catch (err) {
        logger.error('Failed processing Snapchat webhook', { error: err.message });
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Outbound Webhook: Genesys Cloud -> Service -> Snapchat
 */
app.post('/webhooks/genesys', async (req, res) => {
    const reqToken = req.headers['x-genesys-token'];

    // 1. Verify Genesys Outbound Token
    if (!genesysService.verifyGenesysToken(reqToken)) {
        logger.warn('Unauthorized Genesys webhook token');
        return res.status(401).json({ error: 'Unauthorized token' });
    }

    try {
        const genesysPayload = req.body;
        logger.info('Received outbound message from Genesys', { messageId: genesysPayload.id });

        // 2. Map payload from Genesys format to Snapchat format
        const { recipientId, messageData } = genesysToSnapchat(genesysPayload);

        if (!recipientId) {
            logger.error('Missing recipient Snapchat ID in Genesys payload');
            return res.status(400).json({ error: 'Missing recipient ID' });
        }

        // 3. Send message via Snapchat Business API
        await snapchatService.sendMessage(recipientId, messageData);

        return res.status(200).json({ status: 'DELIVERED' });
    } catch (err) {
        logger.error('Failed processing Genesys outbound message', { error: err.message });
        return res.status(500).json({ error: 'Failed to send message to Snapchat' });
    }
});

// Start Express Server
const PORT = config.port;
app.listen(PORT, () => {
    logger.info(`Genesys Cloud Snapchat Connector service running on port ${PORT}`);
});