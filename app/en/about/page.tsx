import InfoPageView, { infoMetadata } from "@/components/views/InfoPageView";

export const metadata = infoMetadata("about", "en");

export default function Page() {
  return <InfoPageView kind="about" locale="en" />;
}
