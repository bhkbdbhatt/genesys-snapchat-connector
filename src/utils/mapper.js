/**
 * Maps Snapchat Webhook message event to Genesys Cloud Open Messaging v2 Schema
 */
function snapchatToGenesys(snapEvent) {
    const eventData = snapEvent.event_data || {};
    const sender = eventData.sender || {};
    const message = eventData.message || {};

    const mapped = {
        id: message.id || `snap_${Date.now()}`,
        channel: {
            id: snapEvent.conversation_id || 'snapchat_default_conv',
            type: 'Private',
            to: {
                id: snapEvent.recipient_id || 'business_account'
            },
            from: {
                id: sender.snap_id || 'unknown_user',
                nickname: sender.display_name || 'Snapchat User',
                type: 'User'
            },
            time: new Date(snapEvent.timestamp || Date.now()).toISOString()
        },
        type: 'Text',
        text: ''
    };

    if (message.text) {
        mapped.text = message.text;
    } else if (message.media) {
        mapped.type = 'Media';
        mapped.text = message.media.caption || 'Media received';

        // Map Snap Photo/Video attachment
        const mediaType = message.media.type === 'VIDEO' ? 'Video' : 'Image';
        mapped.media = [
            {
                url: message.media.url,
                mediaType: mediaType,
                mime: message.media.type === 'VIDEO' ? 'video/mp4' : 'image/jpeg'
            }
        ];
    }

    return mapped;
}

/**
 * Maps Genesys Cloud Outbound Message payload to Snapchat Direct Message format
 */
function genesysToSnapchat(genesysPayload) {
    const recipientId = genesysPayload.channel?.to?.id;
    const type = genesysPayload.type;

    let messageData = {};

    if (type === 'Text' || genesysPayload.text) {
        messageData = {
            type: 'text',
            text: genesysPayload.text
        };
    }

    if (genesysPayload.media && genesysPayload.media.length > 0) {
        const attachment = genesysPayload.media[0];
        const isVideo = attachment.mime?.startsWith('video') || attachment.mediaType === 'Video';

        messageData = {
            type: 'media',
            mediaType: isVideo ? 'VIDEO' : 'IMAGE',
            url: attachment.url
        };
    }

    return {
        recipientId,
        messageData
    };
}

module.exports = {
    snapchatToGenesys,
    genesysToSnapchat
};