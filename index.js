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
const fetch = require('node-fetch');
const { smsg, getBuffer } = require('./lib/myfunc'); // Pastikan fungsi helper ada atau sesuaikan

const phoneNumber = "6283119396819";
const usePairingCode = true;
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function Starts() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const mane = makeWASocket({
        printQRInTerminal: !usePairingCode,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true, 
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        logger: pino({ level: 'silent' }),
        auth: state
    });

    if (usePairingCode && !mane.authState.creds.registered) {
        setTimeout(async () => {
            const code = await mane.requestPairingCode(phoneNumber);
            console.log(`
╭────────────────╼
╎ Your Pairing Code : ${code}
╰────────────────╼`);
        }, 3000);
    }

    mane.ev.on('creds.update', saveCreds);

    mane.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            if (m.key.fromMe) return;
            
            // Logika pesan sederhana (Handler)
            const from = m.key.remoteJid;
            const type = Object.keys(m.message)[0];
            const content = JSON.stringify(m.message);
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const prefix = /^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/)[0] : '';
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = q = args.join(" ");
            const quoted = m.quoted ? m.quoted : m;
            const mime = (quoted.msg || quoted).mimetype || '';
            
            const reply = (teks) => {
                mane.sendMessage(from, { text: teks }, { quoted: m });
            };

            const readmore = String.fromCharCode(8206).repeat(4001);

            // CASE MENU
            switch (command) {
                case 'menu': {
                    let menu = `✨ *RYYN BOTZ* ✨\n\n`
                    menu += `👤 *User:* @${from.split('@')[0]}\n`
                    menu += `🏷️ *Packname:* King ryyn botz\n\n`
                    menu += `*─── [ FITUR LIST ] ───*\n`
                    menu += `│ ◦ ${prefix}iqc\n`
                    menu += `│ ◦ ${prefix}brat\n`
                    menu += `│ ◦ ${prefix}tiktok\n`
                    menu += `│ ◦ ${prefix}wm\n`
                    menu += `│ ◦ ${prefix}suarateks\n`
                    menu += `│ ◦ ${prefix}web3zip\n`
                    menu += `│ ◦ ${prefix}readmore\n`
                    menu += `└──────────────\n`
                    mane.sendMessage(from, { text: menu, mentions: [from] }, { quoted: m });
                }
                break;

                case 'iqc': {
  if (!text) return reply('Mana Text Nya')
  if (text.length > 80) return m.reply('Max 80 Text')

  // Logika penentuan jam real-time (WIB)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000)); // UTC+7
  const h = String(wib.getHours()).padStart(2, "0");
  const min = String(wib.getMinutes()).padStart(2, "0");
  const jamRealTime = `${h}:${min}`;

  // Variabel pendukung
  const batre = '56'; // Sesuai permintaan Anda
  const apiUrl = `https://api-faa.my.id/faa/iqcv2?prompt=${encodeURIComponent(text)}&jam=${encodeURIComponent(jamRealTime)}&batre=${encodeURIComponent(batre)}`;

  reply("sabar ya sayang😘");

  mane.sendMessage(m.chat, {
    image: { url: apiUrl }
  }, { quoted: m })
}
break;

                case 'swm': case 'steal': case 'stickerwm': case 'take': case 'wm': {
  const getRandom = (ext) => {
            return `${Math.floor(Math.random() * 10000)}${ext}`
        }
	let ahuh = args.join(' ').split('|')
	let satu = ahuh[0] !== '' ? ahuh[0] : `yoy`
	let dua = typeof ahuh[1] !== 'undefined' ? ahuh[1] : ``
	let { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter')
	let media = await mane.downloadAndSaveMediaMessage(quoted)
	let jancok = new Sticker(media, {
	pack: satu, // The pack name
	author: dua, // The author name
	type: StickerTypes.FULL, // The sticker type
	categories: ['🤩', '🎉'], // The sticker category
	id: '12345', // The sticker id
	quality: 70, // The quality of the output file
	background: '#FFFFFF00' // The sticker background color (only for full stickers)
	})
	let stok = getRandom(".webp")
	let nono = await jancok.toFile(stok)
	let nah = fs.readFileSync(nono)
	await mane.sendMessage(from,{sticker: nah},{quoted: m})
	await fs.unlinkSync(stok)
	await fs.unlinkSync(media)
}
	break
	

                case "web3zip": {
                    if (!text) return reply(`Masukkan URL website.\n\nContoh: .${command} https://example.com`);
                    let url = text.startsWith("https://") ? text : `https://${text}`;
                    await reply("Sedang memproses...");
                    try {
                        const { data } = await axios.post("https://copier.saveweb2zip.com/api/copySite", { url }, {
                            headers: { "content-type": "application/json", origin: "https://saveweb2zip.com" }
                        });
                        // Polling sederhana
                        let downloadUrl = `https://copier.saveweb2zip.com/api/downloadArchive/${data.md5}`;
                        await mane.sendMessage(from, { document: { url: downloadUrl }, fileName: `web.zip`, mimetype: "application/zip" }, { quoted: m });
                    } catch (e) { reply("Gagal mengambil data website."); }
                }
                break;
case 'readmore':
case 'selengkapnya': {
if (!q) return reply(`masukan text contoh ${command} kamujelek|tapii boong`)
let [l, r] = text.split`|`
if (!l) l = ''
if (!r) r = ''
reply(l + readmore + r)
}
break
                
                case 'sbrat': {
                    if (!text) return reply('teksnya?')
                    const bratUrl = `https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}&background=%23ffffff&color=%23000000&emojiStyle=apple`
                    // Menggunakan buffer untuk mengirim sebagai sticker
                    const { sticker } = require('wa-sticker-formatter')
                    let pack = new sticker(bratUrl, { pack: "King ryyn botz", author: "Ryyn Botz", type: "full" })
                    mane.sendMessage(from, await pack.toBuffer(), { quoted: m })
                }
                break;

                case 'tiktok':
        case 'tt': {
            if (!args) return await mane.sendMessage(from, { text: '❌ Masukkan URL TikTok!\nContoh: .tiktok https://vt.tiktok.com/xxxx/' });
            
            await mane.sendMessage(from, { text: '⏳ Sedang memproses video, mohon tunggu...' });

            try {
                // 1. Panggil API v2 Anda
                const apiUrl = `https://fyxzpedia-apikey.vercel.app/download/tiktok-v2?apikey=Fyxz&url=${encodeURIComponent(args)}`;
                const response = await fetch(apiUrl);
                const json = await response.json();

                // 2. Validasi respon API
                if (!json.status || !json.result || !json.result.data) {
                    return await mane.sendMessage(from, { text: '❌ Gagal mengambil data. Pastikan link TikTok valid.' });
                }

                const res = json.result.data;
                
                // 3. Susun Caption Informasi
                let caption = `🎬 *TIKTOK DOWNLOADER*\n\n`;
                caption += `📝 *Judul:* ${res.title || 'Tidak ada judul'}\n`;
                caption += `👤 *Author:* ${res.author.nickname} (@${res.author.unique_id})\n`;
                caption += `⏱️ *Durasi:* ${res.duration} detik\n\n`;
                caption += `📊 *Statistik:*\n`;
                caption += `❤️ Like: ${res.digg_count.toLocaleString()}\n`;
                caption += `💬 Komentar: ${res.comment_count.toLocaleString()}\n`;
                caption += `🔁 Share: ${res.share_count.toLocaleString()}\n\n`;
                caption += `✨ *${config.bot.name}*`;

                // 4. Kirim Video (Menggunakan hdplay untuk kualitas terbaik tanpa watermark)
                await mane.sendMessage(from, { 
                    video: { url: res.hdplay || res.play }, 
                    caption: caption 
                }, { quoted: msg });

            } catch (error) {
                console.error('Tiktok Error:', error);
                await mane.sendMessage(from, { text: '❌ Terjadi kesalahan pada server API.' });
            }
            break;
        }
        case 'suarateks': {
            if (!args) return await mane.sendMessage(from, { text: '❌ Masukkan teks yang ingin diubah menjadi suara!\nContoh: *.suarateks Halo, ini audio eksternal*' });

            try {
                // 1. Ambil link audio dari API JSON
                const apiUrl = `https://fyxzpedia-apikey.vercel.app/tools/text-to-speech?apikey=Fyxz&text=${encodeURIComponent(args)}`;
                const response = await fetch(apiUrl);
                const json = await response.json();

                if (!json.status || !json.result || json.result.length === 0) {
                    return await mane.sendMessage(from, { text: '❌ Gagal menghasilkan suara.' });
                }

                const audioUrl = json.result[0].url;

                // 2. Download file audio (.wav) tersebut menjadi Buffer
                const audioRes = await fetch(audioUrl);
                const arrayBuffer = await audioRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                // 3. Kirim sebagai Audio Eksternal (ptt: false)
                await mane.sendMessage(from, { 
                    audio: buffer, 
                    mimetype: 'audio/mpeg', // Mime type standar audio
                    ptt: false, // Mengirim sebagai file audio biasa, bukan voice note
                    fileName: `suara_${Date.now()}.mp3` // Nama file agar terlihat rapi
                }, { quoted: msg });

            } catch (error) {
                console.error('TTS Error:', error);
                await mane.sendMessage(from, { text: '❌ Terjadi kesalahan saat memproses audio.' });
            }
            break;
        
            }
        } catch (err) {
            console.log(err);
        }
    });

    mane.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) Starts();
        } else if (connection === 'open') {
            console.log('Bot Berhasil Terhubung! ✅');
        }
    });

    return mane;
}

Starts();
