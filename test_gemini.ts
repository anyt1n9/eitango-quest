import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log("API Key exists:", !!apiKey);

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Hello, tell me a 1-word greeting.",
    });
    console.log("Gemini response:", response.text ? response.text.trim() : "");
  } catch (err: any) {
    console.error("Gemini failed:", err.message);
  }
}

test();
