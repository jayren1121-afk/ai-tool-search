"use client";
import { useState } from "react";
import { FL, FL_CD_CMD, FL_SHA256, FL_VERIFY_CMD } from "@/lib/fingerlock";
import type { Locale } from "@/lib/i18n";

function CopyLine({ value, copy, copied, label }: { value: string; copy: string; copied: string; label: string }) {
  const [ok, setOk] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setOk(true);
    window.setTimeout(() => setOk(false), 2000);
  }
  return (
    <div className="fingerlock-copy">
      <code>{value}</code>
      <button type="button" onClick={onCopy} aria-label={label}>{ok ? copied : copy}</button>
    </div>
  );
}

/** 預設收合。一般使用者不必打開。 */
export default function FingerLockVerify({ locale }: { locale: Locale }) {
  const copy = FL[locale];
  return (
    <details className="fingerlock-verify">
      <summary>{copy.verifySummary}</summary>
      <div className="fingerlock-verify-body">
        <p>{copy.verifyLead}</p>
        <ol>
          <li>{copy.verifyWinR}</li>
          <li>
            {copy.verifyCd}
            <CopyLine value={FL_CD_CMD} copy={copy.copy} copied={copy.copied} label={copy.copy} />
          </li>
          <li>
            {copy.verifyCmd}
            <CopyLine value={FL_VERIFY_CMD} copy={copy.copy} copied={copy.copied} label={copy.copy} />
          </li>
          <li>
            {copy.verifyMatch}
            <p className="fingerlock-hash-label">{copy.hashLabel}</p>
            <CopyLine value={FL_SHA256} copy={copy.copy} copied={copy.copied} label={copy.copy} />
          </li>
        </ol>
      </div>
    </details>
  );
}
