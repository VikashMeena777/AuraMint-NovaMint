import OpenAI from "openai";

let _nimClient: OpenAI | null = null;

export function getNimClient(): OpenAI | null {
  if (_nimClient) return _nimClient;

  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) return null;

  _nimClient = new OpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  return _nimClient;
}

// Keep backward-compatible named export (lazy getter)
export const nimClient = {
  get chat() {
    const client = getNimClient();
    if (!client) throw new Error("NVIDIA NIM API key not configured");
    return client.chat;
  },
};
