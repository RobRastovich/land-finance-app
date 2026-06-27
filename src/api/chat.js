const BASE = process.env.REACT_APP_CHAT_API_ENDPOINT || 'http://localhost:4001';

export async function sendChatMessage({ messages, mcpServerId, userToken }) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, mcpServerId, userToken }),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from chat server' }));

  if (!res.ok) {
    throw new Error(data.error || `Chat server error: ${res.status}`);
  }

  return data;
}
