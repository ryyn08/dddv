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
const { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter');

const phoneNumber = "6285883881264";
const usePairingCode = true;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const ryyn = makeWASocket({
        logger: pino({ level: 'fatal' }), // Diubah dari silent ke fatal agar tidak spam tapi tetap stabil
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        version
    });

    // Logika Pairing Code
    if (usePairingCode && !ryyn.authState.creds.registered) {
        setTimeout(async () => {
            let code = await ryyn.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(` RY YN BOT PAIRING CODE: `)), chalk.black(chalk.white(code)));
        }, 3000);
    }

    ryyn.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            const type = Object.keys(m.message)[0];
            const from = m.key.remoteJid;
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const command = body.startsWith('.') ? body.slice(1).trim().split(/ +/).shift().toLowerCase() : null;
            const args = body.trim().split(/ +/).slice(1);
            const text = args.join(" ");
            const isOwner = m.key.fromMe || phoneNumber.includes(m.key.remoteJid);

            // Fungsi Reply Sederhana
            const reply = (teks) => {
                ryyn.sendMessage(from, { text: teks }, { quoted: m });
            };

            switch (command) {
                case 'menu':
                    const menuTeks = `
╭───「 *RYYN BOTZ* 」───╼
│ 👋 Halo, saya adalah Ryyn-MD
│ 
│ *Feature List:*
│ ◦ .getsw (Ambil status WA)
│ ◦ .rvo (Read View Once)
│ ◦ .sbrat [teks] (Buat stiker)
│ ◦ .hd (Upscale Gambar)
╰────────────────╼`;
                    reply(menuTeks);
                    break;

                case 'getsw':
                    if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return reply('Reply status orang lain!');
                    const quotedSw = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    const mimeSw = quotedSw.imageMessage ? 'image' : quotedSw.videoMessage ? 'video' : null;
                    
                    if (mimeSw) {
                        const stream = await downloadContentFromMessage(quotedSw[mimeSw + 'Message'], mimeSw);
                        let buffer = Buffer.from([]);
                        for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }
                        
                        ryyn.sendMessage(from, { [mimeSw]: buffer, caption: `Success Get Status` }, { quoted: m });
                    }
                    break;

                case 'rvo':
                case 'readviewonce':
                    if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return reply('Reply pesan ViewOnce!');
                    const viewOnceMsg = m.message.extendedTextMessage.contextInfo.quotedMessage.viewOnceMessageV2?.message || m.message.extendedTextMessage.contextInfo.quotedMessage.viewOnceMessage?.message;
                    if (!viewOnceMsg) return reply('Itu bukan pesan ViewOnce!');

                    const vType = Object.keys(viewOnceMsg)[0];
                    const vMedia = await downloadContentFromMessage(viewOnceMsg[vType], vType.replace('Message', ''));
                    let vBuffer = Buffer.from([]);
                    for await(const chunk of vMedia) { vBuffer = Buffer.concat([vBuffer, chunk]) }

                    if (vType === 'imageMessage') {
                        ryyn.sendMessage(from, { image: vBuffer, caption: viewOnceMsg[vType].caption }, { quoted: m });
                    } else if (vType === 'videoMessage') {
                        ryyn.sendMessage(from, { video: vBuffer, caption: viewOnceMsg[vType].caption }, { quoted: m });
                    }
                    break;

                case 'sbrat':
                    if (!text) return reply('Ketik teksnya! Contoh: .sbrat Ryyn Ganteng');
                    try {
                        const bratUrl = `https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}`;
                        const sticker = new Sticker(bratUrl, {
                            pack: 'Ryyn Botz',
                            author: 'Ryyn Tamvan',
                            type: StickerTypes.FULL,
                            categories: ['🤩', '🎉'],
                            id: '12345',
                            quality: 70,
                        });
                        const stickerBuffer = await sticker.toBuffer();
                        ryyn.sendMessage(from, { sticker: stickerBuffer }, { quoted: m });
                    } catch (e) {
                        reply('Gagal membuat stiker brat.');
                    }
                    break;

                case 'hd':
                    // Fitur HD Sederhana menggunakan Replicate/External API jika tersedia
                    reply("Fitur HD sedang sinkronisasi...");
                    break;
            }

        } catch (err) {
            console.log("Error pada Message Upsert: ", err);
        }
    });

    ryyn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('Bot Ryyn Berhasil Terhubung! ✅');
        }
    });

    ryyn.ev.on('creds.update', saveCreds);
}

startBot().catch(err => console.error("Fatal Error: ", err));
