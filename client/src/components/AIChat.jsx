import { useState, useRef, useEffect } from 'react';
import { helpApi } from '../api/client';

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your FlowApp assistant. How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [related, setRelated] = useState([]);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
      const res = await helpApi.chat(userMsg, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, source: res.source }]);
      setRelated(res.relatedArticles || []);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const chatStyle = {
    position: 'fixed', bottom: '80px', right: '20px', width: '380px', maxHeight: '520px',
    backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column', zIndex: 9999, overflow: 'hidden',
    border: '1px solid #e0e0e0',
  };

  return (
    <>
      {/* Chat Window */}
      {open && (
        <div style={chatStyle}>
          {/* Header */}
          <div style={{ padding: '0.75rem 1rem', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🤖</span>
              <span style={{ fontWeight: 600 }}>FlowApp Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', padding: '0.6rem 0.9rem',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                backgroundColor: msg.role === 'user' ? '#1a1a2e' : '#f0f2f5',
                color: msg.role === 'user' ? '#fff' : '#333',
                fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
                {msg.source === 'ai' && <span style={{ display: 'block', fontSize: '0.7rem', color: msg.role === 'user' ? '#aaa' : '#888', marginTop: '0.25rem' }}>✨ AI-powered</span>}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '0.6rem 0.9rem', borderRadius: '12px 12px 12px 2px', backgroundColor: '#f0f2f5', color: '#888' }}>
                <span className="typing-dots">thinking...</span>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Related Articles */}
          {related.length > 0 && (
            <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #eee', fontSize: '0.8rem' }}>
              <span style={{ color: '#888' }}>Related: </span>
              {related.map((a, i) => (
                <span key={a.id}><a href={`/help`} style={{ color: '#0d6efd', textDecoration: 'none' }}>{a.title}</a>{i < related.length - 1 ? ', ' : ''}</span>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '0.75rem', borderTop: '1px solid #eee', display: 'flex', gap: '0.5rem' }}>
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
              style={{ flex: 1, border: '1px solid #ddd', borderRadius: '20px', padding: '0.5rem 1rem', fontSize: '0.9rem', outline: 'none' }}
              disabled={loading}
            />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: '#1a1a2e', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setOpen(!open)} style={{
        position: 'fixed', bottom: '20px', right: '20px', width: '56px', height: '56px',
        borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #1a1a2e, #e94560)',
        color: '#fff', fontSize: '1.5rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.2s',
      }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  );
}
