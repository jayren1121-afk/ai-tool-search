"use client";
// 免費站內保護的介面與事件接線。預設關閉：沒開啟時不監聽、不攔截、不讀取輸入。
// 檢查邏輯在 lib/on-site-guard.ts，不呼叫任何 API，也不寫入使用者原文。
import { Component, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { splitPath, t, type Locale } from "@/lib/i18n";
import {
  findPii, shouldInspectLink, checkUrl, GUARD_STORAGE_KEY,
  type LinkIssue, type PiiHit,
} from "@/lib/on-site-guard";

type GuardApi = { enabled: boolean; setEnabled: (on: boolean) => void };
const GuardCtx = createContext<GuardApi>({ enabled: false, setEnabled: () => {} });
const useGuard = () => useContext(GuardCtx);

type L10n = ReturnType<typeof t>;
type PromptView = { title: string; lines: string[]; extra?: string; disclaimer: string; proceedLabel: string; cancelLabel: string };

const STOP_AT = new Set(["MAIN", "HEADER", "FOOTER", "NAV", "BODY", "HTML", "SECTION", "ARTICLE", "ASIDE", "FORM"]);
const SKIP_LABEL = /^(取消|關閉|close|cancel|×|✕|x|登出|log out|logout|sign out)$/i;

function inGuardUi(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("[data-guard-ui]");
}
function isHandheld(): boolean {
  try { return window.matchMedia("(hover: none) and (pointer: coarse)").matches; } catch { return false; }
}
function isUserTextField(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (!(el instanceof HTMLInputElement) || el.disabled || el.readOnly) return false;
  const type = (el.type || "text").toLowerCase();
  return type === "text" || type === "search" || type === "email" || type === "tel" || type === "url" || type === "number" || type === "";
}
function skipButton(btn: HTMLElement): boolean {
  if (btn.closest("[data-guard-ui]")) return true;
  const type = (btn.getAttribute("type") || "").toLowerCase();
  if (type === "button" || type === "reset") return true;
  if (btn.getAttribute("role") === "tab") return true;
  const label = (btn.getAttribute("aria-label") || btn.textContent || "").replace(/\s+/g, " ").trim();
  return SKIP_LABEL.test(label);
}
/** 按鈕附近、同一小塊裡的輸入文字。不往上掃整頁，也略過旁邊另一塊自己有按鈕的區域。 */
function nearbyText(button: HTMLElement): string {
  let node = button.parentElement;
  for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
    if (STOP_AT.has(node.tagName)) break;
    const fields = [...node.querySelectorAll("input, textarea")].filter(isUserTextField);
    if (!fields.length) continue;
    if (fields.length > 8) break;
    const owned = fields.filter((field) => {
      let branch: HTMLElement | null = field;
      while (branch.parentElement && branch.parentElement !== node) branch = branch.parentElement;
      if (!branch || branch.contains(button)) return true;
      return !branch.querySelector("button, input[type='submit']");
    });
    if (!owned.length) break;
    return owned.map((f) => f.value).filter((v) => v.trim()).join("\n");
  }
  return "";
}
function formText(form: HTMLFormElement): string {
  const parts: string[] = [];
  for (const el of form.querySelectorAll("input, textarea")) {
    if (isUserTextField(el) && el.value.trim()) parts.push(el.value);
  }
  return parts.join("\n");
}
function editableOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && isUserTextField(target)) return target;
  const host = target.closest("[contenteditable='true'], [contenteditable='']");
  return host instanceof HTMLElement ? host : null;
}
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
function applyPaste(el: HTMLElement, text: string, start: number | null, end: number | null) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const s = start ?? el.value.length;
    const e = end ?? s;
    const max = el.maxLength;
    let next = el.value.slice(0, s) + text + el.value.slice(e);
    if (max >= 0 && next.length > max) next = next.slice(0, max);
    setNativeValue(el, next);
    const pos = Math.min(s + text.length, next.length);
    try { el.setSelectionRange(pos, pos); } catch { /* 某些輸入類型沒有選取範圍 */ }
    el.focus();
    return;
  }
  el.focus();
  try { document.execCommand("insertText", false, text); } catch { /* 放不進去就停止，不把原文送去別處 */ }
}
function linkLine(L: L10n, issue: LinkIssue): string {
  const map: Record<LinkIssue, string> = {
    script: L.guardHitScript, http: L.guardHitHttp, ip: L.guardHitIp, punycode: L.guardHitPunycode,
    shortener: L.guardHitShortener, redirect: L.guardHitRedirect, userinfo: L.guardHitUserinfo,
    port: L.guardHitPort, executable: L.guardHitExecutable,
  };
  return map[issue];
}
function piiLine(L: L10n, hit: PiiHit): string {
  if (hit.kind === "twid") return L.guardHitTwid(hit.masked);
  if (hit.kind === "phone") return L.guardHitPhone(hit.masked);
  if (hit.kind === "card") return L.guardHitCard(hit.masked);
  if (hit.kind === "email") return L.guardHitEmail(hit.masked);
  return L.guardHitUbn(hit.masked);
}

function GuardProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try {
      if (on) sessionStorage.setItem(GUARD_STORAGE_KEY, "1");
      else sessionStorage.removeItem(GUARD_STORAGE_KEY);
    } catch { /* 無法使用 storage 時只留在這次分頁的記憶體，關掉分頁一樣結束 */ }
  }, []);
  useEffect(() => {
    try { if (sessionStorage.getItem(GUARD_STORAGE_KEY) === "1") setEnabledState(true); } catch { /* 維持關閉 */ }
  }, []);
  const api = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  return <GuardCtx.Provider value={api}>{children}</GuardCtx.Provider>;
}

function GuardRuntime() {
  const path = usePathname() || "/";
  const { locale, base } = splitPath(path);
  const L = t(locale);
  const { enabled, setEnabled } = useGuard();
  const [prompt, setPrompt] = useState<PromptView | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);
  const promptRef = useRef<PromptView | null>(null);
  const bypassRef = useRef(0);
  const previousFocus = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  promptRef.current = prompt;

  const dismiss = useCallback((go: boolean) => {
    const proceed = pendingRef.current;
    pendingRef.current = null;
    promptRef.current = null;
    setPrompt(null);
    if (!go) { previousFocus.current?.focus?.(); return; }
    try { proceed?.(); } catch { /* 使用者已選擇繼續，但補做失敗時不再另送內容 */ }
  }, []);

  useEffect(() => { if (prompt) cancelRef.current?.focus(); }, [prompt]);

  useEffect(() => {
    if (!enabled) return;
    const loc = t(locale);
    const open = (view: PromptView, proceed: () => void) => {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      pendingRef.current = proceed;
      promptRef.current = view;
      setPrompt(view);
    };
    // 代為重送時必須整段跳過，否則會再次攔截；對話框自己的按鈕也要放行。
    const skipGuard = (e: Event) => bypassRef.current > 0 || inGuardUi(e.target);
    const holdForDecision = (e: Event) => {
      if (!promptRef.current || skipGuard(e)) return false;
      e.preventDefault();
      e.stopPropagation();
      return true;
    };
    const onPointer = (e: MouseEvent) => {
      if (e.button === 2 || (e.type === "click" && e.button !== 0)) return;
      if (skipGuard(e) || holdForDecision(e)) return;
      try {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest("button, input[type='submit']");
        if (btn instanceof HTMLElement && !skipButton(btn) && !btn.closest("form")) {
          const text = nearbyText(btn);
          const hits = text && text.length <= 100_000 ? findPii(text) : [];
          if (hits.length) {
            e.preventDefault();
            e.stopPropagation();
            open({
              title: loc.guardPiiTitle, lines: hits.map((h) => piiLine(loc, h)), disclaimer: loc.guardPiiDisclaimer,
              proceedLabel: loc.guardProceed, cancelLabel: loc.cancel,
            }, () => { bypassRef.current++; try { btn.click(); } finally { bypassRef.current--; } });
            return;
          }
        }
        const a = target.closest("a[href]");
        if (!(a instanceof HTMLAnchorElement)) return;
        const hrefAttr = a.getAttribute("href") || "";
        if (!hrefAttr || hrefAttr.startsWith("#")) return;
        if (!shouldInspectLink(a.href, location.href, { download: a.hasAttribute("download") })) return;
        const checked = checkUrl(a.href, location.href);
        if (!checked || checked.issues.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        const href = a.href;
        const downloadName = a.getAttribute("download");
        const newTab = e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1 || a.target === "_blank";
        open({
          title: loc.guardLinkTitle, lines: checked.issues.map((issue) => linkLine(loc, issue)), extra: checked.display,
          disclaimer: loc.guardLinkDisclaimer, proceedLabel: loc.guardProceedLink, cancelLabel: loc.cancel,
        }, () => {
          if (downloadName !== null) {
            const tmp = document.createElement("a");
            tmp.href = href;
            tmp.download = downloadName;
            tmp.rel = "noopener noreferrer";
            if (newTab) tmp.target = "_blank";
            bypassRef.current++;
            try { document.body.appendChild(tmp); tmp.click(); } finally { tmp.remove(); bypassRef.current--; }
            return;
          }
          if (newTab) { window.open(href, "_blank", "noopener,noreferrer"); return; }
          location.assign(href);
        });
      } catch { /* 檢查失敗就放行，不影響原本的點擊 */ }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (skipGuard(e) || holdForDecision(e)) return;
      try {
        const el = editableOf(e.target);
        if (!el) return;
        const text = e.clipboardData?.getData("text/plain") ?? "";
        if (!text || text.length > 100_000) return;
        const hits = findPii(text);
        if (!hits.length) return;
        e.preventDefault();
        e.stopPropagation();
        const field = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
        const start = field ? field.selectionStart : null;
        const end = field ? field.selectionEnd : null;
        open({
          title: loc.guardPiiTitle, lines: hits.map((h) => piiLine(loc, h)), disclaimer: loc.guardPiiDisclaimer,
          proceedLabel: loc.guardProceed, cancelLabel: loc.cancel,
        }, () => applyPaste(el, text, start, end));
      } catch { /* 檢查失敗就讓瀏覽器照常貼上 */ }
    };
    const onSubmit = (e: SubmitEvent) => {
      if (skipGuard(e) || holdForDecision(e)) return;
      try {
        const form = e.target;
        if (!(form instanceof HTMLFormElement) || form.closest("[data-guard-ui]")) return;
        const text = formText(form);
        if (!text || text.length > 100_000) return;
        const hits = findPii(text);
        if (!hits.length) return;
        e.preventDefault();
        e.stopPropagation();
        const submitter = e.submitter instanceof HTMLElement ? e.submitter : null;
        open({
          title: loc.guardPiiTitle, lines: hits.map((h) => piiLine(loc, h)), disclaimer: loc.guardPiiDisclaimer,
          proceedLabel: loc.guardProceed, cancelLabel: loc.cancel,
        }, () => {
          bypassRef.current++;
          try {
            if (submitter instanceof HTMLButtonElement || (submitter instanceof HTMLInputElement && submitter.type === "submit")) form.requestSubmit(submitter);
            else form.requestSubmit();
          } catch { /* 無法代送就留在原頁 */ }
          finally { bypassRef.current--; }
        });
      } catch { /* 檢查失敗就讓表單照常送出 */ }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !promptRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      dismiss(false);
    };
    const leave = () => { if (isHandheld() && document.visibilityState === "hidden") setEnabled(false); };
    const pageHide = () => { if (isHandheld()) setEnabled(false); };
    document.addEventListener("click", onPointer, true);
    document.addEventListener("auxclick", onPointer, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("visibilitychange", leave);
    window.addEventListener("pagehide", pageHide);
    return () => {
      document.removeEventListener("click", onPointer, true);
      document.removeEventListener("auxclick", onPointer, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("visibilitychange", leave);
      window.removeEventListener("pagehide", pageHide);
      pendingRef.current = null;
      setPrompt(null);
    };
  }, [enabled, locale, dismiss, setEnabled]);

  const onHome = base === "/";
  return (
    <>
      {enabled && !onHome && (
        <div data-guard-ui="1" className="sticky top-0 z-30 border-b border-slate-200 bg-amber-50">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
            <p className="min-w-0 flex-1 text-sm text-slate-700">{L.guardOnBanner}</p>
            <button type="button" onClick={() => setEnabled(false)} className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">{L.guardStop}</button>
          </div>
        </div>
      )}
      {prompt && (
        <div data-guard-ui="1" className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="onsite-guard-title" aria-describedby="onsite-guard-desc">
          <div className="absolute inset-0 bg-black/40" onClick={() => dismiss(false)} />
          <div className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5">
            <h2 id="onsite-guard-title" className="text-base font-semibold">{prompt.title}</h2>
            <ul id="onsite-guard-desc" className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {prompt.lines.map((line) => <li key={line} className="break-words">{line}</li>)}
            </ul>
            {prompt.extra && <p className="mt-2 break-all rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">{prompt.extra}</p>}
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{prompt.disclaimer}</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button ref={cancelRef} type="button" onClick={() => dismiss(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">{prompt.cancelLabel}</button>
              <button type="button" onClick={() => dismiss(true)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">{prompt.proceedLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 保護模組如果自己出錯，整塊消失，不能把搜尋頁一起帶走。 */
class GuardBoundary extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError(): { bad: boolean } { return { bad: true }; }
  componentDidCatch(): void { /* 不記錄內容 */ }
  render() { return this.state.bad ? null : this.props.children; }
}

export function OnSiteGuardToggle() {
  return <GuardBoundary><ToggleBody /></GuardBoundary>;
}

function ToggleBody() {
  const { locale } = splitPath(usePathname() || "/");
  const L = t(locale as Locale);
  const { enabled, setEnabled } = useGuard();
  return (
    <div data-guard-ui="1" role="region" aria-label={L.guardRegion} className="w-full rounded-xl bg-white lg:w-[26rem] lg:shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="min-w-0 text-sm font-medium text-slate-700">{enabled ? L.guardStatusOn : L.guardStatusOff}</p>
        <button type="button" aria-pressed={enabled} aria-describedby="onsite-guard-explain" onClick={() => { try { setEnabled(!enabled); } catch { /* 開關失敗就維持原狀 */ } }}
          className={enabled
            ? "shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            : "shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"}>
          {enabled ? L.guardStop : L.guardStart}
        </button>
      </div>
      <p id="onsite-guard-explain" className="mt-2 text-xs leading-relaxed text-slate-500">{L.guardExplain}</p>
    </div>
  );
}

/** 包住頁面內容。關閉時只提供開關用的狀態，不掛任何監聽。 */
export default function OnSiteGuard({ children }: { children: ReactNode }) {
  return (
    <GuardProvider>
      <GuardBoundary><GuardRuntime /></GuardBoundary>
      {children}
    </GuardProvider>
  );
}
