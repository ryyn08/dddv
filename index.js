const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeInMemoryStore, 
    downloadContentFromMessage,
    jidDecode
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const axios = require('axios');
const { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter');

const phoneNumber = "6285883881264"; // Nomor Bot Anda
const usePairingCode = true;

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const ryyn = makeWASocket({
        version,
        logger: pino({ level: 'fatal' }), // Diubah ke fatal agar tidak spam log
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true
    });

    if (usePairingCode && !ryyn.authState.creds.registered) {
        setTimeout(async () => {
            let code = await ryyn.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(` RY-BOT PAIRING CODE: `)), chalk.black(chalk.white(` ${code} `)));
        }, 3000);
    }

    ryyn.ev.on('creds.update', saveCreds);
    
    ryyn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ Bot Berhasil Terhubung!');
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

            // Simple Reply Function
            const reply = (teks) => {
                ryyn.sendMessage(from, { text: teks }, { quoted: m });
            };

            switch (command) {
                case 'menu':
                    const menuText = `
╭───「 *RYYN BOTZ* 」
│
│ • ${prefix}sbrat <teks>
│ • ${prefix}getsw (reply status)
│ • ${prefix}rvo (reply viewonce)
│
╰──────────────╼`;
                    reply(menuText);
                    break;

                case 'sbrat': {
                    if (!text) return reply(`Kirim perintah ${prefix}sbrat teksnya`);
                    await ryyn.sendMessage(from, { react: { text: "⏳", key: m.key }});
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
                    await ryyn.sendMessage(from, { sticker: buffer }, { quoted: m });
                }
                break;

                case 'getsw': {
                    if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return reply('Reply Status WhatsApp-nya!');
                    const quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    const mime = quotedMsg.imageMessage?.mimetype || quotedMsg.videoMessage?.mimetype;
                    
                    try {
                        const stream = await downloadContentFromMessage(quotedMsg.imageMessage || quotedMsg.videoMessage, mime.split('/')[0]);
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                        
                        if (/image/.test(mime)) {
                            await ryyn.sendMessage(from, { image: buffer, caption: "Berhasil Mengambil Status" }, { quoted: m });
                        } else {
                            await ryyn.sendMessage(from, { video: buffer, caption: "Berhasil Mengambil Status" }, { quoted: m });
                        }
                    } catch (e) {
                        reply("Gagal mengambil status. Pastikan media masih tersedia.");
                    }
                }
                break;

                case 'rvo': case 'readviewonce': {
                    const q = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!q) return reply("Reply pesan View Once!");
                    const viewOnce = q.viewOnceMessageV2?.message || q.viewOnceMessage?.message;
                    if (!viewOnce) return reply("Itu bukan pesan View Once!");

                    const mType = Object.keys(viewOnce)[0];
                    const media = viewOnce[mType];
                    const stream = await downloadContentFromMessage(media, mType.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                    if (/image/.test(mType)) {
                        await ryyn.sendMessage(from, { image: buffer, caption: media.caption }, { quoted: m });
                    } else if (/video/.test(mType)) {
                        await ryyn.sendMessage(from, { video: buffer, caption: media.caption }, { quoted: m });
                    }
                }
                break;
            }
        } catch (err) {
            console.log("Error logic:", err);
        }
    });

    return ryyn;
}

const chalk = require('chalk');
startBot();
