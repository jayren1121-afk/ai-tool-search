// FingerLock 是本站作者的 Windows 工具，不是 ai_tools 資料庫裡的 AI 產品。
// 文案與連結集中在這裡，中英文頁面與首頁入口共用。
import type { Locale } from "./i18n";

export const FL_PATH = "/tools/fingerlock";

export const FL_LINKS = {
  release: "https://github.com/jayren1121-afk/fingerlock-download/releases/latest",
  exe: "https://github.com/jayren1121-afk/fingerlock-download/releases/latest/download/FingerLock.exe",
  manualZh: "https://github.com/jayren1121-afk/fingerlock-download/releases/latest/download/FingerLock_Manual_ZH-TW.pdf",
  manualEn: "https://github.com/jayren1121-afk/fingerlock-download/releases/latest/download/FingerLock_Manual_EN.pdf",
  sha256: "https://github.com/jayren1121-afk/fingerlock-download/releases/latest/download/SHA256SUMS.txt",
} as const;

export const FL_VERSION = "v1.2.0";
export const FL_SIZE = "31 MB";
/** v1.2.0 FingerLock.exe 的 SHA-256，與該版 SHA256SUMS.txt 相同 */
export const FL_SHA256 = "4f27a8b86f76a9854d887ce55b02b3d3709b159b84053cd4fb5fced9fd0f1b8a";
export const FL_VERIFY_CMD = "certutil -hashfile FingerLock.exe SHA256";
export const FL_CD_CMD = "cd %USERPROFILE%\\Downloads";

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
  downloadExe: string;
  fileMeta: string;
  manualShortZh: string;
  manualShortEn: string;
  releaseLink: string;
  smartScreen: string;
  featuresTitle: string;
  features: string[];
  verifySummary: string;
  verifyLead: string;
  verifyWinR: string;
  verifyCd: string;
  verifyCmd: string;
  verifyMatch: string;
  hashLabel: string;
  copy: string;
  copied: string;
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
  promoLead: "🔒 FingerLock 資料夾鎖 · 免費下載",
  promoCta: "查看",
  promoAria: "開啟 FingerLock 介紹與下載頁面",
  metaTitle: "FingerLock 免費 Windows 資料夾鎖",
  metaDesc: "FingerLock 是免費的 Windows 資料夾鎖。用 10 題自訂安全問題（每次隨機 5 題）解鎖，可加手機指紋，並支援忘記答案寄信重設與閒置自動上鎖。",
  title: "FingerLock",
  lede: "免費的 Windows 資料夾鎖。自己設定 10 題安全問題，每次解鎖隨機問其中 5 題；也可以再加上手機指紋。忘記答案可寄信重設，閒置一段時間會自動上鎖。安裝檔是 FingerLock.exe。",
  badges: ["Windows", "免費"],
  downloadExe: "⬇ 下載 FingerLock.exe（免費）",
  fileMeta: "約 31 MB · 版本 v1.2.0",
  manualShortZh: "中文說明書",
  manualShortEn: "英文說明書",
  releaseLink: "到 GitHub 最新版頁面查看",
  smartScreen: "這個程式還沒有數位簽章，Windows 可能跳出藍底警告。按「其他資訊」→「仍要執行」就能開啟。",
  featuresTitle: "功能",
  features: [
    "自己出 10 題安全問題。每次解鎖隨機抽 5 題、順序也隨機，5 題都要答對。",
    "也可以加上手機指紋：手機相機掃 QR code 就能配對，不用裝 App，手機連線會自動建立。",
    "忘記答案或遺失手機時，可寄重設信到當初填的 Email。",
    "在背景執行，右下角系統匣有 🔒 圖示（開啟／立即上鎖／結束），不用開著黑色視窗。",
    "閒置、鎖定螢幕（Win+L）、睡眠、登出或關機時，開著的資料夾都會自動鎖回。",
    "資料夾可以「暫時解鎖」用完自動鎖回，或「永久移除保護」還原檔案。",
    "可選擇開機時自動啟動保護。",
    "介面支援繁體中文與英文：預設跟著 Windows 語言，也可以在右上角「中文 / English」切換。",
    "免費提供，下載檔為 FingerLock.exe。",
  ],
  verifySummary: "進階：檢查檔案是否被竄改（選用）",
  verifyLead: "一般使用可以跳過。這只是用來確認你下載的 FingerLock.exe 沒有被別人換掉。",
  verifyWinR: "按鍵盤的 Windows 鍵和 R，輸入 cmd，再按 Enter，會打開一個黑色視窗。另一個做法：到存放 FingerLock.exe 的資料夾，按住 Shift 再按右鍵，選「在終端機中開啟」。用這個做法就不用下一步。",
  verifyCd: "如果是用 Win+R 開的視窗，要先進入檔案所在的資料夾。檔案若在「下載」，複製下面這行貼上，按 Enter。",
  verifyCmd: "再複製這行指令，貼到同一個黑色視窗，按 Enter。",
  verifyMatch: "畫面上出現的那一長串，要和下面這組完全相同。相同就沒問題。不同就刪掉檔案，不要開啟。",
  hashLabel: "正確的結果應該是",
  copy: "複製",
  copied: "已複製",
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
      title: "按下下載按鈕",
      text: "按頁面上方的「下載 FingerLock.exe（免費）」。檔案約 31 MB。存好之後，下一步再雙擊開啟。",
      image: null,
      imageAlt: "",
    },
    {
      title: "雙擊開啟",
      text: "雙擊 FingerLock.exe。若出現藍色警告，按「其他資訊」→「仍要執行」。瀏覽器會打開設定頁。FingerLock 會在背景執行，右下角系統匣會出現 🔒 圖示；要結束時在圖示上按右鍵選「結束」。",
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
      text: "「只用提示問題」：回答隨機 5 題就能解鎖。「問題 + 手機指紋」：兩道都要通過，較安全。選指紋時，按「配對手機」會自動出現 QR code，用手機相機掃描並用指紋或臉部確認即可（手機要能上網）。",
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
      text: "按「選擇資料夾」，點選要鎖的資料夾（可加多個），再按「🔒 鎖住所選資料夾（加密）」。要使用時按該列的「🔓 暫時解鎖」，用完按「🔒 鎖回」；離開電腦時也會自動鎖回。不想再保護就按「永久移除保護」。",
      image: FL_SHOTS.folders,
      imageAlt: "主畫面列出準備上鎖的資料夾與已鎖住的資料夾，可移除或解鎖。",
    },
  ],
  manualsTitle: "使用說明書",
  manualsLead: "最新版頁面上的 PDF，步驟比這一頁更完整。",
  manualZh: "下載中文說明書（PDF）",
  manualEn: "下載英文說明書（PDF）",
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
  promoLead: "🔒 FingerLock folder lock · Free download",
  promoCta: "View",
  promoAria: "Open the FingerLock page",
  metaTitle: "FingerLock, a free Windows folder lock",
  metaDesc: "FingerLock is a free Windows folder lock. Unlock with 10 security questions you write (5 random ones each time), optionally plus a phone fingerprint, with email reset and idle auto-lock.",
  title: "FingerLock",
  lede: "A free Windows folder lock. You write 10 security questions; each unlock asks 5 of them at random. You can also add a phone fingerprint. If you forget the answers, a reset email can be sent, and it locks again after idle time. The download is FingerLock.exe.",
  badges: ["Windows", "Free"],
  downloadExe: "⬇ Download FingerLock.exe (free)",
  fileMeta: "About 31 MB · version v1.2.0",
  manualShortZh: "Chinese manual",
  manualShortEn: "English manual",
  releaseLink: "Open the latest GitHub release",
  smartScreen: "This program is not digitally signed, so Windows may show a blue warning. Choose More info → Run anyway to open it.",
  featuresTitle: "Features",
  features: [
    "You write 10 security questions. Each unlock asks a random 5, in random order, and all five must be correct.",
    "You can also add a phone fingerprint: pair by scanning a QR code with the phone camera. No app, and the phone connection is set up automatically.",
    "If you forget the answers or lose the phone, a reset email can be sent to the address you saved.",
    "Runs in the background with a 🔒 tray icon (Open / Lock now / Quit), so there is no black window to keep open.",
    "Open folders lock again automatically when you go idle, lock the screen (Win+L), sleep, sign out or shut down.",
    "Unlock a folder temporarily (it locks again when you leave), or remove its protection permanently to restore the files.",
    "Optionally start protection automatically when Windows starts.",
    "The app works in English and Traditional Chinese: it follows your Windows language, and you can switch with the 中文 / English button.",
    "Free. Distributed as FingerLock.exe.",
  ],
  verifySummary: "Advanced: check the file wasn’t tampered with (optional)",
  verifyLead: "You can skip this. It only checks that the FingerLock.exe you downloaded is the published file, and that nobody swapped it.",
  verifyWinR: "Press the Windows key and R, type cmd, then press Enter. A black window opens. Or, in the folder that contains FingerLock.exe, hold Shift and right-click, then choose “Open in Terminal”. If you do that, skip the next step.",
  verifyCd: "If you opened the window with Win+R, go to the file’s folder first. When it is in Downloads, copy the line below, paste it, and press Enter.",
  verifyCmd: "Copy this command, paste it into the same black window, and press Enter.",
  verifyMatch: "The long code on screen must match the one below exactly. If it matches, the file is fine. If it doesn’t, delete the file and don’t open it.",
  hashLabel: "The result should be exactly",
  copy: "Copy",
  copied: "Copied",
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
      title: "Press the download button",
      text: "Press “Download FingerLock.exe (free)” at the top of this page. The file is about 31 MB. After it saves, the next step is to double-click it.",
      image: null,
      imageAlt: "",
    },
    {
      title: "Double-click to open",
      text: "Double-click FingerLock.exe. If a blue warning appears, choose More info → Run anyway. Your browser opens the setup page. FingerLock runs in the background with a 🔒 icon in the system tray; to quit, right-click the icon and choose 結束 (Quit).",
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
      text: "Questions only: answer 5 random questions to unlock. Questions plus phone fingerprint: both must pass, which is safer. For fingerprint, press pair and a QR code appears automatically; scan it with the phone camera and confirm with fingerprint or face (the phone needs internet).",
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
      text: "Choose folders, select the ones to lock (you can add more than one), then press “🔒 Lock selected folders”. To use one, press “Unlock temporarily” on its row and “Lock again” when done; it also locks again automatically when you leave. “Remove protection permanently” restores the files for good.",
      image: FL_SHOTS.folders,
      imageAlt: "Main screen listing folders to lock and folders already locked, with remove and unlock actions.",
    },
  ],
  manualsTitle: "Manuals",
  manualsLead: "PDFs on the latest release, with the full steps.",
  manualZh: "Chinese manual (PDF)",
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
