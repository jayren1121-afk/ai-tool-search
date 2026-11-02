import HomeView, { homeMetadata } from "@/components/views/HomeView";

export const metadata = homeMetadata("en");

export default function Page() {
  return <HomeView locale="en" />;
}

// 每日推薦需在換日後更新
export const revalidate = 300;
