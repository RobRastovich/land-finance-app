import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Loader2, RotateCcw } from 'lucide-react';
import { sendChatMessage, clearSession } from '../api/chat';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'Hi! I am your AI assistant. Ask me about your data and I can use the connected tools to help.',
};

const SESSION_KEY = (mcpServerId) => `chat_session_${mcpServerId}`;

export default function ChatWindow({
  mcpServerId,
  getUserToken,
  title = 'AI Assistant',
  welcomeMessage = WELCOME_MESSAGE,
  className = '',
}) {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY(mcpServerId)) || null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    if (!mcpServerId) {
      setError('No MCP server configured for this chat.');
      return;
    }

    const userMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const userToken = getUserToken ? getUserToken() : null;
      const { reply, sessionId: returnedSessionId } = await sendChatMessage({
        message: text,
        mcpServerId,
        userToken,
        sessionId,
      });

      if (returnedSessionId && returnedSessionId !== sessionId) {
        setSessionId(returnedSessionId);
        localStorage.setItem(SESSION_KEY(mcpServerId), returnedSessionId);
      }

      setMessages((prev) => [...prev, { role: reply.role || 'assistant', content: reply.content || '' }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewChat() {
    if (sessionId) {
      await clearSession(sessionId).catch(() => {});
      localStorage.removeItem(SESSION_KEY(mcpServerId));
    }
    setSessionId(null);
    setMessages([welcomeMessage]);
    setError(null);
  }

  return (
    <div className={`flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#1F4E79] to-[#153452] text-white">
        <div className="flex items-center gap-2">
          <Bot size={18} />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition"
          title="Start new conversation"
        >
          <RotateCcw size={13} />
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm
                ${msg.role === 'user'
                  ? 'bg-[#1F4E79] text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 opacity-70">
                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                <span className="text-[10px] uppercase font-medium">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-3 py-2 shadow-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[#1F4E79]" />
              <span className="text-xs text-gray-500">Thinking...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your land finance data..."
          className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]/50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2 rounded-full bg-[#1F4E79] text-white hover:bg-[#153452] disabled:opacity-50 disabled:cursor-not-allowed transition"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
