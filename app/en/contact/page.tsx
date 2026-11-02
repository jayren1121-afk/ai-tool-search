import InfoPageView, { infoMetadata } from "@/components/views/InfoPageView";

export const metadata = infoMetadata("contact", "en");

export default function Page() {
  return <InfoPageView kind="contact" locale="en" />;
}
