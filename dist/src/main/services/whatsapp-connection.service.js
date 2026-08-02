import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, } from '@whiskeysockets/baileys';
import fs from 'node:fs';
import QRCode from 'qrcode';
import pino from 'pino';
import { getWhatsAppAccount, updateWhatsAppAccountConnection, } from '../repositories/whatsapp-account.repository.js';
import { getInboxRuntimeService } from './inbox-container.service.js';
import { WhatsAppSendService, } from './whatsapp-send.service.js';
const connections = new Map();
const logger = pino({ level: 'silent' });
function requireAccount(accountId) {
    const account = getWhatsAppAccount(accountId);
    if (!account) {
        throw new Error('WhatsApp hesabı bulunamadı.');
    }
    return account;
}
function buildState(accountId) {
    const account = requireAccount(accountId);
    const runtime = connections.get(accountId);
    return {
        account,
        qrDataUrl: runtime?.qrDataUrl ?? null,
        message: runtime?.message ?? null,
    };
}
function requireConnectedRuntime(accountId) {
    const runtime = connections.get(accountId);
    if (!runtime) {
        throw new Error('WhatsApp hesabı bağlı değil. Önce hesabı bağlayın.');
    }
    const account = requireAccount(accountId);
    if (account.status !== 'connected') {
        throw new Error('WhatsApp bağlantısı henüz mesaj göndermeye hazır değil.');
    }
    return runtime;
}
function getDisconnectStatusCode(error) {
    if (!error || typeof error !== 'object') {
        return undefined;
    }
    const candidate = error;
    return candidate.output?.statusCode ?? candidate.statusCode;
}
function randomTypingDuration() {
    return Math.floor(Math.random() * 2001) + 2000;
}
async function simulateTyping(runtime, phoneNumber) {
    const remoteJid = `${phoneNumber}@s.whatsapp.net`;
    try {
        await runtime.socket.sendPresenceUpdate('composing', remoteJid);
        await new Promise((resolve) => {
            setTimeout(resolve, randomTypingDuration());
        });
    }
    finally {
        try {
            await runtime.socket.sendPresenceUpdate('paused', remoteJid);
        }
        catch {
            // Presence kapatma hatasi mesaj gonderimini engellemez.
        }
    }
}
export async function sendCampaignMessage(request) {
    const accountId = request.accountId?.trim();
    const text = request.text?.trim();
    const phoneNumber = request.phoneNumber?.replace(/\D/g, '') ?? '';
    if (!accountId) {
        throw new Error('WhatsApp hesap kimliği zorunludur.');
    }
    if (!phoneNumber) {
        throw new Error('Geçerli bir WhatsApp numarası girin.');
    }
    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
        throw new Error('Telefon numarasını ülke koduyla birlikte girin.');
    }
    if (!text) {
        throw new Error('Boş mesaj gönderilemez.');
    }
    const runtime = requireConnectedRuntime(accountId);
    try {
        if (request.typingSimulation) {
            await simulateTyping(runtime, phoneNumber);
        }
        const result = await runtime.sender.send({
            recipient: phoneNumber,
            text,
            operationLabel: 'kampanya mesajı',
            verifyNewRecipient: true,
        });
        return {
            remoteJid: result.remoteJid,
            whatsappMessageId: result.whatsappMessageId,
            sentAt: result.sentAt,
        };
    }
    catch (reason) {
        const message = reason instanceof Error
            ? reason.message
            : 'Bilinmeyen WhatsApp gönderim hatası.';
        throw new Error(`Kampanya mesajı gönderilemedi: ${message}`);
    }
}
export async function startInboxConversation(request) {
    const accountId = request.accountId?.trim();
    const text = request.text?.trim();
    const phoneNumber = request.phoneNumber?.replace(/\D/g, '') ?? '';
    if (!accountId) {
        throw new Error('WhatsApp hesap kimliği zorunludur.');
    }
    if (!phoneNumber) {
        throw new Error('Geçerli bir WhatsApp numarası girin.');
    }
    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
        throw new Error('Telefon numarasını ülke koduyla birlikte girin.');
    }
    if (!text) {
        throw new Error('Boş mesaj gönderilemez.');
    }
    const runtime = requireConnectedRuntime(accountId);
    try {
        const result = await runtime.sender.send({
            recipient: phoneNumber,
            text,
            operationLabel: 'yeni sohbet mesajı',
            verifyNewRecipient: true,
        });
        return {
            remoteJid: result.remoteJid,
            whatsappMessageId: result.whatsappMessageId,
            sentAt: result.sentAt,
        };
    }
    catch (reason) {
        const message = reason instanceof Error
            ? reason.message
            : 'Bilinmeyen WhatsApp gönderim hatası.';
        throw new Error(`Yeni sohbet başlatılamadı: ${message}`);
    }
}
export async function sendInboxMessage(request) {
    const accountId = request.accountId?.trim();
    const text = request.text?.trim();
    if (!accountId) {
        throw new Error('WhatsApp hesap kimliği zorunludur.');
    }
    if (!request.chatId?.trim()) {
        throw new Error('Sohbet kimliği zorunludur.');
    }
    if (!request.remoteJid?.trim()) {
        throw new Error('Mesaj alıcısı bulunamadı.');
    }
    if (!text) {
        throw new Error('Boş mesaj gönderilemez.');
    }
    const runtime = requireConnectedRuntime(accountId);
    try {
        const result = await runtime.sender.send({
            recipient: request.remoteJid,
            text,
            operationLabel: 'sohbet mesajı',
            chatId: request.chatId,
            verifyNewRecipient: false,
        });
        return {
            whatsappMessageId: result.whatsappMessageId,
            sentAt: result.sentAt,
        };
    }
    catch (reason) {
        const message = reason instanceof Error
            ? reason.message
            : 'Bilinmeyen WhatsApp gönderim hatası.';
        throw new Error(`WhatsApp mesajı gönderilemedi: ${message}`);
    }
}
export async function deleteWhatsAppChat(context) {
    const accountId = context.accountId?.trim();
    const jid = context.jid?.trim();
    if (!accountId) {
        throw new Error('WhatsApp hesap kimliği zorunludur.');
    }
    if (!jid) {
        throw new Error('Silinecek WhatsApp sohbeti bulunamadı.');
    }
    if (!context.lastMessage?.id?.trim()) {
        throw new Error('WhatsApp sohbetini silmek için son mesaj kimliği bulunamadı.');
    }
    const runtime = requireConnectedRuntime(accountId);
    try {
        await runtime.socket.chatModify({
            delete: true,
            lastMessages: [
                {
                    key: {
                        remoteJid: jid,
                        id: context.lastMessage.id,
                        fromMe: context.lastMessage.fromMe,
                    },
                    messageTimestamp: context.lastMessage.timestamp,
                },
            ],
        }, jid);
        console.log(`[Inbox] ${accountId} WhatsApp sohbeti silindi | ` +
            `jid=${jid} messageId=${context.lastMessage.id}`);
    }
    catch (reason) {
        const message = reason instanceof Error
            ? reason.message
            : 'Bilinmeyen WhatsApp sohbet silme hatası.';
        console.error(`[Inbox] ${accountId} WhatsApp sohbeti silinemedi | ` +
            `jid=${jid} hata=${message}`);
        throw new Error(`WhatsApp sohbeti silinemedi: ${message}`);
    }
}
export async function connectWhatsAppAccount(accountId) {
    const account = requireAccount(accountId);
    const existing = connections.get(accountId);
    if (existing) {
        return buildState(accountId);
    }
    updateWhatsAppAccountConnection(accountId, {
        status: 'connecting',
    });
    const { state, saveCreds } = await useMultiFileAuthState(account.sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    const socket = makeWASocket({
        auth: state,
        version,
        browser: Browsers.windows('AI Operasyon CRM'),
        logger,
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
    });
    const runtime = {
        socket,
        sender: new WhatsAppSendService(accountId, socket),
        qrDataUrl: null,
        message: 'WhatsApp bağlantısı başlatılıyor.',
        manuallyClosed: false,
    };
    connections.set(accountId, runtime);
    getInboxRuntimeService().attachAccount(accountId, socket);
    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('messages.update', (updates) => {
        runtime.sender.handleMessagesUpdate(updates);
    });
    socket.ev.on('connection.update', async (update) => {
        const current = connections.get(accountId);
        if (!current) {
            return;
        }
        if (update.qr) {
            current.qrDataUrl = await QRCode.toDataURL(update.qr, {
                margin: 1,
                width: 320,
            });
            current.message = 'QR kodunu WhatsApp ile okutun.';
            updateWhatsAppAccountConnection(accountId, {
                status: 'qr_required',
            });
        }
        if (update.connection === 'open') {
            const userId = socket.user?.id ?? null;
            const phoneNumber = userId
                ? userId.split(':')[0]?.split('@')[0] ?? null
                : null;
            current.qrDataUrl = null;
            current.message =
                'WhatsApp hesabı bağlandı. Sohbet geçmişi senkronize ediliyor.';
            updateWhatsAppAccountConnection(accountId, {
                status: 'connected',
                phoneNumber,
                lastConnectedAt: new Date().toISOString(),
            });
        }
        if (update.connection === 'close') {
            const statusCode = getDisconnectStatusCode(update.lastDisconnect?.error);
            const loggedOut = statusCode === DisconnectReason.loggedOut;
            current.sender.rejectPending('WhatsApp bağlantısı mesaj onayı alınmadan kapandı.');
            getInboxRuntimeService().detachAccount(accountId);
            connections.delete(accountId);
            updateWhatsAppAccountConnection(accountId, {
                status: loggedOut ? 'disconnected' : 'error',
                phoneNumber: loggedOut ? null : undefined,
                lastConnectedAt: loggedOut ? null : undefined,
            });
            if (!current.manuallyClosed && !loggedOut) {
                setTimeout(() => {
                    void connectWhatsAppAccount(accountId).catch(() => {
                        updateWhatsAppAccountConnection(accountId, {
                            status: 'error',
                        });
                    });
                }, 3000);
            }
        }
    });
    return buildState(accountId);
}
export function getWhatsAppConnectionState(accountId) {
    return buildState(accountId);
}
export async function disconnectWhatsAppAccount(accountId) {
    const account = requireAccount(accountId);
    const runtime = connections.get(accountId);
    getInboxRuntimeService().detachAccount(accountId);
    if (runtime) {
        runtime.manuallyClosed = true;
        runtime.sender.rejectPending('WhatsApp bağlantısı kullanıcı tarafından kapatıldı.');
        try {
            await Promise.race([
                runtime.socket.logout(),
                new Promise((_resolve, reject) => {
                    setTimeout(() => reject(new Error('WhatsApp çıkış işlemi zaman aşımına uğradı.')), 8000);
                }),
            ]);
        }
        catch (reason) {
            console.warn(`[WhatsApp] ${accountId} uzak oturum kapatma uyarısı:`, reason instanceof Error ? reason.message : reason);
            runtime.socket.end(new Error('Kullanıcı WhatsApp bağlantısını kapattı.'));
        }
        finally {
            connections.delete(accountId);
        }
    }
    try {
        fs.rmSync(account.sessionPath, {
            recursive: true,
            force: true,
        });
        fs.mkdirSync(account.sessionPath, {
            recursive: true,
        });
    }
    catch (reason) {
        console.warn(`[WhatsApp] ${accountId} yerel oturum temizleme uyarısı:`, reason instanceof Error ? reason.message : reason);
    }
    updateWhatsAppAccountConnection(accountId, {
        status: 'disconnected',
        phoneNumber: null,
        lastConnectedAt: null,
    });
    return buildState(accountId);
}
export async function closeAllWhatsAppConnections() {
    const inboxRuntime = getInboxRuntimeService();
    for (const [accountId, runtime] of connections) {
        inboxRuntime.detachAccount(accountId);
        runtime.manuallyClosed = true;
        runtime.sender.rejectPending('Uygulama mesaj onayı alınmadan kapatıldı.');
        runtime.socket.end(new Error('Uygulama kapatılıyor.'));
        connections.delete(accountId);
    }
}
//# sourceMappingURL=whatsapp-connection.service.js.map