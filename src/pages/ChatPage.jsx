import React from 'react';
import ChatWindow from '../components/ChatWindow';

export default function ChatPage() {
  const mcpServerId = process.env.REACT_APP_CHAT_MCP_SERVER_ID;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
        <p className="text-sm text-gray-500">
          Ask about your land finance data. The assistant can use the connected tools to help.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <ChatWindow
          mcpServerId={mcpServerId}
          getUserToken={() => localStorage.getItem('token')}
          title="ACREs Assistant"
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
