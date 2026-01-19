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
const chalk = require('chalk');
const { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter');

const phoneNumber = "6285883881264";
const usePairingCode = true;
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const ryyn = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (usePairingCode && !ryyn.authState.creds.registered) {
        setTimeout(async () => {
            let code = await ryyn.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(` Your Pairing Code : `)), chalk.black(chalk.bgWhite(` ${code} `)));
        }, 3000);
    }

    ryyn.ev.on('creds.update', saveCreds);
    ryyn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (connection === 'open') {
            console.log(chalk.green('Bot Connected!'));
        }
    });

    ryyn.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            const contents = JSON.stringify(m.message);
            const from = m.key.remoteJid;
            const type = Object.keys(m.message)[0];
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const prefix = /^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/)[0] : '';
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = args.join(" ");
            const quoted = m.quoted ? m.quoted : m;
            const mime = (quoted.msg || quoted).mimetype || '';

            // Helper Reply
            const reply = (teks) => {
                ryyn.sendMessage(from, { text: teks }, { quoted: m });
            };

            switch (command) {
                case 'menu': {
                    const menu = `╭───「 *RYYN BOTZ* 」
│
│ • ${prefix}getsw (Reply status)
│ • ${prefix}rvo (Read ViewOnce)
│ • ${prefix}hd (Reply foto)
│ • ${prefix}brat (Teks)
│
╰──────────────╼`;
                    reply(menu);
                }
                break;

                case 'getsw': {
                    if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return reply('Reply pesan Status!');
                    let q = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    let swMime = q.imageMessage?.mimetype || q.videoMessage?.mimetype;
                    let stream = await downloadContentFromMessage(q.imageMessage || q.videoMessage, swMime.split('/')[0]);
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }
                    if (/image/.test(swMime)) {
                        ryyn.sendMessage(from, { image: buffer, caption: 'Status Dilihat' }, { quoted: m });
                    } else {
                        ryyn.sendMessage(from, { video: buffer, caption: 'Status Dilihat' }, { quoted: m });
                    }
                }
                break;

                case 'rvo': case 'readviewonce': {
                    let q = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!q) return reply('Reply pesan ViewOnce!');
                    let viewOnce = q.viewOnceMessageV2?.message?.imageMessage || q.viewOnceMessageV2?.message?.videoMessage;
                    if (!viewOnce) return reply('Itu bukan pesan ViewOnce!');
                    let stream = await downloadContentFromMessage(viewOnce, viewOnce.mimetype.split('/')[0]);
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }
                    if (/image/.test(viewOnce.mimetype)) {
                        ryyn.sendMessage(from, { image: buffer, caption: viewOnce.caption }, { quoted: m });
                    } else {
                        ryyn.sendMessage(from, { video: buffer, caption: viewOnce.caption }, { quoted: m });
                    }
                }
                break;

                case 'hd': {
                    if (!/image/.test(mime)) return reply(`Kirim/Reply foto dengan caption ${prefix}hd`);
                    reply('Sedang memproses...');
                    let stream = await downloadContentFromMessage(m.message.imageMessage || m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }
                    // Menggunakan API eksternal untuk HD (Upscale)
                    try {
                        let res = `https://api.lolhuman.xyz/api/upscale?apikey=GataDios&img=${buffer}`; // Contoh API
                        ryyn.sendMessage(from, { image: { url: res }, caption: 'Sukses HD' }, { quoted: m });
                    } catch {
                        reply('Gagal memproses gambar.');
                    }
                }
                break;

                case 'brat': {
                    if (!text) return reply(`Contoh: ${prefix}brat halo ryyn`);
                    let bratUrl = `https://aqul-brat.vercel.app/api/brat?text=${encodeURIComponent(text)}`;
                    let sticker = new Sticker(bratUrl, {
                        pack: 'Ryyn Botz',
                        author: 'Ryyn',
                        type: StickerTypes.FULL,
                        categories: ['🤩', '🎉'],
                        id: '12345',
                        quality: 70,
                        background: '#FFFFFF'
                    });
                    ryyn.sendMessage(from, await sticker.toMessage(), { quoted: m });
                }
                break;
            }
        } catch (err) {
            console.log(err);
        }
    });
}

startBot();
