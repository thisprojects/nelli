// app/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { messages, conversationId } = await request.json();

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Make request to Ollama with full conversation context
          const ollamaResponse = await fetch(
            "http://localhost:11434/api/chat",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gemma3:12b", // or your preferred model
                messages: messages, // Send all messages for context
                stream: true,
              }),
            }
          );

          if (!ollamaResponse.ok) {
            throw new Error(`Ollama API error: ${ollamaResponse.status}`);
          }

          const reader = ollamaResponse.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error("No response body from Ollama");
          }

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Send final done signal
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
              );
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line);

                if (data.message?.content) {
                  // Send token to client
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        token: data.message.content,
                      })}\n\n`
                    )
                  );
                }

                if (data.done) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ done: true })}\n\n`
                    )
                  );
                  break;
                }
              } catch (parseError) {
                console.error("Error parsing Ollama response:", parseError);
              }
            }
          }
        } catch (error) {
          console.error("Error in chat API:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error:
                  "Failed to connect to Ollama. Please ensure it is running.",
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
