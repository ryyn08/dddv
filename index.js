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
    proto
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const axios = require("axios");
const { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter');

// Konfigurasi Utama
const phoneNumber = "6285883881264";
const usePairingCode = true;
const ownerNumber = ["6285883881264"];

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const Cantarella = makeWASocket({
        version,
        logger: pino({ level: 'fatal' }), // Diubah dari 'silent' agar tidak error di beberapa environment
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
            console.log(chalk.black(chalk.bgGreen(`\n╭────────────────────────────╮`)));
            console.log(chalk.black(chalk.bgGreen(`│ YOUR PAIRING CODE : ${code} │`)));
            console.log(chalk.black(chalk.bgGreen(`╰────────────────────────────╯\n`)));
        }, 3000);
    }

    Cantarella.ev.on("creds.update", saveCreds);

    Cantarella.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason === DisconnectReason.loggedOut) { 
                console.log("Device Logged Out, Please Delete Session and Scan Again."); 
                process.exit();
            } else { 
                startBot(); 
            }
        } else if (connection === "open") {
            console.log("RYYN BOTZ CONNECTED SUCCESSFULLY!");
        }
    });

    Cantarella.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            const type = Object.keys(m.message)[0];
            const from = m.key.remoteJid;
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const prefix = /^[./!#]/.test(body) ? body.match(/^[./!#]/)[0] : '';
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = args.join(" ");
            const isOwner = ownerNumber.includes(m.key.participant || m.key.remoteJid);

            // Fungsi Reply Sederhana
            const reply = (teks) => {
                Cantarella.sendMessage(from, { text: teks }, { quoted: m });
            };

            switch (command) {
                case 'menu':
                    const menuText = `
╭───「 *RYYN BOTZ* 」───
│ 
│ • ${prefix}getsw (Reply status)
│ • ${prefix}rvo (Reply viewonce)
│ • ${prefix}sbrat (Teks)
│ • ${prefix}hd (Coming Soon)
│
╰────────────────────`;
                    reply(menuText);
                    break;

                case 'getsw': {
                    if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return reply('Reply pesan Status!');
                    const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    const mime = quoted.imageMessage?.mimetype || quoted.videoMessage?.mimetype || '';
                    
                    if (/image|video/.test(mime)) {
                        const stream = await downloadContentFromMessage(quoted.imageMessage || quoted.videoMessage, mime.split('/')[0]);
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                        
                        if (/image/.test(mime)) {
                            await Cantarella.sendMessage(from, { image: buffer, caption: `Status dari: @${m.message.extendedTextMessage.contextInfo.participant.split('@')[0]}`, mentions: [m.message.extendedTextMessage.contextInfo.participant] }, { quoted: m });
                        } else {
                            await Cantarella.sendMessage(from, { video: buffer, caption: `Status dari: @${m.message.extendedTextMessage.contextInfo.participant.split('@')[0]}`, mentions: [m.message.extendedTextMessage.contextInfo.participant] }, { quoted: m });
                        }
                    } else {
                        reply('Media tidak dikenal.');
                    }
                }
                break;

                case 'rvo': case 'readviewonce': {
                    if (!isOwner) return reply("Khusus Owner!");
                    const q = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!q) return reply("Reply pesan ViewOnce!");
                    const viewOnce = q.viewOnceMessageV2?.message || q.viewOnceMessage?.message;
                    if (!viewOnce) return reply("Itu bukan pesan ViewOnce!");

                    const mediaType = Object.keys(viewOnce)[0];
                    const stream = await downloadContentFromMessage(viewOnce[mediaType], mediaType.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                    if (/image/.test(mediaType)) {
                        await Cantarella.sendMessage(from, { image: buffer, caption: viewOnce[mediaType].caption }, { quoted: m });
                    } else if (/video/.test(mediaType)) {
                        await Cantarella.sendMessage(from, { video: buffer, caption: viewOnce[mediaType].caption }, { quoted: m });
                    }
                }
                break;

                case 'sbrat': {
                    if (!text) return reply(`Contoh: ${prefix}sbrat Ganteng`);
                    const url = `https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}&background=%23ffffff&color=%23000000&emojiStyle=apple`;
                    
                    const sticker = new Sticker(url, {
                        pack: 'Ryyn Botz',
                        author: 'ryyn tamvan',
                        type: StickerTypes.FULL,
                        categories: ['🤩', '🎉'],
                        id: '12345',
                        quality: 70,
                    });
                    const buffer = await sticker.toBuffer();
                    await Cantarella.sendMessage(from, { sticker: buffer }, { quoted: m });
                }
                break;
            }
        } catch (err) {
            console.log("Error pada Message Upsert: ", err);
        }
    });
}

startBot();
