import FingerLockView, { fingerlockMetadata } from "@/components/views/FingerLockView";

export const metadata = fingerlockMetadata("en");

export default function Page() {
  return <FingerLockView locale="en" />;
}