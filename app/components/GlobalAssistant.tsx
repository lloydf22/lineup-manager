"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Sparkle, Send, X, MessageSquare, Loader2 } from "lucide-react";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

export default function GlobalAssistant() {
  const pathname = usePathname();
  const restaurantId = "golden-lion"; 

  const [isOpen, setIsOpen] = useState(false);
  const [input, setAiInput] = useState("");
  const [typing, setAiIsTyping] = useState(false);
  const [history, setChatHistory] = useState<ChatMessage[]>([
    { sender: "ai", text: "Hi! I'm Lineup AI, your system operations assistant. I can track tickets, run labor analytics, or verify shift block conflicts from anywhere in the platform. How can I assist you?" }
  ]);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, typing]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { sender: "user", text: input };
    setChatHistory(prev => [...prev, userMsg]);
    setAiInput("");
    setAiIsTyping(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          history: history.slice(-8), 
          restaurantId,
          currentContextPath: pathname 
        })
      });

      const data = await res.json();
      if (data.reply) {
        setChatHistory(prev => [...prev, { sender: "ai", text: data.reply }]);
      } else {
        throw new Error(data.error || "Execution error payload signature");
      }
    } catch (err: any) {
      setChatHistory(prev => [...prev, { sender: "ai", text: `⚠️ Assistant connection dropped: ${err.message}` }]);
    } finally {
      setAiIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Action Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-full shadow-xl hover:bg-slate-800 hover:scale-105 transition-all duration-200 group border border-slate-800"
        >
          <Sparkle size={18} className="text-amber-400 group-hover:rotate-45 transition-transform" />
          <span className="text-xs font-bold tracking-wider uppercase">Ask Lineup AI</span>
        </button>
      )}

      {/* Sliding Tab Expandable Conversation Hub Panel */}
      {isOpen && (
        <div className="w-96 h-[500px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header Layout wrapper */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-950">
            <div className="flex items-center gap-2 text-xs font-black tracking-widest uppercase">
              <Sparkle size={14} className="text-amber-400 animate-spin duration-3000" /> Lineup AI Assistant
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap shadow-3xs border ${
                  msg.sender === "user"
                    ? "bg-slate-950 text-white border-black rounded-br-none"
                    : "bg-white text-gray-800 border-gray-200 rounded-bl-none"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 text-gray-400 px-3 py-2 rounded-xl text-xs rounded-bl-none italic flex items-center gap-1.5 shadow-3xs">
                  <Loader2 size={12} className="animate-spin text-amber-500" /> Lineup AI is reading business matrices...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input form panel elements */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="p-3 bg-white border-t border-gray-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask about active shifts, tickets, labor cost..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs outline-none focus:border-slate-900 focus:bg-white text-gray-800 font-medium"
            />
            <button type="submit" className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-sm">
              <Send size={12} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}