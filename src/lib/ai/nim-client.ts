import OpenAI from "openai";

const nimClient = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY || "",
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export { nimClient };
