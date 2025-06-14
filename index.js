const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// 🎯 إعدادات
const DONE_ROOM_ID = '1375259575313240205';
const FEEDBACK_CHANNEL_ID = '1383360523848126514';
const FEEDBACK_FILE = './feedback.tax';

const sessions = new Map();

client.once('ready', () => {
  console.log(`✅ البوت جاهز: ${client.user.tag}`);
});

// 📌 إذا دخل العضو روم DONE
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.channelId === DONE_ROOM_ID && oldState.channelId !== DONE_ROOM_ID) {
    const member = newState.member;

    try {
      await member.send(`
📊 **تقييم الإداري**

أرسل رقم من 1 إلى 5 لتقييم الجلسة.
بعدها مباشرة، أرسل ملاحظاتك إن وجدت.

📝 مثال:
5
الدعم كان ممتاز وسريع.

_شكراً لمشاركتك!_
      `);

      sessions.set(member.id, { step: 'awaiting_rating' });
    } catch (err) {
      console.log(`❌ فشل إرسال الرسالة لـ ${member.user.tag}`);
    }
  }
});

// 💬 استقبال التقييم من الرسائل الخاصة
client.on('messageCreate', async (message) => {
  if (!message.guild && !message.author.bot) {
    const session = sessions.get(message.author.id);
    if (!session) return;

    if (session.step === 'awaiting_rating') {
      const rating = parseInt(message.content.trim());
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return message.channel.send("❌ الرجاء إرسال رقم بين 1 و 5 فقط.");
      }

      session.rating = rating;
      session.step = 'awaiting_notes';
      return message.channel.send("✅ تم تسجيل التقييم.\nالآن، أرسل ملاحظاتك (اختياري).");
    }

    if (session.step === 'awaiting_notes') {
      const notes = message.content.trim();

      const feedback = {
        user_id: message.author.id,
        rating: session.rating,
        notes: notes,
        timestamp: new Date().toISOString()
      };

      // 🗃️ حفظ التقييم في ملف .tax (JSON بصيغة مختلفة)
      let data = [];
      if (fs.existsSync(FEEDBACK_FILE)) {
        const raw = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
        data = JSON.parse(raw || '[]');
      }
      data.push(feedback);
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2));

      // 📤 إرسال التقييم إلى روم في السيرفر
      const feedbackChannel = await client.channels.fetch(FEEDBACK_CHANNEL_ID);
      if (feedbackChannel && feedbackChannel.isTextBased()) {
        feedbackChannel.send({
          content: `
📩 **تقييم جديد**

👤 من: <@${message.author.id}>
⭐ التقييم: ${session.rating}
🗒️ الملاحظات: ${notes || "لا توجد ملاحظات"}
🕒 الوقت: <t:${Math.floor(Date.now() / 1000)}:f>
          `
        });
      }

      await message.channel.send("💾 تم حفظ تقييمك بنجاح. شكرًا لك!");
      sessions.delete(message.author.id);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
