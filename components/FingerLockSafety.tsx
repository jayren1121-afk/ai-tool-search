import { FL, FL_LINKS } from "@/lib/fingerlock";
import type { Locale } from "@/lib/i18n";

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

/** 預設收合，放在下載鈕下方，不擋住一鍵下載。 */
export default function FingerLockSafety({ locale }: { locale: Locale }) {
  const copy = FL[locale];
  return (
    <details className="fingerlock-safety">
      <summary>{copy.safetySummary}</summary>
      <div className="fingerlock-safety-body">
        <p>{copy.safetyLead}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{copy.safetyLocal}</li>
          <li>
            {copy.safetySource}
            <a href={FL_LINKS.release} {...ext}>jayren1121-afk/fingerlock-download</a>
            {copy.safetySourceEnd}
          </li>
          <li>{copy.safetyWhy}</li>
          <li>{copy.safetySha(copy.verifySummary)}</li>
        </ul>
        <h3>{copy.smartTitle}</h3>
        <p>{copy.smartIntro}</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          {copy.smartSteps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <h3>{copy.defenderTitle}</h3>
        <p>{copy.defenderIntro}</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          {copy.defenderSteps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
    </details>
  );
}
