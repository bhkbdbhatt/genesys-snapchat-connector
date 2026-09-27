require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    snapchat: {
        clientId: process.env.SNAPCHAT_CLIENT_ID,
        clientSecret: process.env.SNAPCHAT_CLIENT_SECRET,
        refreshToken: process.env.SNAPCHAT_REFRESH_TOKEN,
        orgId: process.env.SNAPCHAT_ORGANIZATION_ID,
        webhookSecret: process.env.SNAPCHAT_WEBHOOK_SECRET,
        apiBaseUrl: 'https://adsapi.snapchat.com/v1'
    },

    genesys: {
        environment: process.env.GENESYS_ENVIRONMENT || 'mypurecloud.com',
        integrationId: process.env.GENESYS_INTEGRATION_ID,
        outboundSecret: process.env.GENESYS_OUTBOUND_SECRET,
        get apiBaseUrl() {
            return `https://api.${this.environment}`;
        }
    }
};