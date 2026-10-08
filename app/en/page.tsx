import HomeView, { homeMetadata } from "@/components/views/HomeView";

export const metadata = homeMetadata("en");

export default function Page() {
  return <HomeView locale="en" />;
}
