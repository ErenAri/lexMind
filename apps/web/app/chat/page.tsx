'use client';

import AuthWrapper from '@/components/AuthWrapper';
import Chat from '@/components/Chat';

export default function ChatPage() {
  return (
    <AuthWrapper>
      <Chat />
    </AuthWrapper>
  );
}