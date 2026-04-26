import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON body parser for base64 images
  app.use(express.json({ limit: "10mb" }));

  // Initialize Gemini
  const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenAI({ apiKey: API_KEY || "" });

  // API routes
  app.post("/api/process-image", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;

      if (!API_KEY) {
        return res.status(500).json({ error: "Missing Gemini API Key on server." });
      }

      if (!base64Data || !mimeType) {
        return res.status(400).json({ error: "Missing image data or mime type." });
      }

      const prompt = `提取图片中的所有汉字。1. 如果提取到的是单个汉字，请为每个字生成一个常用的2-4字词组。2. 如果提取到的是现成的词组，则直接保留。3. 请只返回汉字列表。输出格式：JSON数组，例如 ["词语1", "词语2"]`;

      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      });

      const result = JSON.parse(response.text || "[]");
      res.json({ result });
    } catch (error: any) {
      console.error("Server GEMINI Error:", error);
      res.status(500).json({ 
        error: "Gemini processing failed on server.", 
        details: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
