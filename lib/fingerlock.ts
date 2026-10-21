// FingerLock 是本站作者的 Windows 工具，不是 ai_tools 資料庫裡的 AI 產品。
// 文案集中在這裡，中英文頁面與首頁入口共用。下載尚未公開。
import type { Locale } from "./i18n";

export const FL_PATH = "/tools/fingerlock";

export const FL_SHOTS = {
  warning: { src: "/fingerlock/setup-warning.png", w: 800, h: 700 },
  form: { src: "/fingerlock/setup-form.png", w: 800, h: 1192 },
  unlock: { src: "/fingerlock/unlock.png", w: 800, h: 700 },
  folders: { src: "/fingerlock/lock-folders.png", w: 800, h: 700 },
} as const;

export type FlStep = {
  title: string;
  text: string;
  image: { src: string; w: number; h: number } | null;
  imageAlt: string;
  /** 0–1，長截圖在步驟框裡先捲到這個位置 */
  scroll?: number;
};

export type FlCopy = {
  promoLead: string;
  promoCta: string;
  promoAria: string;
  metaTitle: string;
  metaDesc: string;
  title: string;
  lede: string;
  badges: string[];
  comingSoon: string;
  fileMeta: string;
  smartScreen: string;
  featuresTitle: string;
  features: string[];
  quickTitle: string;
  stepperLabel: string;
  stepperRole: string;
  stepProgress: (n: number, total: number) => string;
  stepDot: (n: number, title: string) => string;
  prev: string;
  next: string;
  stepsGroup: string;
  steps: FlStep[];
  manualsTitle: string;
  manualsLead: string;
  manualZh: string;
  manualEn: string;
  disclaimerTitle: string;
  disclaimer: string[];
};

const zh: FlCopy = {
  promoLead: "🔒 FingerLock 資料夾鎖 · 即將推出",
  promoCta: "了解",
  promoAria: "開啟 FingerLock 介紹頁面",
  metaTitle: "FingerLock 免費 Windows 資料夾鎖",
  metaDesc: "FingerLock 是免費的 Windows 資料夾鎖。用 10 題自訂安全問題（每次隨機 5 題）解鎖，可加手機指紋，並支援忘記答案寄信重設與閒置自動上鎖。",
  title: "FingerLock",
  lede: "免費的 Windows 資料夾鎖。自己設定 10 題安全問題，每次解鎖隨機問其中 5 題；也可以再加上手機指紋。忘記答案可寄信重設，閒置一段時間會自動上鎖。安裝檔是 FingerLock.exe。",
  badges: ["Windows", "免費"],
  comingSoon: "即將推出",
  fileMeta: "約 31 MB · 版本 v1.0.0",
  smartScreen: "這個程式還沒有數位簽章，Windows 可能跳出藍底警告。按「其他資訊」→「仍要執行」就能開啟。",
  featuresTitle: "功能",
  features: [
    "自己出 10 題安全問題。每次解鎖隨機抽 5 題、順序也隨機，5 題都要答對。",
    "也可以加上手機指紋，多一道確認。",
    "忘記答案或遺失手機時，可寄重設信到當初填的 Email。",
    "閒置會自動上鎖，也可以按「立即上鎖」。",
    "選取的資料夾會被鎖住，要解鎖才能再使用。",
    "免費提供，下載檔為 FingerLock.exe。",
  ],
  quickTitle: "快速開始",
  stepperLabel: "FingerLock 快速開始",
  stepperRole: "步驟導覽",
  stepProgress: (n, total) => `第 ${n} 步，共 ${total} 步`,
  stepDot: (n, title) => `第 ${n} 步：${title}`,
  prev: "上一步",
  next: "下一步",
  stepsGroup: "步驟",
  steps: [
    {
      title: "下載即將推出",
      text: "FingerLock.exe 與說明書即將推出，現在還不能下載。開放之後，再從這一頁取得檔案，然後雙擊開啟。",
      image: null,
      imageAlt: "",
    },
    {
      title: "雙擊開啟",
      text: "雙擊 FingerLock.exe。若出現藍色警告，按「其他資訊」→「仍要執行」。瀏覽器會打開設定頁。請留著同時出現的黑色視窗，關掉它程式就會停。",
      image: FL_SHOTS.warning,
      imageAlt: "FingerLock 第一次設定頁，上方是警告聲明，下方的確認框還沒有勾選。",
    },
    {
      title: "閱讀警告並勾選",
      text: "先把警告讀完，再勾選「我已閱讀並了解以上警告」。沒勾選的話，後面的設定不會出現。",
      image: FL_SHOTS.warning,
      imageAlt: "警告聲明與「我已閱讀並了解以上警告」核取方塊。",
    },
    {
      title: "選擇解鎖模式",
      text: "「只用提示問題」：回答隨機 5 題就能解鎖。「問題 + 手機指紋」：兩道都要通過，較安全。選指紋之前要先用手機配對。",
      image: FL_SHOTS.form,
      imageAlt: "解鎖模式的兩個選項：只用提示問題，或問題加上手機指紋。",
      scroll: 0.32,
    },
    {
      title: "填寫 10 題答案",
      text: "寫下 10 題只有你知道的答案。不要用生日、電話、寵物名、學校這類容易被猜到的資料。答案不分大小寫，前後空白不算。之後還能改預設問題。",
      image: FL_SHOTS.form,
      imageAlt: "十個提示問題與必填答案欄，以及重設用的 Email。",
      scroll: 0.55,
    },
    {
      title: "解鎖時回答隨機 5 題",
      text: "每次從 10 題裡隨機抽 5 題，順序也隨機，都要答對。可以換一組題目。忘記答案或遺失手機，可寄重設信到 Email。",
      image: FL_SHOTS.unlock,
      imageAlt: "解鎖畫面隨機列出 5 題，下方有解鎖與換一組題目。",
    },
    {
      title: "選擇資料夾並上鎖",
      text: "按「選擇資料夾」，點選要鎖的資料夾（可加多個），再按「鎖住所選資料夾」。已鎖住的資料夾要使用時，按該列的「解鎖」。",
      image: FL_SHOTS.folders,
      imageAlt: "主畫面列出準備上鎖的資料夾與已鎖住的資料夾，可移除或解鎖。",
    },
  ],
  manualsTitle: "使用說明書",
  manualsLead: "中英文說明書即將推出，步驟會比這一頁更完整。",
  manualZh: "中文說明書（PDF）",
  manualEn: "英文說明書（PDF）",
  disclaimerTitle: "重要警告與免責聲明",
  disclaimer: [
    "沒有任何安全工具是 100% 安全的（防不勝防）。本軟體只能降低風險。",
    "請保護好提示問題的答案與密碼：不要和別人分享，也不要在其他網站重複使用。",
    "不要用容易被猜到或查到的個人資料（生日、電話、寵物名、學校等）當答案。",
    "Email 請開啟兩步驟驗證（2FA）。誰能控制你的 Email，誰就能重設 FingerLock。",
    "保持 Windows 更新，並開啟防毒軟體（Windows Defender 即可）。",
    "小心釣魚重設信。重設連結只會在你自己按「忘記答案」之後寄出，而且網址必須是你自己的 FingerLock 網址。沒有按卻收到信，不要點。",
    "定期備份 data 資料夾。這個資料夾遺失就無法解鎖檔案。",
    "本軟體依現狀免費提供，沒有任何保證，也不提供保固。使用造成的任何資料遺失或損害，作者不負任何責任。",
  ],
};

const en: FlCopy = {
  promoLead: "🔒 FingerLock folder lock · Coming soon",
  promoCta: "Learn",
  promoAria: "Open the FingerLock page",
  metaTitle: "FingerLock, a free Windows folder lock",
  metaDesc: "FingerLock is a free Windows folder lock. Unlock with 10 security questions you write (5 random ones each time), optionally plus a phone fingerprint, with email reset and idle auto-lock.",
  title: "FingerLock",
  lede: "A free Windows folder lock. You write 10 security questions; each unlock asks 5 of them at random. You can also add a phone fingerprint. If you forget the answers, a reset email can be sent, and it locks again after idle time. The download is FingerLock.exe.",
  badges: ["Windows", "Free"],
  comingSoon: "Coming soon",
  fileMeta: "About 31 MB · version v1.0.0",
  smartScreen: "This program is not digitally signed, so Windows may show a blue warning. Choose More info → Run anyway to open it.",
  featuresTitle: "Features",
  features: [
    "You write 10 security questions. Each unlock asks a random 5, in random order, and all five must be correct.",
    "You can also add a phone fingerprint as an extra check.",
    "If you forget the answers or lose the phone, a reset email can be sent to the address you saved.",
    "Auto-lock after idle time, and a Lock now button.",
    "Chosen folders stay locked until you unlock them.",
    "Free. Distributed as FingerLock.exe.",
  ],
  quickTitle: "Quick start",
  stepperLabel: "FingerLock quick start",
  stepperRole: "stepper",
  stepProgress: (n, total) => `Step ${n} of ${total}`,
  stepDot: (n, title) => `Step ${n}: ${title}`,
  prev: "Back",
  next: "Next",
  stepsGroup: "Steps",
  steps: [
    {
      title: "Download coming soon",
      text: "FingerLock.exe and the manuals are coming soon, so there is nothing to download yet. When they are ready, get the file from this page, then double-click it.",
      image: null,
      imageAlt: "",
    },
    {
      title: "Double-click to open",
      text: "Double-click FingerLock.exe. If a blue warning appears, choose More info → Run anyway. Your browser opens the setup page. Leave the black window open; closing it stops the program.",
      image: FL_SHOTS.warning,
      imageAlt: "FingerLock first-run setup page, with the warning and the confirmation box still unchecked.",
    },
    {
      title: "Read the warning and tick the box",
      text: "Read the warning, then tick “I have read and understand the warning above.” The rest of setup stays hidden until you do.",
      image: FL_SHOTS.warning,
      imageAlt: "The warning and the checkbox for confirming you have read it.",
    },
    {
      title: "Choose a mode",
      text: "Questions only: answer 5 random questions to unlock. Questions plus phone fingerprint: both must pass, which is safer. Pair the phone before you pick the fingerprint mode.",
      image: FL_SHOTS.form,
      imageAlt: "Two unlock modes: security questions only, or questions plus a phone fingerprint.",
      scroll: 0.32,
    },
    {
      title: "Answer all 10 questions",
      text: "Write 10 answers only you would know. Skip birthdays, phone numbers, pet names, and schools. Answers ignore case and surrounding spaces. You can edit the preset questions later.",
      image: FL_SHOTS.form,
      imageAlt: "Ten security questions with required answer fields, and the reset email address.",
      scroll: 0.55,
    },
    {
      title: "Unlock with 5 random questions",
      text: "Each time, 5 of the 10 questions are picked at random, in a random order, and all must be correct. You can draw another set. If you forget the answers or lose the phone, send a reset email.",
      image: FL_SHOTS.unlock,
      imageAlt: "Unlock screen with 5 random questions, plus Unlock and another set of questions.",
    },
    {
      title: "Pick folders and lock them",
      text: "Choose folders, select the ones to lock (you can add more than one), then lock them. To use a locked folder again, press Unlock on that row.",
      image: FL_SHOTS.folders,
      imageAlt: "Main screen listing folders to lock and folders already locked, with remove and unlock actions.",
    },
  ],
  manualsTitle: "Manuals",
  manualsLead: "The Chinese and English manuals are coming soon, with fuller steps than this page.",
  manualZh: "Traditional Chinese manual (PDF)",
  manualEn: "English manual (PDF)",
  disclaimerTitle: "Warning and disclaimer",
  disclaimer: [
    "No security tool is 100% safe. This software can only reduce risk.",
    "Protect your answers and passwords. Do not share them, and do not reuse them on other sites.",
    "Do not use guessable or easy-to-look-up personal details (birthday, phone number, pet name, school, and similar) as answers.",
    "Turn on two-factor authentication (2FA) for your email. Whoever controls that inbox can reset FingerLock.",
    "Keep Windows updated and leave antivirus on (Windows Defender is enough).",
    "Beware of phishing reset emails. A reset link is sent only after you press Forgot answers, and it must point at your own FingerLock address. If you did not ask for it, do not open it.",
    "Back up the data folder. Without that folder, locked files cannot be unlocked.",
    "Provided free as-is, with no warranty. The author accepts no liability for any data loss or damage from using it.",
  ],
};

export const FL: Record<Locale, FlCopy> = { zh, en };
