import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import CitationList from "./CitationList";

interface ChatProps {
  museumId: string;
}

interface Message {
  question: string;
  answer: string;
  sources: Array<{ id: string; source_url: string | null; similarity: number }>;
}

function isRefusalAnswer(answer: string) {
  const a = (answer || "").toLowerCase();
  return (
    a.includes("isn’t available in the provided sources") ||
    a.includes("isn't available in the provided sources") ||
    a.includes("please check the museum’s official website") ||
    a.includes("please check the museum's official website")
  );
}

export default function Chat({ museumId }: ChatProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Only include prompts we *actually* answer well with your current ingestion.
  const suggestions = useMemo(
    () => [
      "What are the museum hours and admission prices?",
      "What exhibitions are currently listed on the site?",
     
    ],
    []
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;

    const currentQuestion = q.trim();
    setError(null);
    setLoading(true);
    setQuestion("");

    setMessages((prev) => [...prev, { question: currentQuestion, answer: "", sources: [] }]);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke("rag_chat", {
        body: {
          museum_id: museumId,
          question: currentQuestion,
          match_count: 8,
        },
      });

      if (fetchError) throw new Error(fetchError.message || "Failed to get response");
      if (data?.error) throw new Error(data.error);
      if (!data?.answer) throw new Error("Invalid response from server");

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          question: currentQuestion,
          answer: data.answer,
          sources: data.sources || [],
        };
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await ask(question);
  };

  return (
    <div className="chat">
      <div className="chat-header">
        <div className="brand brand-inline">
          <div className="brand-mark">🖼️</div>
          <div>
            <h2 className="title">Buffalo AKG Asisstant</h2>
            <p className="subtitle">Ask about visiting, hours, admission, parking, exhibits, and events.</p>
          </div>
        </div>

        {messages.length === 0 && (
          <div className="suggestions">
            {suggestions.map((s) => (
              <button
                key={s}
                className="chip"
                type="button"
                onClick={() => ask(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="chat-messages">
        {messages.map((m, idx) => {
          const showSources = !isRefusalAnswer(m.answer) && (m.sources?.length ?? 0) > 0;

          return (
            <div key={idx} className="message-group">
              <div className="bubble bubble-user">
                <div className="bubble-label">You</div>
                <div className="bubble-text">{m.question}</div>
              </div>

              {m.answer && (
                <div className="bubble bubble-bot">
                  <div className="bubble-label">Guide</div>
                  <div className="bubble-text">{m.answer}</div>
                </div>
              )}

              {showSources && (
                <CitationList sources={m.sources} />
              )}
            </div>
          );
        })}

        {loading && (
          <div className="bubble bubble-bot">
            <div className="bubble-label">Guide</div>
            <div className="bubble-text">Thinking…</div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-form">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          disabled={loading}
          className="input"
        />
        <button type="submit" disabled={loading || !question.trim()} className="button button-primary">
          Send
        </button>
      </form>
    </div>
  );
}
