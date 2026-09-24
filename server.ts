import express from 'express';
import path from 'path';
import { createServer as createViteServer, createLogger } from 'vite';
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
} catch {
  // Silent fallback to rule-based engine
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

  const timeoutDuration = params.timeoutMs || 3000;
  // Fallback models in priority order
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
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutDuration)
        ),
      ]);
      if (response) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
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

    if (response?.text) {
      return res.json({ summary: response.text });
    }
    return res.json({ summary: generateRuleBasedSummary(metrics, language) });
  } catch {
    // Seamlessly provide rule-based agricultural summary without exposing internal demand spikes
    res.json({ summary: generateRuleBasedSummary(metrics, language) });
  }
});

// AI Receipt Parser (Image-to-JSON OCR)
app.post('/api/ai/parse-receipt', upload.single('receipt'), async (req, res) => {
  if (!ai) {
    return res.json({
      success: false,
      unavailable: true,
      message: 'AI receipt scanner is unavailable. Please enter details manually.',
    });
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
      timeoutMs: 12000,
    });

    let resultText = response.text || '{}';
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedData = JSON.parse(resultText);
    res.json({ success: true, ...parsedData });
  } catch {
    res.json({
      success: false,
      unavailable: true,
      message: 'AI service is temporarily experiencing high demand. Please enter details manually.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const customLogger = createLogger();
    const origWarn = customLogger.warn;
    const origError = customLogger.error;
    customLogger.warn = (msg, options) => {
      if (typeof msg === 'string' && (msg.includes('WebSocket') || msg.includes('[vite]') || msg.includes('vite:'))) return;
      origWarn(msg, options);
    };
    customLogger.error = (msg, options) => {
      if (typeof msg === 'string' && (msg.includes('WebSocket') || msg.includes('[vite]') || msg.includes('vite:'))) return;
      origError(msg, options);
    };

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true' ? undefined : false,
      },
      customLogger,
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
