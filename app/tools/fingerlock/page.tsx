import FingerLockView, { fingerlockMetadata } from "@/components/views/FingerLockView";

export const metadata = fingerlockMetadata("zh");

export default function Page() {
  return <FingerLockView locale="zh" />;
}
