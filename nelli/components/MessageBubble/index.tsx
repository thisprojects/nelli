import { Message } from "@/types/Chat";
import { JSX } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MessageBubbleProps {
  message: Message;
}

// Helper function to render text with code blocks
const renderMessageContent = (content: string) => {
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  const elements: JSX.Element[] = [];
  let match;
  let elementKey = 0;

  // Process code blocks first
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore) {
        elements.push(
          <span key={elementKey++} className="whitespace-pre-wrap">
            {renderInlineCode(textBefore)}
          </span>
        );
      }
    }

    // Add code block with syntax highlighting
    const language = match[1] || "text";
    const code = match[2].trim();

    elements.push(
      <div key={elementKey++} className="my-3">
        <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
          <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300 border-b border-gray-700 flex justify-between items-center">
            <span>{language}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(code);
              }}
              className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700 transition-colors"
              title="Copy code"
            >
              Copy
            </button>
          </div>
          <div className="overflow-x-auto">
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: "1rem",
                backgroundColor: "transparent",
                fontSize: "0.875rem",
                lineHeight: "1.5",
              }}
              codeTagProps={{
                className: "font-mono",
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    elements.push(
      <span key={elementKey++} className="whitespace-pre-wrap">
        {renderInlineCode(remainingText)}
      </span>
    );
  }

  return elements.length > 0
    ? elements
    : [
        <span key={0} className="whitespace-pre-wrap">
          {renderInlineCode(content)}
        </span>,
      ];
};

// Helper function to render inline code
const renderInlineCode = (text: string) => {
  const inlineCodeRegex = /`([^`]+)`/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    // Add text before inline code
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add inline code
    parts.push(
      <code
        key={key++}
        className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
      >
        {match[1]}
      </code>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 1 ? parts : text;
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-center" : "justify-start"} mb-4`}>
      <div
        className={`max-w-full rounded-lg px-4 py-2 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white border border-gray-200 text-gray-900 w-full"
        }`}
      >
        <div className="prose prose-sm">
          {renderMessageContent(message.content)}
        </div>
        <div className="text-xs opacity-70 mt-2">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
