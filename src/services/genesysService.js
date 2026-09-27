const axios = require('axios');
const config = require('../../config/default');
const logger = require('../utils/logger');

class GenesysService {
    constructor() {
        this.client = axios.create({
            baseURL: config.genesys.apiBaseUrl,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Validates inbound token sent from Genesys Open Messaging integration
     */
    verifyGenesysToken(reqToken) {
        if (!config.genesys.outboundSecret) return true;
        return reqToken === config.genesys.outboundSecret;
    }

    /**
     * Posts mapped inbound Snapchat message to Genesys Cloud Open Messaging API v2
     */
    async sendInboundMessageToGenesys(mappedPayload) {
        const integrationId = config.genesys.integrationId;
        const url = `/api/v2/conversations/messaging/integrations/open/${integrationId}/inbound/open`;

        logger.info('Forwarding mapped message to Genesys Cloud', {
            integrationId,
            snapchatUserId: mappedPayload.from.id
        });

        try {
            const response = await this.client.post(url, mappedPayload);
            logger.info('Successfully forwarded to Genesys', { status: response.status });
            return response.data;
        } catch (err) {
            logger.error('Error sending payload to Genesys Open Messaging API v2', {
                error: err.response?.data || err.message,
                payload: mappedPayload
            });
            throw err;
        }
    }
}

module.exports = new GenesysService();