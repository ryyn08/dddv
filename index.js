const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    downloadContentFromMessage,
    jidDecode,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadHistory,
    proto
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const axios = require('axios');
const chalk = require('chalk');
const { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter');

const phoneNumber = "6283119396819"; // Nomor Bot Kamu
const usePairingCode = true;

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const Cantarella = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true,
    });

    // Logika Pairing Code
    if (usePairingCode && !Cantarella.authState.creds.registered) {
        setTimeout(async () => {
            let code = await Cantarella.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(` Your Pairing Code : `)), chalk.black(chalk.bgWhite(` ${code} `)));
        }, 3000);
    }

    Cantarella.ev.on('creds.update', saveCreds);

    Cantarella.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            if (m.key && m.key.remoteJid === 'status@broadcast') return;
            
            const jid = m.key.remoteJid;
            const type = Object.keys(m.message)[0];
            const content = JSON.stringify(m.message);
            const from = m.key.remoteJid;
            
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const prefix = /^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/)[0] : '';
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = args.join(" ");
            const quoted = m.quoted ? m.quoted : m;

            // Helper Reply
            const reply = (teks) => {
                Cantarella.sendMessage(from, { text: teks }, { quoted: m });
            };

            switch (command) {
                case 'menu': {
                    let menuTeks = `*RYYN BOTZ - MULTI DEVICE*\n\n` +
                        `👋 Halo Kak!\n` +
                        `Berikut adalah daftar fitur yang tersedia:\n\n` +
                        `*📂 DOWNLOADER*\n` +
                        `• ${prefix}getsw (Reply status orang)\n` +
                        `• ${prefix}rvo (Lihat pesan sekali lihat)\n\n` +
                        `*🎨 CREATIVE*\n` +
                        `• ${prefix}sbrat <teks> (Buat sticker brat)\n` +
                        `• ${prefix}hd (Coming soon)\n\n` +
                        `Gunakan bot dengan bijak!`;
                    reply(menuTeks);
                }
                break;

                case 'getsw': {
                    if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return reply('Reply pesan Status yang ingin kamu ambil.');
                    const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    const mime = quoted.imageMessage?.mimetype || quoted.videoMessage?.mimetype;

                    try {
                        const stream = await downloadContentFromMessage(quoted.imageMessage || quoted.videoMessage, mime.split('/')[0]);
                        let buffer = Buffer.from([]);
                        for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                        if (/image/.test(mime)) {
                            await Cantarella.sendMessage(from, { image: buffer, caption: "Success Get Status" }, { quoted: m });
                        } else {
                            await Cantarella.sendMessage(from, { video: buffer, caption: "Success Get Status" }, { quoted: m });
                        }
                    } catch (e) {
                        reply("Gagal mengambil status. Pastikan media belum kadaluarsa.");
                    }
                }
                break;

                case 'rvo': case 'readviewonce': {
                    const q = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!q) return reply("Reply pesan ViewOnce!");
                    const viewOnce = q.viewOnceMessageV2?.message || q.viewOnceMessage?.message;
                    if (!viewOnce) return reply("Itu bukan pesan ViewOnce");

                    const mtype = Object.keys(viewOnce)[0];
                    const media = viewOnce[mtype];
                    const stream = await downloadContentFromMessage(media, mtype.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                    if (/image/.test(mtype)) {
                        await Cantarella.sendMessage(from, { image: buffer, caption: media.caption }, { quoted: m });
                    } else if (/video/.test(mtype)) {
                        await Cantarella.sendMessage(from, { video: buffer, caption: media.caption }, { quoted: m });
                    }
                }
                break;

                case 'sbrat': {
                    if (!text) return reply(`Contoh: ${prefix + command} ryan tamvan`);
                    try {
                        const bratUrl = `https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}&background=%23ffffff&color=%23000000&emojiStyle=apple`;
                        
                        const sticker = new Sticker(bratUrl, {
                            pack: 'Ryyn Botz',
                            author: 'ryyn tamvan',
                            type: StickerTypes.FULL,
                            categories: ['🤩', '🎉'],
                            id: '12345',
                            quality: 70,
                        });

                        const buffer = await sticker.toBuffer();
                        await Cantarella.sendMessage(from, { sticker: buffer }, { quoted: m });
                    } catch (e) {
                        reply("Terjadi kesalahan saat membuat sticker Brat.");
                    }
                }
                break;
            }
        } catch (err) {
            console.log(chalk.red("Error Upsert: "), err);
        }
    });

    Cantarella.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(chalk.green('Bot Berhasil Terhubung!'));
        }
    });
}

startBot();
