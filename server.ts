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
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
} catch (error) {
  console.error('Failed to initialize Gemini API:', error);
}

// Resilient helper to call Gemini with model fallback, timeout protection, and fast recovery
async function generateWithFallback(params: {
  contents: any;
  config?: any;
  timeoutMs?: number;
}) {
  if (!ai) {
    throw new Error('Gemini API not configured');
  }

  const timeoutDuration = params.timeoutMs || 4500;
  // Primary model gemini-3.8-flash; fallback to gemini-3.1-flash-lite if 503 (high demand) or unavailable
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('503: Model experiencing high demand (timeout)')), timeoutDuration)
        ),
      ]);
      return response;
    } catch (err: any) {
      lastError = err;
      const errStr = String(err?.message || err);
      console.warn(`Model ${model} unavailable or experiencing high demand: ${errStr.slice(0, 100)}`);
    }
  }

  throw lastError;
}

// Rule-based fallback summary when API experiences high demand (503) or quota limits
function generateRuleBasedSummary(metrics: any, language: string): string {
  const isNe = language === 'ne';
  const inc = Number(metrics?.totalIncome) || 0;
  const exp = Number(metrics?.totalExpense) || 0;
  const profit = Number(metrics?.netProfit) || (inc - exp);
  const lowStock = Number(metrics?.lowStockCount) || 0;
  const tasks = Number(metrics?.pendingTasks) || 0;
  const emp = Number(metrics?.activeEmployees) || 0;
  const leases = Number(metrics?.activeLeases) || 0;

  if (isNe) {
    const lines = [
      `• कुल आम्दानी रु. ${inc.toLocaleString()} र खर्च रु. ${exp.toLocaleString()} रहेको छ (खुद नाफा: रु. ${profit.toLocaleString()})।`,
    ];
    if (lowStock > 0) {
      lines.push(`• तत्काल ध्यान दिनुपर्ने: ${lowStock} वटा सामानको मौज्दात न्यून (Low Stock) अवस्थामा छ।`);
    } else {
      lines.push(`• सामानको मौज्दात स्थिति सामान्य छ, मौज्दात अभाव देखिएको छैन।`);
    }
    if (tasks > 0) {
      lines.push(`• हाल ${tasks} वटा कृषि कार्यहरू बाँकी छन् र ${emp} जना कर्मचारी सक्रिय छन्।`);
    } else {
      lines.push(`• सक्रिय जग्गा सम्झौता: ${leases} वटा। सम्पूर्ण नियमित कार्यहरू समयमै भइरहेका छन्।`);
    }
    return lines.join('\n');
  } else {
    const lines = [
      `• Total revenue is Rs. ${inc.toLocaleString()} with expenses of Rs. ${exp.toLocaleString()} (Net Profit: Rs. ${profit.toLocaleString()}).`,
    ];
    if (lowStock > 0) {
      lines.push(`• Action required: ${lowStock} inventory items are running low in stock.`);
    } else {
      lines.push(`• Inventory levels are healthy with no critical shortages.`);
    }
    if (tasks > 0) {
      lines.push(`• Currently ${tasks} tasks are pending with ${emp} active staff members.`);
    } else {
      lines.push(`• ${leases} active land leases recorded. Operations are running smoothly.`);
    }
    return lines.join('\n');
  }
}

// AI Summary Endpoint
app.post('/api/ai/summary', async (req, res) => {
  const { metrics, language } = req.body || { language: 'en' };

  if (!ai) {
    return res.json({ summary: generateRuleBasedSummary(metrics, language) });
  }

  try {
    const prompt = `As an expert agricultural manager, provide a short, actionable daily summary based on these farm metrics:
${JSON.stringify(metrics)}

Keep the response to 2-3 short bullet points. Provide the response in ${language === 'ne' ? 'Nepali language' : 'English language'}.`;

    const response = await generateWithFallback({
      contents: prompt,
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    const errString = String(error?.message || error);
    const status = error?.status || error?.code || error?.error?.code;
    const isTransientOrUnavailable =
      status === 503 ||
      status === 429 ||
      errString.includes('503') ||
      errString.includes('UNAVAILABLE') ||
      errString.includes('high demand') ||
      errString.includes('RESOURCE_EXHAUSTED');

    if (isTransientOrUnavailable) {
      console.warn('Gemini API high demand / temporary spike (503/429). Serving fallback summary seamlessly.');
      return res.json({ summary: generateRuleBasedSummary(metrics, language) });
    }

    console.error('Error generating summary:', error);
    // Even on other errors, provide the rule-based summary to keep the user experience seamless
    res.json({ summary: generateRuleBasedSummary(metrics, language) });
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

    const response = await generateWithFallback({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: req.file.mimetype,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    let resultText = response.text || '{}';
    // Clean up potential markdown formatting
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedData = JSON.parse(resultText);
    res.json(parsedData);
  } catch (error: any) {
    const errString = String(error?.message || error);
    const status = error?.status || error?.code || error?.error?.code;
    const isUnavailable =
      status === 503 ||
      status === 429 ||
      errString.includes('503') ||
      errString.includes('UNAVAILABLE') ||
      errString.includes('high demand') ||
      errString.includes('RESOURCE_EXHAUSTED');

    if (isUnavailable) {
      console.warn('Receipt parser model high demand / rate limit:', errString);
      return res.status(503).json({
        error: 'AI service is temporarily experiencing high demand. Please retry in a few seconds or enter details manually.',
      });
    }

    console.error('Error parsing receipt:', error);
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
