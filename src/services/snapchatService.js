const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config/default');
const logger = require('../utils/logger');

class SnapchatService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiresAt = 0;

        // Axios instance for Snapchat API
        this.client = axios.create({
            baseURL: config.snapchat.apiBaseUrl,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Auto-refresh token interceptor before requests
        this.client.interceptors.request.use(async (reqConfig) => {
            const token = await this.getValidAccessToken();
            reqConfig.headers['Authorization'] = `Bearer ${token}`;
            return reqConfig;
        }, (error) => Promise.reject(error));
    }

    /**
     * Refreshes OAuth2 token if expired or absent
     */
    async getValidAccessToken() {
        const now = Date.now();
        // Refresh 60 seconds before actual expiration
        if (this.accessToken && this.tokenExpiresAt > now + 60000) {
            return this.accessToken;
        }

        logger.info('Refreshing Snapchat OAuth Token...');
        try {
            const response = await axios.post('https://accounts.snapchat.com/login/oauth2/access_token', null, {
                params: {
                    client_id: config.snapchat.clientId,
                    client_secret: config.snapchat.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: config.snapchat.refreshToken
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = response.data.access_token;
            // Expires_in is in seconds
            this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
            logger.info('Snapchat OAuth Token refreshed successfully');
            return this.accessToken;
        } catch (err) {
            logger.error('Failed to refresh Snapchat OAuth Token', { error: err.response?.data || err.message });
            throw new Error('Snapchat OAuth authentication failed');
        }
    }

    /**
     * Validates inbound Snapchat webhook HMAC signature
     */
    verifySignature(rawBody, signatureHeader) {
        if (!config.snapchat.webhookSecret) return true; // Skip if secret not configured in dev
        if (!signatureHeader) return false;

        const hmac = crypto.createHmac('sha256', config.snapchat.webhookSecret);
        const computedSignature = hmac.update(rawBody).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signatureHeader));
    }

    /**
     * Sends direct message back to a Snapchat user via Snapchat Business API
     */
    async sendMessage(recipientSnapId, messageData) {
        logger.info('Sending message to Snapchat user', { recipientSnapId });

        const payload = {
            recipient_id: recipientSnapId,
            message: {}
        };

        if (messageData.type === 'text') {
            payload.message.text = messageData.text;
        } else if (messageData.type === 'media') {
            payload.message.media = {
                type: messageData.mediaType, // 'IMAGE' or 'VIDEO'
                url: Object.keys(messageData.url).length > 0 ? messageData.url : undefined
            };
        }

        try {
            const response = await this.client.post(`/organizations/${config.snapchat.orgId}/messaging/conversations/messages`, payload);
            return response.data;
        } catch (err) {
            logger.error('Error sending message to Snapchat API', {
                recipientSnapId,
                error: err.response?.data || err.message
            });
            throw err;
        }
    }
}

module.exports = new SnapchatService();