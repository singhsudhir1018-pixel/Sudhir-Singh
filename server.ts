import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// Initialize Gemini
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (error) {
  console.error('Failed to initialize Gemini API:', error);
}

// AI Summary Endpoint
app.post('/api/ai/summary', async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: 'Gemini API not configured' });
  }
  
  const { metrics, language } = req.body || { language: 'en' };
  
  try {
    const prompt = `As an expert agricultural manager, provide a short, actionable daily summary based on these farm metrics:
    ${JSON.stringify(metrics)}
    
    Keep the response to 2-3 short bullet points. Provide the response in ${language === 'ne' ? 'Nepali language' : 'English language'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });
    
    res.json({ summary: response.text });
  } catch (error: any) {
    const errString = String(error);
    const isQuotaError = errString.includes('429') || errString.includes('RESOURCE_EXHAUSTED') || error?.status === 429;
    
    if (!isQuotaError) {
      console.error('Error generating summary:', error);
    }
    
    // Graceful fallback for 429 Quota Exceeded
    if (isQuotaError) {
      const fallbackMsg = language === 'ne' 
        ? '🤖 AI सेवाको दैनिक नि:शुल्क सीमा (Quota) नाघेको छ। कृपया भोलि फेरि प्रयास गर्नुहोस्।' 
        : '🤖 AI daily free quota exceeded. Please try again tomorrow.';
      return res.json({ summary: fallbackMsg });
    }

    res.status(500).json({ error: 'Failed to generate AI summary' });
  }
});

// AI Receipt Parser (Image-to-JSON OCR)
app.post('/api/ai/parse-receipt', upload.single('receipt'), async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: 'Gemini API not configured' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    const base64Data = req.file.buffer.toString('base64');
    
    const prompt = `Analyze this farm receipt or bill. Extract the following details into a JSON object exactly matching this schema:
    {
      "amount": number (total amount),
      "category": string (e.g., Feed, Fertilizer, Seed, Medicine, General),
      "partyName": string (name of the supplier or buyer),
      "dateBS": string (if available, parse or estimate the Nepali Date in YYYY Month DD format, else leave empty),
      "type": string (either "EXPENSE" if it's a purchase/bill, or "INCOME" if it's a sale receipt)
    }
    Only output the raw JSON object, no markdown formatting or backticks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: req.file.mimetype,
              }
            },
            { text: prompt }
          ]
        }
      ]
    });
    
    let resultText = response.text || '{}';
    // Clean up potential markdown formatting
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(resultText);
    res.json(parsedData);
  } catch (error: any) {
    const errString = String(error);
    const isQuotaError = errString.includes('429') || errString.includes('RESOURCE_EXHAUSTED') || error?.status === 429;
    
    if (!isQuotaError) {
      console.error('Error parsing receipt:', error);
    }
    
    // Graceful fallback for 429 Quota Exceeded
    if (isQuotaError) {
      return res.status(429).json({ error: 'AI daily free quota exceeded. Please enter details manually.' });
    }

    res.status(500).json({ error: 'Failed to parse receipt' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
