import { createOpenAI } from "@ai-sdk/openai";
import { streamText, UIMessage } from "ai";
import { killDesktop } from "@/lib/e2b/utils";
import { computerTool } from "@/lib/e2b/tool";
import { prunedMessages } from "@/lib/utils";

// Allow streaming responses up to 30 seconds
export const maxDuration = 300;

// Create XAI client with environment variable
const xai = createOpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY
});

export async function POST(req: Request) {
  const { messages, sandboxId }: { messages: UIMessage[]; sandboxId: string } =
    await req.json();
  try {
    const result = streamText({
      model: xai("grok-4-fast-non-reasoning"),
      system:
        "Twoim zadaniem jest sterowanie wirtualnym pulpitem w celu wykonywania określonych działań. " +
        "ZAWSZE rozpoczynaj swoją interakcję od wykonania zrzutu ekranu (screenshot) — to kluczowe dla oceny aktualnego stanu pulpitu przed podjęciem dalszych akcji. " +
        "Dostępne akcje: screenshot, wait, left_click, double_click, right_click, mouse_move, type, key, scroll, left_click_drag, bash. " +
        "Współrzędne w formacie [x, y]. Maksymalny czas oczekiwania to 2 sekundy. " +
        "Przewijanie z kierunkiem 'up' lub 'down' i określoną ilością. " +
        "Możesz wykonywać polecenia bash w terminalu Linux.",
      messages: prunedMessages(messages),
      tools: { computer: computerTool(sandboxId) },
    });

    // Create response stream
    const response = result.toDataStreamResponse({
      // @ts-expect-error eheljfe
      getErrorMessage(error) {
        console.error(error);
        return error;
      },
    });

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    await killDesktop(sandboxId); // Force cleanup on error
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
