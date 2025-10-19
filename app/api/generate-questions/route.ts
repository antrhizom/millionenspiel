import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize the OpenAI client
// It automatically reads the OPENAI_API_KEY from the environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

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

    const systemPrompt = `
      You are an assistant that creates multiple-choice questions for a "Who Wants to Be a Millionaire" style game.
      Based on the user's text, you will generate exactly 18 questions.
      - 3 questions for level 1 (easiest)
      - 3 questions for level 2
      - 3 questions for level 3
      - 3 questions for level 4
      - 3 questions for level 5
      - 3 questions for level 6 (hardest)
      
      CRITICAL: Each question MUST have this EXACT structure:
      {
        "level": number (1-6),
        "q": "question text",
        "a": ["answer1", "answer2", "answer3", "answer4"],
        "correct": number (0-3, index of correct answer),
        "hint": "optional hint text for levels 4-6"
      }
      
      The "a" field MUST be an array of exactly 4 strings.
      The "correct" field MUST be a number between 0 and 3.
      
      You must respond with a JSON object with a "questions" array containing exactly 18 question objects.
      Format: { "questions": [ {...}, {...}, ... ] }
      Do not include any markdown, code blocks, or additional text.
    `;

    const userPrompt = `
      Please generate the 18 questions based on the following details.
      - Difficulty: ${difficulty}
      - Topic: ${topic}
      - Source Text: """${text}"""
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }, 
    });

    const responseText = completion.choices[0].message.content;

    if (!responseText) {
        throw new Error('Die KI hat keine Antwort zurückgegeben.');
    }
    
    console.log('🤖 OpenAI Rohantwort (erste 500 Zeichen):', responseText.substring(0, 500));
    
    let questionsData: { questions: Question[] };
    try {
        questionsData = JSON.parse(responseText);
    } catch (parseError: unknown) {
      console.error("❌ Fehler beim Parsen der JSON-Antwort von OpenAI:", responseText);
      const errorMessage = parseError instanceof Error ? parseError.message : "Unbekannter Parse-Fehler";
      throw new Error(`Ungültiges JSON-Format von OpenAI erhalten. Details: ${errorMessage}`);
    }

    const questions = questionsData.questions;

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Die KI hat keine gültige Fragenliste im JSON-Format zurückgegeben.');
    }
    
    // 🔥 VALIDIERUNG: Prüfe jede Frage auf korrektes Format
    const validatedQuestions: Question[] = [];
    const errors: string[] = [];
    
    questions.forEach((q, idx) => {
      const questionNum = idx + 1;
      
      // Prüfe ob q existiert
      if (!q) {
        errors.push(`Frage ${questionNum}: Frage ist null oder undefined`);
        return;
      }
      
      // Prüfe level
      if (typeof q.level !== 'number' || q.level < 1 || q.level > 6) {
        errors.push(`Frage ${questionNum}: Ungültiges Level (${q.level})`);
      }
      
      // Prüfe q (Fragetext)
      if (typeof q.q !== 'string' || q.q.trim() === '') {
        errors.push(`Frage ${questionNum}: Ungültiger Fragetext`);
      }
      
      // 🔥 WICHTIG: Prüfe a (Antworten)
      if (!Array.isArray(q.a)) {
        errors.push(`Frage ${questionNum}: 'a' ist kein Array (Typ: ${typeof q.a})`);
        return; // Überspringe diese Frage komplett
      }
      
      if (q.a.length !== 4) {
        errors.push(`Frage ${questionNum}: 'a' hat ${q.a.length} Antworten, benötigt aber genau 4`);
      }
      
      // Prüfe ob alle Antworten Strings sind
      const invalidAnswers = q.a.filter((answer, i) => typeof answer !== 'string');
      if (invalidAnswers.length > 0) {
        errors.push(`Frage ${questionNum}: Einige Antworten sind keine Strings`);
      }
      
      // Prüfe correct Index
      if (typeof q.correct !== 'number' || q.correct < 0 || q.correct >= q.a.length) {
        errors.push(`Frage ${questionNum}: Ungültiger correct Index (${q.correct})`);
      }
      
      // Wenn keine Fehler für diese Frage, füge sie hinzu
      if (errors.length === validatedQuestions.length * 0) { // Trick: zähle nur neue Fehler
        validatedQuestions.push(q);
      }
    });
    
    console.log(`✅ Validierung: ${validatedQuestions.length}/${questions.length} Fragen gültig`);
    
    if (errors.length > 0) {
      console.error('⚠️ Validierungsfehler:', errors);
      
      // Wenn zu viele Fehler, komplett ablehnen
      if (validatedQuestions.length < 15) {
        throw new Error(`KI hat ungültige Fragen generiert. Fehler: ${errors.join('; ')}`);
      }
    }
    
    if (validatedQuestions.length === 0) {
      throw new Error('Keine gültigen Fragen nach Validierung übrig.');
    }
    
    // Log erste Frage zur Überprüfung
    console.log('📋 Erste validierte Frage:', JSON.stringify(validatedQuestions[0], null, 2));
    
    return NextResponse.json({ questions: validatedQuestions });

  } catch (error: unknown) {
    console.error("❌ Fehler in /api/generate-questions:", error);
    const message = error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}