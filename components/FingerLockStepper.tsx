"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FL, FL_LINKS, FL_VERIFY_CMD, type FlCopy } from "@/lib/fingerlock";
import type { Locale } from "@/lib/i18n";

function StepShot({ step }: { step: FlCopy["steps"][number] }) {
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !step.image) return;
    const ratio = step.scroll ?? 0;
    el.scrollTop = Math.max(0, ratio * (el.scrollHeight - el.clientHeight));
  }, [step]);
  if (!step.image) {
    return (
      <div className="fingerlock-command">
        <p className="fingerlock-command-label">SHA-256</p>
        <pre><code>{FL_VERIFY_CMD}</code></pre>
        <p className="fingerlock-command-file">SHA256SUMS.txt</p>
      </div>
    );
  }
  return (
    <div ref={frameRef} className="fingerlock-shot" tabIndex={0} role="img" aria-label={step.imageAlt}>
      <img src={step.image.src} width={step.image.w} height={step.image.h} alt="" />
    </div>
  );
}

export default function FingerLockStepper({ locale }: { locale: Locale }) {
  const copy = FL[locale];
  const steps = copy.steps;
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;

  function go(n: number) {
    setI(Math.max(0, Math.min(steps.length - 1, n)));
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(steps.length - 1); }
  }

  return (
    <div className="fingerlock-stepper" role="group" aria-roledescription={copy.stepperRole} aria-label={copy.stepperLabel} onKeyDown={onKeyDown}>
      <StepShot key={i} step={step} />
      <div aria-live="polite">
        <p className="fingerlock-progress">{copy.stepProgress(i + 1, steps.length)}</p>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
      </div>
      <div className="fingerlock-nav">
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0}>{copy.prev}</button>
        <div className="fingerlock-dots" role="group" aria-label={copy.stepsGroup}>
          {steps.map((s, n) => (
            <button key={s.title} type="button" className={n === i ? "is-current" : undefined} aria-current={n === i ? "step" : undefined} aria-label={copy.stepDot(n + 1, s.title)} onClick={() => go(n)} />
          ))}
        </div>
        <button type="button" onClick={() => go(i + 1)} disabled={last}>{copy.next}</button>
      </div>
      {last && (
        <a className="fingerlock-download" href={FL_LINKS.exe} target="_blank" rel="noopener noreferrer">{copy.downloadExe}</a>
      )}
    </div>
  );
}
