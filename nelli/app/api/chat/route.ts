import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message, conversationId } = await request.json();

    if (!message) {
      return new Response(
        `data: ${JSON.stringify({ error: "Message is required" })}\n\n`,
        {
          status: 400,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    // Make request to Ollama with streaming enabled
    const ollamaResponse = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemma3:12b",
        prompt: message,
        stream: true,
      }),
    });

    if (!ollamaResponse.ok) {
      return new Response(
        `data: ${JSON.stringify({
          error: `Ollama API error: ${ollamaResponse.status}`,
        })}\n\n`,
        {
          status: 500,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Create transform stream that converts Ollama's format to SSE format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          try {
            const data = JSON.parse(trimmedLine);

            // Forward each token immediately as SSE
            if (data.response) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    token: data.response,
                    done: data.done || false,
                    conversationId,
                  })}\n\n`
                )
              );
            }

            // Send completion signal
            if (data.done) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    done: true,
                    conversationId,
                  })}\n\n`
                )
              );
            }
          } catch (parseError) {
            // Skip malformed JSON lines
            console.warn("Failed to parse Ollama response line:", trimmedLine);
          }
        }
      },

      flush(controller) {
        // Ensure stream is properly closed
        controller.terminate();
      },
    });

    // Pipe Ollama's response directly through our transform stream
    const stream = ollamaResponse.body!.pipeThrough(transformStream);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      `data: ${JSON.stringify({ error: "Failed to process request" })}\n\n`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }
}
