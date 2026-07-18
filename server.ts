import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON payloads with generous limit for base64 images
  app.use(express.json({ limit: "15mb" }));

  // API route for receipt analysis
  app.post("/api/analyze-receipt", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing image data" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      // Parse data URL: e.g. "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: "Invalid image format. Must be a valid base64 data URL." });
      }

      const mimeType = match[1];
      const base64Data = match[2];

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: "Analyze this grocery/store receipt image. Extract the grand total amount, a brief description summarizing the purchase (under 5 words, e.g. 'Trader Joe's Groceries', 'Costco Supplies'), and choose the most suitable category from: 'Groceries', 'Utilities', 'Supplies', 'Pantry', 'Other'.",
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: {
                type: Type.NUMBER,
                description: "The grand total amount on the receipt as a float/decimal.",
              },
              description: {
                type: Type.STRING,
                description: "A highly concise description (max 5 words) representing the store/items.",
              },
              category: {
                type: Type.STRING,
                description: "One of these exact strings: 'Groceries', 'Utilities', 'Supplies', 'Pantry', 'Other'.",
              },
            },
            required: ["amount", "description", "category"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response text from Gemini API");
      }

      const parsedData = JSON.parse(text.trim());
      res.json(parsedData);
    } catch (error: any) {
      console.error("Receipt analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze receipt" });
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
