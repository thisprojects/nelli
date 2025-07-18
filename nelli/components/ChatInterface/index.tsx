"use client";

import { useState, useRef, useEffect } from "react";
import { Conversation, Message } from "@/types/Chat";
import MessageBubble from "@/components/MessageBubble";

interface ChatInterfaceProps {
  conversation: Conversation | undefined;
  onUpdateConversation: (conversationId: string, messages: Message[]) => void;
}

export default function ChatInterface({
  conversation,
  onUpdateConversation,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages, streamingMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !conversation) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
    };

    const updatedMessages = [...conversation.messages, userMessage];
    onUpdateConversation(conversation.id, updatedMessages);

    setInput("");
    setLoading(true);
    setIsStreaming(true);
    setStreamingMessage("");

    // Create abort controller for canceling requests
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Send the entire conversation history instead of just the current message
          messages: updatedMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          conversationId: conversation.id,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullMessage = "";

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.token) {
                fullMessage += data.token;
                setStreamingMessage(fullMessage);
              }

              if (data.done) {
                const assistantMessage: Message = {
                  id: (Date.now() + 1).toString(),
                  content: fullMessage,
                  role: "assistant",
                  timestamp: new Date(),
                };

                onUpdateConversation(conversation.id, [
                  ...updatedMessages,
                  assistantMessage,
                ]);

                setStreamingMessage("");
                setIsStreaming(false);
                return;
              }
            } catch (parseError) {
              console.error("Error parsing streaming data:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "Sorry, there was an error connecting to the AI. Please make sure Ollama is running and try again.",
        role: "assistant",
        timestamp: new Date(),
      };

      onUpdateConversation(conversation.id, [...updatedMessages, errorMessage]);
      setStreamingMessage("");
      setIsStreaming(false);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Cancel streaming if component unmounts or user starts new message
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!conversation) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h2 className="text-xl font-semibold mb-2">Welcome Nelli</h2>
          <p>
            Select a conversation or start a new one to begin chatting with your
            local AI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-screen">
      {/* Messages */}
      <div className="overflow-y-auto p-6">
        {conversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Show streaming message */}
        {isStreaming && streamingMessage && (
          <div className="flex justify-center mb-4">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 w-full">
              <div className="whitespace-pre-wrap">
                {streamingMessage}
                <span className="inline-block w-2 h-5 bg-gray-400 ml-1 animate-pulse"></span>
              </div>
            </div>
          </div>
        )}

        {/* Show loading state when starting stream */}
        {loading && !isStreaming && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-3xl">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                <span className="text-gray-500 text-sm">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-4">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: "44px", maxHeight: "200px" }}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
              <span>Send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
