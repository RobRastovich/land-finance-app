const BASE = process.env.REACT_APP_CHAT_API_ENDPOINT || 'http://localhost:4001';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120_000;

async function pollJob(jobId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${BASE}/api/chat/${jobId}`);
    const pollData = await pollRes.json().catch(() => ({ error: 'Invalid poll response' }));

    if (!pollRes.ok) throw new Error(pollData.error || `Poll error: ${pollRes.status}`);
    if (pollData.status === 'done') return pollData.result;
    if (pollData.status === 'error') throw new Error(pollData.error || 'Chat request failed');
  }

  throw new Error('Chat request timed out');
}

export async function sendChatMessage({ message, messages, mcpServerId, userToken, sessionId }) {
  const body = message
    ? { message, mcpServerId, userToken, sessionId }
    : { messages, mcpServerId, userToken, sessionId };

  const submitRes = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const submitData = await submitRes.json().catch(() => ({ error: 'Invalid response from chat server' }));
  if (!submitRes.ok) throw new Error(submitData.error || `Chat server error: ${submitRes.status}`);
  if (!submitData.jobId) return { reply: submitData, sessionId: submitData.sessionId };

  const reply = await pollJob(submitData.jobId);
  return { reply, sessionId: submitData.sessionId };
}

export async function clearSession(sessionId) {
  await fetch(`${BASE}/api/session/${sessionId}`, { method: 'DELETE' });
}
