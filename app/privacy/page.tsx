import InfoPageView, { infoMetadata } from "@/components/views/InfoPageView";

export const metadata = infoMetadata("privacy", "zh");

export default function Page() {
  return <InfoPageView kind="privacy" locale="zh" />;
}
