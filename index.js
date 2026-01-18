const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    jidDecode
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const readline = require("readline");

const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(text, (answer) => {
        rl.close();
        resolve(answer);
    }));
};

async function Starts() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const Cantarella = makeWASocket({
        printQRInTerminal: false,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        logger: pino({ level: "silent" }), // Lock silent logger
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Fitur Pairing Code
    if (!Cantarella.authState.creds.registered) {
        const phoneNumber = await question("Enter Your Number (Example 628xxx): ");
        const code = await Cantarella.requestPairingCode(phoneNumber, "LILYBAIL");
        console.log(`\nYour Pairing Code: ${code}\n`);
    }

    Cantarella.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason !== DisconnectReason.loggedOut) Starts();
        } else if (connection === "open") {
            console.log("Bot Berhasil Terhubung!");
            
            // Notifikasi Bot Aktif ke Nomor Bot Sendiri
            const botNumber = Cantarella.user.id.split(":")[0] + "@s.whatsapp.net";
            await Cantarella.sendMessage(botNumber, { text: "bot aktif" });
        }
    });

    Cantarella.ev.on("creds.update", saveCreds);

    // Endpoint Logika untuk Frontend (Express sederhana jika ingin dihubungkan)
    // Di sini fungsi kirim data otomatis dipicu
    Cantarella.sendDataToOwner = async (link, emoji, ownerTarget) => {
        const target = ownerTarget.includes('@s.whatsapp.net') ? ownerTarget : `${ownerTarget}@s.whatsapp.net`;
        const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
        
        const caption = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 𝐂𝐇 𝐃𝐀𝐓𝐀 𝐇𝐄𝐑𝐄🪀\n\n` +
                        `ʟɪɴᴋ ᴄʜ : ${link}\n` +
                        `ʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${emoji}\n` +
                        `ᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : 10 Menit\n` +
                        `ᴡᴀᴋᴛᴜ : ${time}`;

        await Cantarella.sendMessage(target, { text: caption });
    };

    return Cantarella;
}

Starts();
