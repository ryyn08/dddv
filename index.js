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
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function startRyynBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const Cantarella = makeWASocket({
        version,
        logger: pino({ level: 'fatal' }), // Memperbaiki pino logger agar tidak error
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true,
    });

    // SISTEM PAIRING
    if (!Cantarella.authState.creds.registered) {
        setTimeout(async () => {
            let code = await Cantarella.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(` RYNN BOT PAIRING CODE `)));
            console.log(chalk.black(chalk.bgWhite(` Kode Anda: ${code} `)));
        }, 3000);
    }

    Cantarella.ev.on('creds.update', saveCreds);

    Cantarella.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason === DisconnectReason.loggedOut) { 
                console.log("Device Logged Out, Please Delete Session and Scan Again."); 
                process.exit();
            } else {
                startRyynBot();
            }
        } else if (connection === 'open') {
            console.log(chalk.green("Bot Berhasil Terhubung!"));
        }
    });

    Cantarella.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            const contents = JSON.stringify(m.message);
            const from = m.key.remoteJid;
            const type = Object.keys(m.message)[0];
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = args.join(" ");
            const command = body.slice(0).trim().split(/ +/).shift().toLowerCase();
            const isOwner = ["6285883881264@s.whatsapp.net"].includes(m.key.participant || m.key.remoteJid);

            // Simple Helper
            const reply = (teks) => {
                Cantarella.sendMessage(from, { text: teks }, { quoted: m });
            };

            switch (command) {
                case '.menu':
                case 'menu':
                    const menuTeks = `╭───「 *RYYN BOTZ* 」
│ 
│ • *${command}getsw* (Reply status)
│ • *${command}rvo* (Read ViewOnce)
│ • *${command}sbrat* <teks>
│
╰──────────────╼`;
                    reply(menuTeks);
                    break;

                case 'getsw': {
                    if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return reply('Reply pesan Status yang ingin kamu ambil.');
                    const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    const mime = quoted.imageMessage?.mimetype || quoted.videoMessage?.mimetype;
                    
                    if (/image|video/.test(mime)) {
                        const stream = await downloadContentFromMessage(quoted.imageMessage || quoted.videoMessage, mime.split('/')[0]);
                        let buffer = Buffer.from([]);
                        for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }
                        
                        if (quoted.imageMessage) {
                            await Cantarella.sendMessage(from, { image: buffer, caption: "📸 *Status Dilihat*" }, { quoted: m });
                        } else {
                            await Cantarella.sendMessage(from, { video: buffer, caption: "🎥 *Status Dilihat*" }, { quoted: m });
                        }
                    } else {
                        reply("Hanya support gambar/video status.");
                    }
                }
                break;

                case 'rvo': case 'readviewonce': {
                    if (!isOwner) return reply("Khusus Owner!");
                    const q = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!q) return reply("Reply pesan ViewOnce!");
                    const viewOnce = q.viewOnceMessageV2?.message || q.viewOnceMessage?.message;
                    if (!viewOnce) return reply("Itu bukan pesan ViewOnce!");

                    const mType = Object.keys(viewOnce)[0];
                    const media = viewOnce[mType];
                    const stream = await downloadContentFromMessage(media, mType.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }

                    if (/video/.test(mType)) {
                        await Cantarella.sendMessage(from, { video: buffer, caption: media.caption }, { quoted: m });
                    } else if (/image/.test(mType)) {
                        await Cantarella.sendMessage(from, { image: buffer, caption: media.caption }, { quoted: m });
                    } else if (/audio/.test(mType)) {
                        await Cantarella.sendMessage(from, { audio: buffer, mimetype: 'audio/mpeg', ptt: true }, { quoted: m });
                    }
                }
                break;

                case 'sbrat': {
                    if (!text) return reply('Masukkan teksnya! Contoh: sbrat halo');
                    await reply("Sedang memproses...");
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
                        const stickerBuffer = await sticker.toBuffer();
                        await Cantarella.sendMessage(from, { sticker: stickerBuffer }, { quoted: m });
                    } catch (e) {
                        console.log(e);
                        reply("Gagal membuat sticker brat.");
                    }
                }
                break;
            }
        } catch (err) {
            console.log(chalk.red("Error Upsert: "), err);
        }
    });

    return Cantarella;
}

startRyynBot();
