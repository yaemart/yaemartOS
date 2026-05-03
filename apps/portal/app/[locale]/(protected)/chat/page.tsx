import { ChatWindow } from '../../../../components/chat/chat-window';

interface ChatPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { locale } = await params;

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      <div className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Support Chat</h1>
        <p className="text-xs text-gray-500">Chat with our AI assistant</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatWindow locale={locale} />
      </div>
    </div>
  );
}
