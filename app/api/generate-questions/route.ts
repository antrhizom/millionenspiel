import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, difficulty, topic } = await request.json();

    const prompt = `Du bist ein Quiz-Generator für ein Millionenspiel. Erstelle EXAKT 18 Multiple-Choice-Fragen basierend auf folgendem Text.

WICHTIG: Die Fragen müssen in 6 Level unterteilt werden (Level 1-6), mit EXAKT 3 Fragen pro Level.

Level-Struktur:
- Level 1 (10 CHF): 3 sehr einfache Fragen - Sprachlogik und Allgemeinwissen
- Level 2 (100 CHF): 3 einfache Fragen - Grundwissen zum Thema
- Level 3 (1.000 CHF): 3 mittlere Fragen - Detailwissen
- Level 4 (10.000 CHF): 3 anspruchsvolle Fragen - Spezifisches Wissen
- Level 5 (100.000 CHF): 3 schwere Fragen - Expertenwissen
- Level 6 (1.000.000 CHF): 3 sehr schwere Fragen - Detailliertes Expertenwissen

Thema: ${topic}
Schwierigkeit: ${difficulty}

Text:
${text}

Antworte NUR mit einem JSON-Array. Jede Frage muss EXAKT diese Struktur haben:
{
  "level": 1-6,
  "q": "Frage?",
  "a": ["Antwort A", "Antwort B", "Antwort C", "Antwort D"],
  "correct": 0-3,
  "hint": "Hilfreicher Hinweis"
}

WICHTIG: Erstelle ALLE 18 Fragen (6 Level × 3 Fragen). Antworte NUR mit dem JSON-Array, ohne Markdown-Code-Blöcke oder Erklärungen.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0].message.content || '';
    
    // Entferne Markdown-Code-Blöcke falls vorhanden
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const questions = JSON.parse(cleanedText);

    // Validierung: Genau 18 Fragen
    if (!Array.isArray(questions) || questions.length !== 18) {
      console.error(`❌ Erwartete 18 Fragen, erhielt ${questions.length}`);
      throw new Error(`Erwartete 18 Fragen, erhielt ${questions.length}`);
    }

    // Validierung: Jedes Level hat 3 Fragen
    for (let level = 1; level <= 6; level++) {
      const levelQuestions = questions.filter((q: any) => q.level === level);
      if (levelQuestions.length !== 3) {
        console.error(`❌ Level ${level} hat ${levelQuestions.length} Fragen statt 3`);
        throw new Error(`Level ${level} hat ${levelQuestions.length} Fragen statt 3`);
      }
    }

    console.log('✅ 18 Fragen erfolgreich generiert');
    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('❌ Fehler bei Fragengenerierung:', error);
    return NextResponse.json(
      { error: error.message || 'Fehler bei der Fragengenerierung' },
      { status: 500 }
    );
  }
}