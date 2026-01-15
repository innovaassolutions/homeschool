"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import type { Id } from "@/convex/_generated/dataModel";

function SessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const childId = searchParams.get("childId") as Id<"childProfiles"> | null;
  const subject = searchParams.get("subject") || "math";

  const child = useQuery(api.childProfiles.get, childId ? { id: childId } : "skip");
  const activeSession = useQuery(api.sessions.getActive, childId ? { childId } : "skip");

  const createSession = useMutation(api.sessions.create);
  const startSession = useMutation(api.sessions.start);
  const pauseSession = useMutation(api.sessions.pause);
  const resumeSession = useMutation(api.sessions.resume);
  const completeSession = useMutation(api.sessions.complete);

  const chat = useAction(api.ai.chat);

  const [sessionId, setSessionId] = useState<Id<"learningSessions"> | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionState, setSessionState] = useState<"idle" | "active" | "paused">("idle");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use existing active session if available
  useEffect(() => {
    if (activeSession && !sessionId) {
      setSessionId(activeSession._id);
      setSessionState("active");
    }
  }, [activeSession, sessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!childId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No child selected. Please go back to the dashboard.</p>
        <button onClick={() => router.push("/dashboard")} className="mt-4 btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const handleStartSession = async () => {
    const id = await createSession({
      childId,
      sessionType: "lesson",
      subject,
    });
    await startSession({ sessionId: id });
    setSessionId(id);
    setSessionState("active");

    // Add welcome message
    setMessages([
      {
        role: "assistant",
        content: `Hi ${child.name}! I'm excited to help you learn ${subject} today. What would you like to work on?`,
      },
    ]);
  };

  const handlePause = async () => {
    if (sessionId) {
      await pauseSession({ sessionId });
      setSessionState("paused");
    }
  };

  const handleResume = async () => {
    if (sessionId) {
      await resumeSession({ sessionId });
      setSessionState("active");
    }
  };

  const handleComplete = async () => {
    if (sessionId) {
      await completeSession({ sessionId });
      router.push("/dashboard");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Add user message immediately
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await chat({
        sessionId,
        childId,
        message: userMessage,
      });

      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble understanding. Could you try again?" },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {subject.charAt(0).toUpperCase() + subject.slice(1)} Session
          </h1>
          <p className="text-sm text-gray-500">Learning with {child.name}</p>
        </div>
        <div className="flex gap-2">
          {sessionState === "idle" && (
            <button onClick={handleStartSession} className="btn-primary">
              Start Session
            </button>
          )}
          {sessionState === "active" && (
            <>
              <button onClick={handlePause} className="btn-secondary">
                Pause
              </button>
              <button onClick={handleComplete} className="btn-primary">
                Complete
              </button>
            </>
          )}
          {sessionState === "paused" && (
            <>
              <button onClick={handleResume} className="btn-primary">
                Resume
              </button>
              <button onClick={handleComplete} className="btn-secondary">
                End Session
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chat area */}
      {sessionState !== "idle" && (
        <div className="bg-white rounded-lg shadow flex flex-col" style={{ height: "calc(100vh - 250px)" }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2 text-gray-500">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {sessionState === "active" && (
            <form onSubmit={handleSend} className="border-t p-4 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="btn-primary disabled:opacity-50">
                Send
              </button>
            </form>
          )}

          {sessionState === "paused" && (
            <div className="border-t p-4 text-center text-gray-500">
              Session paused. Click Resume to continue.
            </div>
          )}
        </div>
      )}

      {/* Start prompt */}
      {sessionState === "idle" && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">
            {subject === "math" && "🔢"}
            {subject === "english" && "📚"}
            {subject === "science" && "🔬"}
            {subject === "history" && "🏛️"}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Ready to learn {subject}?
          </h2>
          <p className="text-gray-600 mb-6">
            Click &quot;Start Session&quot; to begin your learning adventure with our AI tutor.
          </p>
          <button onClick={handleStartSession} className="btn-primary text-lg px-8 py-3">
            Start Session
          </button>
        </div>
      )}
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    }>
      <SessionContent />
    </Suspense>
  );
}
