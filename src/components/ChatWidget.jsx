import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import ChatWindow from './ChatWindow';

export default function ChatWidget({
  mcpServerId,
  getUserToken,
  title = 'AI Assistant',
  welcomeMessage,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {open && (
        <ChatWindow
          mcpServerId={mcpServerId}
          getUserToken={getUserToken}
          title={title}
          welcomeMessage={welcomeMessage}
          className="mb-4 w-80 sm:w-96 h-[28rem]"
        />
      )}

      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-3 rounded-full bg-[#1F4E79] text-white shadow-lg hover:bg-[#153452] transition"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? <X size={18} /> : <MessageSquare size={18} />}
        <span className="text-sm font-medium">{open ? 'Close' : 'Chat'}</span>
      </button>
    </div>
  );
}
