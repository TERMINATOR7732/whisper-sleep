// Notification Templates & Personalization Engine for Whisper Sleep / Nightly
// Contains 30 polished consumer-grade Hinglish templates per category:
//  - girl_checkin: Primary user morning/day check-in reminders
//  - girl_winddown: Primary user evening wind-down reminders
//  - girl_streak: Primary user streak preservation reminders
//  - partner_check_on_her: Partner gentle reminders to check on her day

export type NotificationCategory =
  | "girl_checkin"
  | "girl_winddown"
  | "girl_streak"
  | "partner_check_on_her";

export interface TemplateDefinition {
  template: string;
  fallback: string;
}

/**
 * Validates and sanitizes a user display name/nickname.
 * Returns null if name is empty, whitespace, an email, a UUID/user ID, or phone number.
 */
export function sanitizeDisplayName(name: string | null | undefined): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  // Never expose email addresses
  if (trimmed.includes("@")) return null;
  // Never expose UUIDs or long database IDs
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)) return null;
  if (/^[0-9a-fA-F]{24,}$/.test(trimmed)) return null;
  // Never expose phone numbers
  if (/^\+?[0-9\s\-()]{7,}$/.test(trimmed)) return null;
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GIRL — CHECK-IN NOTIFICATIONS (30 templates)
// ─────────────────────────────────────────────────────────────────────────────
export const GIRL_CHECKIN_TEMPLATES: TemplateDefinition[] = [
  { template: "Good morning {name} 🌤️ Raat kaisi gayi?", fallback: "Good morning 🌤️ Raat kaisi gayi?" },
  { template: "Uth gayi? 👀 Nightly ko bhi bata de.", fallback: "Uth gayi? 👀 Nightly ko bhi bata de." },
  { template: "Morning girlie ☀️ Sleep check-in?", fallback: "Morning girlie ☀️ Sleep check-in?" },
  { template: "{name}, aaj ki sleep ko kitne stars? ⭐", fallback: "Aaj ki sleep ko kitne stars? ⭐" },
  { template: "Be honest… kal raat kitni der soyi? 👀", fallback: "Be honest… kal raat kitni der soyi? 👀" },
  { template: "Good morning 💗 Sleep report pending hai.", fallback: "Good morning 💗 Sleep report pending hai." },
  { template: "Madam {name} uth gayi? 😂 Check-in kar do.", fallback: "Madam uth gayi? 😂 Check-in kar do." },
  { template: "Aaj energy kaisi hai? ✨", fallback: "Aaj energy kaisi hai? ✨" },
  { template: "Raat ka recap time 🌙 Kaisi thi sleep?", fallback: "Raat ka recap time 🌙 Kaisi thi sleep?" },
  { template: "Ek tiny check-in, {name}… phir apna din start 💕", fallback: "Ek tiny check-in… phir apna din start 💕" },
  { template: "Morninggg 🌸 Kal ki sleep log karni hai.", fallback: "Morninggg 🌸 Kal ki sleep log karni hai." },
  { template: "Sleep diary tumhara wait kar rahi hai 📝", fallback: "Sleep diary tumhara wait kar rahi hai 📝" },
  { template: "Aaj sleep aur mood ka match kaisa hai? 👀", fallback: "Aaj sleep aur mood ka match kaisa hai? 👀" },
  { template: "Bas 30 seconds chahiye, promise 🤞", fallback: "Bas 30 seconds chahiye, promise 🤞" },
  { template: "Good morning ✨ Kal raat ka update?", fallback: "Good morning ✨ Kal raat ka update?" },
  { template: "Uth gayi toh ek kaam aur… check-in 😌", fallback: "Uth gayi toh ek kaam aur… check-in 😌" },
  { template: "{name}, Nightly attendance laga do madam 🌙", fallback: "Nightly attendance laga do madam 🌙" },
  { template: "Kal raat ko yaad karke ek rating de do 👀", fallback: "Kal raat ko yaad karke ek rating de do 👀" },
  { template: "Sleep check-in? Then main-character day starts 💅", fallback: "Sleep check-in? Then main-character day starts 💅" },
  { template: "Morning {name}! 🌷 Sleep ke baad body kaisi feel kar rahi?", fallback: "Morning! 🌷 Sleep ke baad body kaisi feel kar rahi?" },
  { template: "Aaj ki raat ko little review de dein? 😌", fallback: "Aaj ki raat ko little review de dein? 😌" },
  { template: "No judgement zone — honestly log karna 💗", fallback: "No judgement zone — honestly log karna 💗" },
  { template: "Nightly ko sach sach batao… raat kaisi thi? 👀", fallback: "Nightly ko sach sach batao… raat kaisi thi? 👀" },
  { template: "Good morning 🌞 Sleep story ka next chapter?", fallback: "Good morning 🌞 Sleep story ka next chapter?" },
  { template: "Check-in kar lo babe — phir phone side mein 😭", fallback: "Check-in kar lo babe — phir phone side mein 😭" },
  { template: "Aaj ki sleep: slay ya struggle? 😂", fallback: "Aaj ki sleep: slay ya struggle? 😂" },
  { template: "Rise & shine ✨ Pehle sleep check-in.", fallback: "Rise & shine ✨ Pehle sleep check-in." },
  { template: "Your sleep report is waiting, girl 🌙", fallback: "Your sleep report is waiting, girl 🌙" },
  { template: "Morning {name}! Kal raat ko 1–5 mein kitna dogi? ⭐", fallback: "Morning! Kal raat ko 1–5 mein kitna dogi? ⭐" },
  { template: "Ek chhota check-in for future-you 💗", fallback: "Ek chhota check-in for future-you 💗" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. GIRL — WIND-DOWN NOTIFICATIONS (30 templates)
// ─────────────────────────────────────────────────────────────────────────────
export const GIRL_WINDDOWN_TEMPLATES: TemplateDefinition[] = [
  { template: "Girl, bas ab thoda slow down karte hain 🌙", fallback: "Girl, bas ab thoda slow down karte hain 🌙" },
  { template: "Aaj ka din khatam. Ab tumhari turn hai rest ki 💗", fallback: "Aaj ka din khatam. Ab tumhari turn hai rest ki 💗" },
  { template: "Phone ko bhi goodnight bolne ka time 📱🌙", fallback: "Phone ko bhi goodnight bolne ka time 📱🌙" },
  { template: "Bed calling… aur honestly, uski baat maan lo 😌", fallback: "Bed calling… aur honestly, uski baat maan lo 😌" },
  { template: "Okay girlie, sleep mode ON? ✨", fallback: "Okay girlie, sleep mode ON? ✨" },
  { template: "Kal ki tum ko aaj wali sleep chahiye 🫶", fallback: "Kal ki tum ko aaj wali sleep chahiye 🫶" },
  { template: "Bas 10 min aur… phir lights out? 👀", fallback: "Bas 10 min aur… phir lights out? 👀" },
  { template: "{name}, aaj overthinking ko bhi chhutti 🫶", fallback: "Aaj overthinking ko bhi chhutti 🫶" },
  { template: "No more scrolling madam 😭 Bedtime.", fallback: "No more scrolling madam 😭 Bedtime." },
  { template: "Your body has officially requested: REST 😴", fallback: "Your body has officially requested: REST 😴" },
  { template: "Aaj ka drama kal continue karenge 😂 Ab sleep.", fallback: "Aaj ka drama kal continue karenge 😂 Ab sleep." },
  { template: "Soft reminder: rest karne ki permission hai 💗", fallback: "Soft reminder: rest karne ki permission hai 💗" },
  { template: "Okay pretty girl, screen down. Sleep time 🌙", fallback: "Okay pretty girl, screen down. Sleep time 🌙" },
  { template: "Din done. Notifications done. Ab tum bhi done 😌", fallback: "Din done. Notifications done. Ab tum bhi done 😌" },
  { template: "Thoda paani, thoda calm, phir bed? 🌙", fallback: "Thoda paani, thoda calm, phir bed? 🌙" },
  { template: "Your pillow misses you btw 👀", fallback: "Your pillow misses you btw 👀" },
  { template: "Aaj thoda jaldi so jaayein? Future-you approves 💕", fallback: "Aaj thoda jaldi so jaayein? Future-you approves 💕" },
  { template: "Brain ko bol do: kal handle karenge 😭", fallback: "Brain ko bol do: kal handle karenge 😭" },
  { template: "Nightly says: enough scrolling for today 😌", fallback: "Nightly says: enough scrolling for today 😌" },
  { template: "Blanket + pillow + no overthinking. Deal? 🫶", fallback: "Blanket + pillow + no overthinking. Deal? 🫶" },
  { template: "{name}, your bedtime era starts now 🌙", fallback: "Your bedtime era starts now 🌙" },
  { template: "Aaj rest ko priority bana dein? 💗", fallback: "Aaj rest ko priority bana dein? 💗" },
  { template: "One last scroll is usually a lie 😭", fallback: "One last scroll is usually a lie 😭" },
  { template: "Goodnight routine loading… 💤", fallback: "Goodnight routine loading… 💤" },
  { template: "Ab duniya ko mute karne ka time 🌙", fallback: "Ab duniya ko mute karne ka time 🌙" },
  { template: "Tumne aaj enough kiya. Ab rest bhi kar lo 🫶", fallback: "Tumne aaj enough kiya. Ab rest bhi kar lo 🫶" },
  { template: "Sleepy girl hours 🌙✨", fallback: "Sleepy girl hours 🌙✨" },
  { template: "Enough productivity. Ab cozy ho jao 😌", fallback: "Enough productivity. Ab cozy ho jao 😌" },
  { template: "Lights low, phone away, brain slow 🌙", fallback: "Lights low, phone away, brain slow 🌙" },
  { template: "Goodnight girlie 💗 Kal milte hain.", fallback: "Goodnight girlie 💗 Kal milte hain." },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. GIRL — STREAK NOTIFICATIONS (30 templates)
// ─────────────────────────────────────────────────────────────────────────────
export const GIRL_STREAK_TEMPLATES: TemplateDefinition[] = [
  { template: "Girl, streak ko aaj bhi alive rakhna hai 🔥", fallback: "Girl, streak ko aaj bhi alive rakhna hai 🔥" },
  { template: "Your sleep streak is waiting 👀", fallback: "Your sleep streak is waiting 👀" },
  { template: "Ek tiny check-in aur streak safe 😌", fallback: "Ek tiny check-in aur streak safe 😌" },
  { template: "Madam, streak todna allowed nahi 😂", fallback: "Madam, streak todna allowed nahi 😂" },
  { template: "Kal tak ka rhythm cute tha. Aaj bhi? 🔥", fallback: "Kal tak ka rhythm cute tha. Aaj bhi? 🔥" },
  { template: "Your streak said: don’t forget me 🥹", fallback: "Your streak said: don’t forget me 🥹" },
  { template: "Aaj ka check-in pending hai, girlie 🌙", fallback: "Aaj ka check-in pending hai, girlie 🌙" },
  { template: "Streak check 👀 Still going strong?", fallback: "Streak check 👀 Still going strong?" },
  { template: "Ek tap. Ek check-in. Streak continues 🔥", fallback: "Ek tap. Ek check-in. Streak continues 🔥" },
  { template: "Girl, we've come too far to break it 😭", fallback: "Girl, we've come too far to break it 😭" },
  { template: "Nightly attendance please 💅🔥", fallback: "Nightly attendance please 💅🔥" },
  { template: "Your streak wants attention 😂", fallback: "Your streak wants attention 😂" },
  { template: "Don’t ghost your sleep streak 👀", fallback: "Don’t ghost your sleep streak 👀" },
  { template: "Aaj bhi consistency queen banogi? 👑", fallback: "Aaj bhi consistency queen banogi? 👑" },
  { template: "🔥 Streak ko thoda pyaar de do.", fallback: "🔥 Streak ko thoda pyaar de do." },
  { template: "Just checking… streak abhi safe hai na? 😌", fallback: "Just checking… streak abhi safe hai na? 😌" },
  { template: "One little check-in for the streak 💗", fallback: "One little check-in for the streak 💗" },
  { template: "Aaj ka sleep chapter log karna baaki hai 📖🌙", fallback: "Aaj ka sleep chapter log karna baaki hai 📖🌙" },
  { template: "Streak ko aaj tumhari zarurat hai 🫶", fallback: "Streak ko aaj tumhari zarurat hai 🫶" },
  { template: "Consistency > perfection. Check-in kar lo 🌷", fallback: "Consistency > perfection. Check-in kar lo 🌷" },
  { template: "Future-you will appreciate this streak 🔥", fallback: "Future-you will appreciate this streak 🔥" },
  { template: "Kal ka streak aaj continue karna hai 👀", fallback: "Kal ka streak aaj continue karna hai 👀" },
  { template: "Your little sleep streak is still going ✨", fallback: "Your little sleep streak is still going ✨" },
  { template: "Break mat karo, bas check-in kar do 😭", fallback: "Break mat karo, bas check-in kar do 😭" },
  { template: "Streak maintained? Let’s keep it going 🔥", fallback: "Streak maintained? Let’s keep it going 🔥" },
  { template: "Sleep queen behavior: check-in complete 👑", fallback: "Sleep queen behavior: check-in complete 👑" },
  { template: "Aaj bhi present? 🌙🔥", fallback: "Aaj bhi present? 🌙🔥" },
  { template: "Your streak is knocking… open karogi? 😂", fallback: "Your streak is knocking… open karogi? 😂" },
  { template: "One more day, one more check-in 💗", fallback: "One more day, one more check-in 💗" },
  { template: "Okay {name}, let’s keep that streak alive ✨", fallback: "Okay, let’s keep that streak alive ✨" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. GUY / PARTNER — CHECK ON HER / HER DAY (30 templates)
// ─────────────────────────────────────────────────────────────────────────────
export const PARTNER_CHECK_TEMPLATES: TemplateDefinition[] = [
  { template: "{name} ka aaj ka scene? 👀", fallback: "Aaj ka scene? 👀" },
  { template: "{name} ka update aa gaya 💙", fallback: "Aaj ka update aa gaya 💙" },
  { template: "Aaj {name} kaisi rahi? 🌙", fallback: "Aaj ka din kaisa raha? 🌙" },
  { template: "{name} ne aaj check-in kiya 👀", fallback: "Aaj check-in aa gaya 👀" },
  { template: "{name} ka day kaisa tha? 💙", fallback: "Aaj ka day kaisa tha? 💙" },
  { template: "{name} ne kuch share kiya hai 👀", fallback: "Kuch share hua hai 👀" },
  { template: "{name} ka little update ready hai 🌙", fallback: "Ek little update ready hai 🌙" },
  { template: "Aaj {name} ka kya scene tha? 😌", fallback: "Aaj kya scene tha? 😌" },
  { template: "{name} ka day recap? 👀", fallback: "Aaj ka day recap? 👀" },
  { template: "{name} ka update dekhoge? 💙", fallback: "Aaj ka update dekhoge? 💙" },
  { template: "Aaj {name} ka mood kaisa tha? 🌷", fallback: "Aaj mood kaisa tha? 🌷" },
  { template: "{name} ka Nightly update aa gaya ✨", fallback: "Nightly update aa gaya ✨" },
  { template: "{name} ne aaj ka day log kar diya 👀", fallback: "Aaj ka day log ho gaya 👀" },
  { template: "{name} ka aaj ka update — ready hai 💙", fallback: "Aaj ka update — ready hai 💙" },
  { template: "Aaj {name} ka haal dekh lo 🌙", fallback: "Aaj ka haal dekh lo 🌙" },
  { template: "{name} ne Nightly pe kuch chhoda hai 👀", fallback: "Nightly pe kuch update aaya hai 👀" },
  { template: "{name} ka aaj ka chapter? 📖", fallback: "Aaj ka chapter? 📖" },
  { template: "Aaj {name} ka din kaisa gaya? 💙", fallback: "Aaj din kaisa gaya? 💙" },
  { template: "{name} ka little check-in aa gaya 🌙", fallback: "Little check-in aa gaya 🌙" },
  { template: "{name} ka update miss toh nahi kiya? 👀", fallback: "Update miss toh nahi kiya? 👀" },
  { template: "Aaj {name} ne kya scene bataya? 😌", fallback: "Aaj kya scene bataya? 😌" },
  { template: "{name} ka day update ready hai 💙", fallback: "Day update ready hai 💙" },
  { template: "Ek quick peek at {name}’s day? 👀", fallback: "Ek quick peek at her day? 👀" },
  { template: "{name} ka aaj ka recap dekh lo 🌙", fallback: "Aaj ka recap dekh lo 🌙" },
  { template: "{name} ne aaj Nightly ko update kiya ✨", fallback: "Nightly pe naya update aaya ✨" },
  { template: "Aaj {name} kaisi feel kar rahi thi? 💙", fallback: "Aaj kaisa feel ho raha tha? 💙" },
  { template: "{name} ka update tumhara wait kar raha hai 👀", fallback: "Update tumhara wait kar raha hai 👀" },
  { template: "Before goodnight… {name} ka update? 🌙", fallback: "Before goodnight… uska update? 🌙" },
  { template: "{name} ka aaj ka scene dekhoge? 😌", fallback: "Aaj ka scene dekhoge? 😌" },
  { template: "Aaj ka {name} update 💙 Tap to see.", fallback: "Aaj ka update 💙 Tap to see." },
];

export const TEMPLATE_SETS: Record<NotificationCategory, TemplateDefinition[]> = {
  girl_checkin: GIRL_CHECKIN_TEMPLATES,
  girl_winddown: GIRL_WINDDOWN_TEMPLATES,
  girl_streak: GIRL_STREAK_TEMPLATES,
  partner_check_on_her: PARTNER_CHECK_TEMPLATES,
};

/**
 * Returns a simple string hash code.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Selects an index from the 30 templates in the given category,
 * avoiding templates that were recently used.
 */
export function selectTemplateIndex(
  category: NotificationCategory,
  recentIndexes: number[] = [],
  seed = 0
): number {
  const templates = TEMPLATE_SETS[category];
  const total = templates.length;
  const recentSet = new Set(recentIndexes);

  // Available candidate indexes not in the recent history
  let available = Array.from({ length: total }, (_, i) => i).filter((i) => !recentSet.has(i));
  if (available.length === 0) {
    // If all 30 have been exhausted, cycle back through all of them
    available = Array.from({ length: total }, (_, i) => i);
  }

  return available[Math.abs(seed) % available.length];
}

/**
 * Formats a chosen template with the user's display name or nickname.
 * If the name is unavailable, safely renders the grammatically correct fallback.
 */
export function formatNotificationBody(
  category: NotificationCategory,
  index: number,
  rawName: string | null | undefined
): string {
  const templates = TEMPLATE_SETS[category];
  const safeIndex = ((index % templates.length) + templates.length) % templates.length;
  const entry = templates[safeIndex];

  const cleanName = sanitizeDisplayName(rawName);
  if (cleanName && entry.template.includes("{name}")) {
    return entry.template.replaceAll("{name}", cleanName);
  }
  return entry.fallback;
}
