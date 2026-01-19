const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    generateForwardMessageContent, 
    prepareWAMessageMedia, 
    generateWAMessageFromContent, 
    generateMessageID, 
    downloadContentFromMessage, 
    makeInMemoryStore, 
    jidDecode, 
    proto 
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const axios = require('axios');
const FileType = require('file-type');
const { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter');

const phoneNumber = "6285883881264";
const usePairingCode = true;

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function Starts() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const Cantarella = makeWASocket({
        version,
        logger: pino({ level: 'fatal' }), // Diubah ke fatal agar tidak spam log tapi tidak error
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true,
    });

    if (usePairingCode && !Cantarella.authState.creds.registered) {
        setTimeout(async () => {
            let code = await Cantarella.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`
╭────────────────╼
╎ RYYN BOT PAIRING CODE : ${code}
╰────────────────╼`);
        }, 3000);
    }

    Cantarella.ev.on('creds.update', saveCreds);

    Cantarella.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            const type = Object.keys(m.message)[0];
            const from = m.key.remoteJid;
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const prefix = /^[./!#]/.test(body) ? body.match(/^[./!#]/)[0] : '';
            const command = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = args.join(" ");
            const isOwner = ["6285883881264@s.whatsapp.net"].includes(m.key.participant || m.key.remoteJid);

            // Fungsi Helper Reply
            const reply = (teks) => {
                Cantarella.sendMessage(from, { text: teks }, { quoted: m });
            };

            switch (command) {
                case 'menu': {
                    const menuText = `
╭───「 *RYYN BOTZ* 」───
│ 
│ 👋 Halo! Nama saya Ryyn Botz
│ 
│ 🛠️ *Fitur Utama:*
│ ⮕ ${prefix}getsw (Reply Status)
│ ⮕ ${prefix}rvo (Ambil ViewOnce)
│ ⮕ ${prefix}sbrat [teks]
│ ⮕ ${prefix}ping
│
╰────────────────╼`;
                    reply(menuText);
                }
                break;

                case 'ping':
                    reply('Pong! Bot Aktif 🚀');
                    break;

                case 'getsw': {
                    if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return reply('Reply pesan Status yang ingin kamu ambil.');
                    const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    const mime = quoted.imageMessage?.mimetype || quoted.videoMessage?.mimetype;

                    if (!/image|video/.test(mime)) return reply('Hanya bisa mengambil Status foto atau video.');

                    try {
                        const messageType = quoted.imageMessage ? 'image' : 'video';
                        const stream = await downloadContentFromMessage(quoted[messageType + 'Message'], messageType);
                        let buffer = Buffer.from([]);
                        for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                        await Cantarella.sendMessage(from, { 
                            [messageType]: buffer, 
                            caption: `📸 *STATUS DOWNLOADER*\n\n${quoted[messageType + 'Message']?.caption || ''}` 
                        }, { quoted: m });
                    } catch (e) {
                        console.log(e);
                        reply('Gagal mengambil status.');
                    }
                }
                break;

                case 'rvo': case 'readviewonce': {
                    if (!isOwner) return reply('Khusus Owner!');
                    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    const viewOnceMsg = quoted?.viewOnceMessageV2?.message || quoted?.viewOnceMessage?.message;
                    
                    if (!viewOnceMsg) return reply('Reply pesan ViewOnce!');

                    const typeV = Object.keys(viewOnceMsg)[0];
                    const media = viewOnceMsg[typeV];
                    const stream = await downloadContentFromMessage(media, typeV.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                    if (/video/.test(typeV)) {
                        await Cantarella.sendMessage(from, { video: buffer, caption: media.caption }, { quoted: m });
                    } else if (/image/.test(typeV)) {
                        await Cantarella.sendMessage(from, { image: buffer, caption: media.caption }, { quoted: m });
                    }
                }
                break;

                case 'sbrat': {
                    if (!text) return reply('Ketik teksnya! Contoh: .sbrat halo');
                    reply('Sedang memproses sticker...');
                    try {
                        const bratUrl = `https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}&background=%23ffffff&color=%23000000&emojiStyle=apple`;
                        const sticker = new Sticker(bratUrl, {
                            pack: 'Ryyn Botz',
                            author: 'Ryyn Tamvan',
                            type: StickerTypes.FULL,
                            categories: ['🤩', '🎉'],
                            id: '12345',
                            quality: 70,
                        });
                        const buffer = await sticker.toBuffer();
                        await Cantarella.sendMessage(from, { sticker: buffer }, { quoted: m });
                    } catch (e) {
                        reply('Gagal membuat sticker brat.');
                    }
                }
                break;
            }
        } catch (err) {
            console.error('Error Handler:', err);
        }
    });

    Cantarella.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) Starts();
        } else if (connection === 'open') {
            console.log('✅ Bot Berhasil Terhubung!');
        }
    });
}

Starts();
