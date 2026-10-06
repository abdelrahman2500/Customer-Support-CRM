import { ChatWidget } from "@/components/chat/chat-widget";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("chat", "nav");

export default function ChatPage() {
  return <ChatWidget />;
}
