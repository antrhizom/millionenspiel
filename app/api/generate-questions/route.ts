import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Define the expected structure for questions
interface Question {
  level: number;
  q: string;
  a: string[];
  correct: number;
  hint?: string;
}

export async function POST(request: Request) {
  try {
    const { text, difficulty, topic } = await request.json();

    if (!text || !difficulty || !topic) {
      return NextResponse.json({ error: 'Fehlende Parameter: text, difficulty und topic werden benötigt.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Erstelle basierend auf dem folgenden Text ein Set von 18 Multiple-Choice-Fragen für ein "Wer wird Millionär"-Spiel.
      Die Fragen sollen sich auf den Inhalt des Textes beziehen.

      Regeln:
      1.  **Struktur**: Erstelle genau 18 Fragen.
      2.  **Schwierigkeit**: Passe die Schwierigkeit der Fragen an das Level "${difficulty}" an.
      3.  **Thema**: Berücksichtige das Thema "${topic}".
      4.  **Levels**: Ordne jeweils 3 Fragen den folgenden Levels zu: 1, 2, 3, 4, 5, 6. Level 1 ist am einfachsten, Level 6 am schwersten.
      5.  **Antworten**: Jede Frage muss 4 Antwortmöglichkeiten haben (Array 'a').
      6.  **Korrekte Antwort**: Gib den Index (0-3) der korrekten Antwort im Feld 'correct' an.
      7.  **Hinweis (Optional)**: Füge für schwierigere Fragen (Level 4-6) optional ein kurzes, hilfreiches 'hint'-Feld hinzu.
      8.  **Format**: Gib das Ergebnis als valides JSON-Array von Frage-Objekten zurück, ohne umschliessendes Markdown. Jedes Objekt muss die Felder 'level', 'q', 'a' und 'correct' enthalten.

      Textgrundlage:
      """
      ${text}
      """

      Beispiel-JSON-Struktur für eine Frage:
      {
        "level": 1,
        "q": "Wie heisst die Hauptstadt der Schweiz?",
        "a": ["Zürich", "Genf", "Bern", "Basel"],
        "correct": 2,
        "hint": "Es ist die Bundesstadt."
      }
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();
    
    // Attempt to parse the JSON response from the model
    let questions: Question[];
    try {
      questions = JSON.parse(responseText);
    } catch (parseError: unknown) {
      console.error("Fehler beim Parsen der JSON-Antwort der KI:", responseText);
      // Explicitly check if it's an Error instance
      const errorMessage = parseError instanceof Error ? parseError.message : "Unbekannter Parse-Fehler";
      throw new Error(`Ungültiges JSON-Format von der KI erhalten. Details: ${errorMessage}`);
    }

    // Validate the structure of the generated questions
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Die KI hat keine gültige Fragenliste zurückgegeben.');
    }
    
    return NextResponse.json({ questions });

  } catch (error: unknown) {
    console.error("Fehler in /api/generate-questions:", error);
    // Type checking for the error object
    const message = error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}