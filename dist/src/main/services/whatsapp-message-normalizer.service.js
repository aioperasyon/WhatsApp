const TECHNICAL_MESSAGE_TYPES = new Set([
    'protocolMessage',
    'senderKeyDistributionMessage',
    'messageContextInfo',
    'deviceSentMessage',
    'keepInChatMessage',
]);
function unwrapMessage(message) {
    if (!message)
        return null;
    if (message.ephemeralMessage?.message) {
        return unwrapMessage(message.ephemeralMessage.message);
    }
    if (message.viewOnceMessage?.message) {
        return unwrapMessage(message.viewOnceMessage.message);
    }
    if (message.viewOnceMessageV2?.message) {
        return unwrapMessage(message.viewOnceMessageV2.message);
    }
    if (message.documentWithCaptionMessage?.message) {
        return unwrapMessage(message.documentWithCaptionMessage.message);
    }
    return message;
}
function extractText(message) {
    if (!message)
        return null;
    return (message.conversation ??
        message.extendedTextMessage?.text ??
        message.imageMessage?.caption ??
        message.videoMessage?.caption ??
        message.documentMessage?.caption ??
        message.buttonsResponseMessage?.selectedDisplayText ??
        message.listResponseMessage?.title ??
        message.templateButtonReplyMessage?.selectedDisplayText ??
        null);
}
function detectMessageType(message) {
    if (!message)
        return 'unknown';
    const preferredTypes = [
        'conversation',
        'extendedTextMessage',
        'imageMessage',
        'videoMessage',
        'audioMessage',
        'documentMessage',
        'stickerMessage',
        'contactMessage',
        'contactsArrayMessage',
        'locationMessage',
        'liveLocationMessage',
        'buttonsResponseMessage',
        'listResponseMessage',
        'templateButtonReplyMessage',
        'reactionMessage',
        'pollCreationMessage',
        'pollUpdateMessage',
        'protocolMessage',
        'senderKeyDistributionMessage',
        'deviceSentMessage',
    ];
    for (const type of preferredTypes) {
        if (message[type] != null) {
            return type;
        }
    }
    const key = Object.keys(message).find((item) => item !== 'messageContextInfo' &&
        message[item] != null);
    return key ?? 'unknown';
}
function previewForType(type, text) {
    if (text)
        return text;
    const labels = {
        imageMessage: 'Fotoğraf',
        videoMessage: 'Video',
        audioMessage: 'Sesli mesaj',
        documentMessage: 'Belge',
        stickerMessage: 'Çıkartma',
        contactMessage: 'Kişi',
        contactsArrayMessage: 'Kişiler',
        locationMessage: 'Konum',
        liveLocationMessage: 'Canlı konum',
        reactionMessage: 'Tepki',
        pollCreationMessage: 'Anket',
        pollUpdateMessage: 'Anket yanıtı',
    };
    return labels[type] ?? 'Desteklenmeyen mesaj';
}
function jidToPhoneNumber(jid) {
    if (!jid.endsWith('@s.whatsapp.net'))
        return null;
    const value = jid.split('@')[0]?.split(':')[0]?.replace(/\D/g, '') ?? '';
    return value.length > 0 ? value : null;
}
function timestampToIso(value) {
    let seconds = Math.floor(Date.now() / 1000);
    if (typeof value === 'number') {
        seconds = value;
    }
    else if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            seconds = parsed;
    }
    else if (value &&
        typeof value === 'object' &&
        'toNumber' in value &&
        typeof value.toNumber === 'function') {
        seconds = value.toNumber();
    }
    return new Date(seconds * 1000).toISOString();
}
export class WhatsAppMessageNormalizerService {
    normalize(accountId, rawMessage, options = {}) {
        const key = rawMessage.key;
        if (!key)
            return null;
        const keyWithAlternative = key;
        const remoteJid = options.resolvedRemoteJid ??
            keyWithAlternative.remoteJidAlt ??
            key.remoteJid;
        if (!remoteJid ||
            remoteJid === 'status@broadcast' ||
            remoteJid.endsWith('@broadcast')) {
            return null;
        }
        const content = unwrapMessage(rawMessage.message);
        const messageType = detectMessageType(content);
        if (messageType === 'unknown' ||
            TECHNICAL_MESSAGE_TYPES.has(messageType)) {
            return null;
        }
        const text = extractText(content);
        const direction = key.fromMe ? 'outgoing' : 'incoming';
        const timestamp = timestampToIso(rawMessage.messageTimestamp);
        const status = direction === 'outgoing' ? 'sent' : 'delivered';
        const preview = previewForType(messageType, text);
        return {
            chat: {
                accountId,
                jid: remoteJid,
                displayName: options.displayName ??
                    rawMessage.pushName ??
                    null,
                phoneNumber: jidToPhoneNumber(remoteJid),
                lastMessagePreview: preview,
                lastMessageAt: timestamp,
                incrementUnread: options.incrementUnread ??
                    direction === 'incoming',
            },
            message: {
                accountId,
                remoteJid,
                whatsappMessageId: key.id ?? null,
                direction,
                senderJid: key.participant ?? remoteJid,
                text: text ?? preview,
                messageType,
                status,
                timestamp,
            },
        };
    }
}
//# sourceMappingURL=whatsapp-message-normalizer.service.js.map