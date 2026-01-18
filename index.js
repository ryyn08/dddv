const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    getContentType,
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");
const { Sticker, createSticker, StickerTypes } = require('wa-sticker-formatter');

const phoneNumber = "6283119396819";
const usePairingCode = true;
const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

async function Starts() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const Cantarella = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    if (usePairingCode && !Cantarella.authState.creds.registered) {
        setTimeout(async () => {
            let code = await Cantarella.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`
╭────────────────╼
╎ Your Pairing Code : ${code}
╰────────────────╼`);
        }, 3000);
    }

    Cantarella.ev.on("creds.update", saveCreds);
    Cantarella.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) Starts();
        } else if (connection === "open") {
            console.log("Bot Berhasil Terhubung!");
        }
    });

    // Helper untuk Stiker
    Cantarella.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^https?:\/\//.test(path) ? await (await axios.get(path, { responseType: 'arraybuffer' })).data : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
        let sticker = new Sticker(buff, {
            pack: options.packname || "King ryyn botz",
            author: "RyynBotz",
            type: StickerTypes.FULL,
            categories: ['🤩', '🎉'],
            id: '12345',
            quality: 70,
            ...options
        });
        const buffer = await sticker.toBuffer();
        return Cantarella.sendMessage(jid, { sticker: buffer }, { quoted });
    };

    Cantarella.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            const type = getContentType(m.message);
            const from = m.key.remoteJid;
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const prefix = ".";
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = q = args.join(" ");
            const isGroup = from.endsWith('@g.us');
            const sender = m.key.participant || from;
            const pushname = m.pushName || "User";
            const mane = Cantarella; // Alias agar sesuai logika fitur anda

            const reply = (teks) => {
                Cantarella.sendMessage(from, { text: teks }, { quoted: m });
            };

            const readmore = String.fromCharCode(8206).repeat(4001);

            // Logika Fitur
            switch (command) {
                case 'menu':
                case 'help': {
                    let menu = `*Hi ${pushname}! Selamat datang di Ryyn Botz* 👑\n\n`
                    menu += `┌─〔 *DOWNLOADER* 〕\n`
                    menu += `├ ${prefix}cuhh (TikTok)\n`
                    menu += `├ ${prefix}web3zip\n`
                    menu += `└────────────\n\n`
                    menu += `┌─〔 *MAKER* 〕\n`
                    menu += `├ ${prefix}iqc (Quotes)\n`
                    menu += `├ ${prefix}sbrat (Brat Sticker)\n`
                    menu += `├ ${prefix}wm (Sticker WM)\n`
                    menu += `└────────────\n\n`
                    menu += `┌─〔 *TOOLS* 〕\n`
                    menu += `├ ${prefix}readmore\n`
                    menu += `└────────────\n\n`
                    menu += `*Packname:* King ryyn botz`
                    reply(menu)
                }
                break

                case 'iqc': {
                    if (!text) return reply('Mana Text Nya')
                    if (text.length > 80) return m.reply('Max 80 Text')
                    const now = new Date();
                    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                    const wib = new Date(utc + (7 * 3600000));
                    const h = String(wib.getHours()).padStart(2, "0");
                    const min = String(wib.getMinutes()).padStart(2, "0");
                    const jamRealTime = `${h}:${min}`;
                    const batre = '56';
                    const apiUrl = `https://api-faa.my.id/faa/iqcv2?prompt=${encodeURIComponent(text)}&jam=${encodeURIComponent(jamRealTime)}&batre=${encodeURIComponent(batre)}`;
                    reply("sabar ya sayang😘");
                    mane.sendMessage(from, { image: { url: apiUrl } }, { quoted: m })
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
                break;

                case "web3zip": {
                    if (!text) return reply(`Masukkan URL website.\n\nContoh: .${command} https://example.com`);
                    let url = text.startsWith("https://") ? text : `https://${text}`;
                    reply("Sedang memproses...");
                    try {
                        const { data } = await axios.post("https://copier.saveweb2zip.com/api/copySite", { url, renameAssets: true }, {
                            headers: { "content-type": "application/json", origin: "https://saveweb2zip.com" }
                        });
                        let isFinished = false;
                        while (!isFinished) {
                            const { data: status } = await axios.get(`https://copier.saveweb2zip.com/api/getStatus/${data.md5}`);
                            if (status.isFinished) {
                                await mane.sendMessage(from, {
                                    document: { url: `https://copier.saveweb2zip.com/api/downloadArchive/${status.md5}` },
                                    fileName: `${url.replace(/https?:\/\//, "").split("/")[0]}.zip`,
                                    mimetype: "application/zip"
                                }, { quoted: m });
                                isFinished = true;
                            } else {
                                await new Promise(r => setTimeout(r, 2000));
                            }
                        }
                    } catch (e) { reply(`❌ Gagal: ${e.message}`); }
                }
                break;

                case 'sbrat': {
                    if (!text) return reply('teksnya mana?')
                    const brat = `https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}&background=%23ffffff&color=%23000000&emojiStyle=apple`
                    await mane.sendImageAsSticker(from, brat, m, { packname: "King ryyn botz" })
                }
                break;

                case "cuhh":
                case "hkm": {
                    const repliedMessageText = (m.quoted && m.quoted.text) ? m.quoted.text : '';
                    let linkText = text ? text : repliedMessageText;
                    if (!linkText.includes("tiktok.com")) return reply("Link TikTok tidak valid!");
                    await mane.sendMessage(from, { react: { text: '🔄', key: m.key } });
                    try {
                        let { data } = await axios.get(`https://api-faa.my.id/faa/tiktok?url=${encodeURIComponent(linkText)}`);
                        let res = data.result;
                        const textr = `*TIKTOK DOWNLOADER*\n\n🎬 *Judul*: ${res.title || "-"}\n👤 *Author*: ${res.author?.fullname || "-"}`;
                        
                        if (res.type === "video") {
                            await mane.sendMessage(from, { video: { url: res.data }, caption: textr }, { quoted: m });
                        } else if (res.type === "image") {
                            for (let img of res.data) {
                                await mane.sendMessage(from, { image: { url: img } }, { quoted: m });
                            }
                        }
                    } catch (err) { reply("Gagal mengambil data."); }
                }
                break;

                case 'wm':
                case 'swm': {
                    const mime = (m.message.imageMessage || m.message.videoMessage || m.quoted?.imageMessage || m.quoted?.videoMessage) ? 'media' : '';
                    if (!mime) return reply("Kirim/Balas media!");
                    reply("Proses...");
                    // Logika download media sederhana
                    const quoted = m.quoted ? m.quoted : m;
                    const stream = await downloadContentFromMessage(quoted[type] || quoted, type.replace('Message',''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                    await mane.sendImageAsSticker(from, buffer, m, { packname: text || "King ryyn botz" });
                }
                break;
            }
        } catch (err) {
            console.log(err);
        }
    });

    store.bind(Cantarella.ev);
}

Starts();
