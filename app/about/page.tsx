import InfoPageView, { infoMetadata } from "@/components/views/InfoPageView";

export const metadata = infoMetadata("about", "zh");

export default function Page() {
  return <InfoPageView kind="about" locale="zh" />;
}
