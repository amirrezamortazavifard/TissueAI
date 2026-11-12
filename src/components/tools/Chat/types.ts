export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  tokens?: number;
  model?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model?: string;
}

export interface ChatSettings {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  streamResponses: boolean;
}

export const defaultChatSettings: ChatSettings = {
  apiEndpoint: "http://localhost:11434/v1",
  apiKey: "",
  model: "gpt-3.5-turbo",
  systemPrompt: "You are a helpful assistant specializing in histopathology and tissue analysis. Be concise and accurate.",
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  streamResponses: true,
};
