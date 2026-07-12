import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface Message {
  sender: "user" | "copilot";
  text: string;
}

export const AICopilot: React.FC = () => {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "copilot",
      text: "Hello! I am your **AssetFlow AI Copilot**. Ask me anything about our asset directory, bookings, custody allocations, or maintenance records. For example, click one of the quick prompts below!",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSubmit = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    // Add user message
    setMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    setLoading(true);
    setPrompt("");

    try {
      const response = await apiFetch("/analytics/copilot", {
        method: "POST",
        body: JSON.stringify({ prompt: textToSend }),
      });

      // Add copilot reply
      setMessages((prev) => [...prev, { sender: "copilot", text: response.reply }]);
    } catch (err: any) {
      showToast("error", err.message || "Failed to contact Copilot");
      setMessages((prev) => [
        ...prev,
        { sender: "copilot", text: "⚠️ System Error: Unable to query database records at this time." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptClick = (text: string) => {
    handleSubmit(text);
  };

  return (
    <>
      {/* Floating bubble button */}
      <button className="ai-copilot-toggle-btn" onClick={() => setIsOpen(!isOpen)} title="AI Copilot">
        {isOpen ? <X size={22} /> : <MessageSquare size={22} />}
      </button>

      {/* Drawer */}
      {isOpen && (
        <div className="ai-copilot-drawer animate-fade">
          <div className="ai-copilot-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={16} color="var(--accent-primary)" />
              <strong style={{ fontSize: "14px" }}>AssetFlow AI Copilot</strong>
            </div>
            <button
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              onClick={() => setIsOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="ai-copilot-chat">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`chat-bubble chat-bubble-${msg.sender}`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {/* Minimal Markdown rendering for bold styling */}
                {msg.text.split("**").map((chunk, i) => (i % 2 === 1 ? <strong key={i}>{chunk}</strong> : chunk))}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble chat-bubble-copilot" style={{ fontStyle: "italic", opacity: 0.8 }}>
                Searching relational database...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="ai-copilot-input-wrapper">
            {/* Quick Prompts */}
            <div className="ai-copilot-prompts">
              <span
                className="copilot-prompt-pill"
                onClick={() => handlePromptClick("Who has Laptop AF-0001?")}
              >
                Who has Laptop AF-0001?
              </span>
              <span
                className="copilot-prompt-pill"
                onClick={() => handlePromptClick("Show overdue returns")}
              >
                Show Overdue
              </span>
              <span
                className="copilot-prompt-pill"
                onClick={() => handlePromptClick("Find available projectors")}
              >
                Find Projectors
              </span>
              <span
                className="copilot-prompt-pill"
                onClick={() => handlePromptClick("List active maintenance tickets")}
              >
                Needing Repairs
              </span>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(prompt);
              }}
              style={{ display: "flex", gap: "8px" }}
            >
              <input
                type="text"
                className="form-control"
                placeholder="Ask AI Copilot..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: "10px", borderRadius: "var(--radius-sm)" }}
                disabled={loading}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
