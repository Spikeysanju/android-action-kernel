/**
 * LLM Provider module for Android Action Kernel.
 * Supports OpenAI, Groq, AWS Bedrock, and OpenRouter (via Vercel AI SDK).
 */

import OpenAI from "openai";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import { Config } from "./config.js";
import {
  GROQ_API_BASE_URL,
  BEDROCK_ANTHROPIC_MODELS,
  BEDROCK_META_MODELS,
} from "./constants.js";
import type { ActionDecision } from "./actions.js";

// System prompt for the Android agent
const SYSTEM_PROMPT = `
You are an Android Driver Agent. Your job is to achieve the user's goal by navigating the UI.

You will receive:
1. The User's Goal.
2. A list of interactive UI elements (JSON) with their (x,y) center coordinates.
3. Your previous actions (so you don't repeat yourself).

You must output ONLY a valid JSON object with your next action.

Available Actions:
- {"action": "tap", "coordinates": [x, y], "reason": "Why you are tapping"}
- {"action": "type", "text": "Hello World", "reason": "Why you are typing"}
- {"action": "enter", "reason": "Press Enter to submit/search"}
- {"action": "swipe", "direction": "up/down/left/right", "reason": "Why you are swiping"}
- {"action": "home", "reason": "Go to home screen"}
- {"action": "back", "reason": "Go back"}
- {"action": "wait", "reason": "Wait for loading"}
- {"action": "done", "reason": "Task complete"}

IMPORTANT RULES:
- If an element has "editable": true or "action": "type", use the "type" action to enter text.
- After tapping on a text field, your NEXT action should be "type" to enter text.
- After typing a URL or search query, use "enter" to submit it.
- Do NOT type the same text again if you already typed it in a previous step. Check PREVIOUS_ACTIONS.
- Do NOT tap the same element repeatedly. If you already tapped it, try a different action.
- If the screen shows your typed text, do NOT type again - use "enter" or tap a search result.
- If you need to find an app that's not on the home screen, swipe UP to open the app drawer.
- Use swipe to scroll through lists, pages, or to open the app drawer.

Example - Tapping a button:
{"action": "tap", "coordinates": [540, 1200], "reason": "Clicking the 'Connect' button"}

Example - Typing in a search box:
{"action": "type", "text": "White House", "reason": "Entering search query"}

Example - After typing a URL:
{"action": "enter", "reason": "Submitting the URL to navigate"}

Example - Opening app drawer to find an app:
{"action": "swipe", "direction": "up", "reason": "Opening app drawer to find Maps"}
`;

interface ActionHistoryEntry {
  action?: string;
  reason?: string;
  text?: string;
  coordinates?: [number, number];
}

function formatActionHistory(actionHistory: ActionHistoryEntry[]): string {
  if (actionHistory.length === 0) return "";

  const lines = actionHistory.map((entry, i) => {
    const actionType = entry.action ?? "unknown";
    const reason = entry.reason ?? "N/A";

    if (actionType === "type") {
      return `Step ${i + 1}: typed "${entry.text ?? ""}" - ${reason}`;
    }
    if (actionType === "tap") {
      return `Step ${i + 1}: tapped ${JSON.stringify(entry.coordinates ?? [])} - ${reason}`;
    }
    return `Step ${i + 1}: ${actionType} - ${reason}`;
  });

  return "\n\nPREVIOUS_ACTIONS:\n" + lines.join("\n");
}

/**
 * Abstract interface for LLM providers.
 */
export interface LLMProvider {
  getDecision(
    goal: string,
    screenContext: string,
    actionHistory: ActionHistoryEntry[]
  ): Promise<ActionDecision>;
}

/**
 * OpenAI and Groq provider (OpenAI-compatible API).
 */
class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    if (Config.LLM_PROVIDER === "groq") {
      this.client = new OpenAI({
        apiKey: Config.GROQ_API_KEY,
        baseURL: GROQ_API_BASE_URL,
      });
      this.model = Config.GROQ_MODEL;
    } else {
      this.client = new OpenAI({ apiKey: Config.OPENAI_API_KEY });
      this.model = Config.OPENAI_MODEL;
    }
  }

  async getDecision(
    goal: string,
    screenContext: string,
    actionHistory: ActionHistoryEntry[]
  ): Promise<ActionDecision> {
    const historyStr = formatActionHistory(actionHistory);
    const userContent = `GOAL: ${goal}\n\nSCREEN_CONTEXT:\n${screenContext}${historyStr}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    return JSON.parse(response.choices[0].message.content ?? "{}");
  }
}

/**
 * OpenRouter provider using Vercel AI SDK.
 * Access 200+ models (Claude, GPT-4, Llama, Gemini, Mistral, etc.) through a single API.
 */
class OpenRouterProvider implements LLMProvider {
  private openrouter: ReturnType<typeof createOpenRouter>;
  private model: string;

  constructor() {
    this.openrouter = createOpenRouter({
      apiKey: Config.OPENROUTER_API_KEY,
    });
    this.model = Config.OPENROUTER_MODEL;
  }

  async getDecision(
    goal: string,
    screenContext: string,
    actionHistory: ActionHistoryEntry[]
  ): Promise<ActionDecision> {
    const historyStr = formatActionHistory(actionHistory);
    const userContent = `GOAL: ${goal}\n\nSCREEN_CONTEXT:\n${screenContext}${historyStr}`;

    const result = await generateText({
      model: this.openrouter.chat(this.model),
      system: SYSTEM_PROMPT,
      prompt: userContent + "\n\nRespond with ONLY a valid JSON object.",
    });

    return this.parseJsonResponse(result.text);
  }

  private parseJsonResponse(text: string): ActionDecision {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[^{}]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      console.log(`Warning: Could not parse LLM response: ${text.slice(0, 200)}`);
      return { action: "wait", reason: "Failed to parse response, waiting" };
    }
  }
}

/**
 * AWS Bedrock provider.
 */
class BedrockProvider implements LLMProvider {
  private client: BedrockRuntimeClient;
  private model: string;

  constructor() {
    this.client = new BedrockRuntimeClient({ region: Config.AWS_REGION });
    this.model = Config.BEDROCK_MODEL;
  }

  async getDecision(
    goal: string,
    screenContext: string,
    actionHistory: ActionHistoryEntry[]
  ): Promise<ActionDecision> {
    const historyStr = formatActionHistory(actionHistory);
    const userContent = `GOAL: ${goal}\n\nSCREEN_CONTEXT:\n${screenContext}${historyStr}`;

    const requestBody = this.buildRequest(userContent);

    const command = new InvokeModelCommand({
      modelId: this.model,
      body: new TextEncoder().encode(requestBody),
      contentType: "application/json",
      accept: "application/json",
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const resultText = this.extractResponse(responseBody);

    return this.parseJsonResponse(resultText);
  }

  private isAnthropicModel(): boolean {
    return BEDROCK_ANTHROPIC_MODELS.some((id) => this.model.includes(id));
  }

  private isMetaModel(): boolean {
    return BEDROCK_META_MODELS.some((id) =>
      this.model.toLowerCase().includes(id)
    );
  }

  private buildRequest(userContent: string): string {
    if (this.isAnthropicModel()) {
      return JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              userContent + "\n\nRespond with ONLY a valid JSON object.",
          },
        ],
      });
    }

    if (this.isMetaModel()) {
      return JSON.stringify({
        prompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${SYSTEM_PROMPT}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${userContent}\n\nRespond with ONLY a valid JSON object, no other text.<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
        max_gen_len: 512,
        temperature: 0.1,
      });
    }

    return JSON.stringify({
      inputText: `${SYSTEM_PROMPT}\n\n${userContent}\n\nRespond with ONLY a valid JSON object.`,
      textGenerationConfig: {
        maxTokenCount: 512,
        temperature: 0.1,
      },
    });
  }

  private extractResponse(responseBody: Record<string, any>): string {
    if (this.isAnthropicModel()) {
      return responseBody.content[0].text;
    }
    if (this.isMetaModel()) {
      return responseBody.generation ?? "";
    }
    return responseBody.results[0].outputText;
  }

  private parseJsonResponse(text: string): ActionDecision {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[^{}]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      console.log(`Warning: Could not parse LLM response: ${text.slice(0, 200)}`);
      return { action: "wait", reason: "Failed to parse response, waiting" };
    }
  }
}

/**
 * Factory function to get the appropriate LLM provider.
 */
export function getLlmProvider(): LLMProvider {
  if (Config.LLM_PROVIDER === "bedrock") {
    return new BedrockProvider();
  }
  if (Config.LLM_PROVIDER === "openrouter") {
    return new OpenRouterProvider();
  }
  return new OpenAIProvider();
}
