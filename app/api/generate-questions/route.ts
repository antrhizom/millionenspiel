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
      Each question must have 4 answer options ('a'), a correct answer index ('correct'), and an optional hint ('hint') for levels 4-6.
      You must only respond with a valid JSON array of question objects, without any surrounding text or markdown.
    `;

    const userPrompt = `
      Please generate the 18 questions based on the following details.
      - Difficulty: ${difficulty}
      - Topic: ${topic}
      - Source Text: """${text}"""
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Or another suitable model like "gpt-3.5-turbo"
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      // This tells the model to always return a JSON object
      response_format: { type: "json_object" }, 
    });

    const responseText = completion.choices[0].message.content;

    if (!responseText) {
        throw new Error('Die KI hat keine Antwort zurückgegeben.');
    }
    
    // The response from the model should be a JSON object containing a "questions" array
    // E.g., { "questions": [...] }
    let questionsData: { questions: Question[] };
    try {
        questionsData = JSON.parse(responseText);
    } catch (parseError: unknown) {
      console.error("Fehler beim Parsen der JSON-Antwort von OpenAI:", responseText);
      const errorMessage = parseError instanceof Error ? parseError.message : "Unbekannter Parse-Fehler";
      throw new Error(`Ungültiges JSON-Format von OpenAI erhalten. Details: ${errorMessage}`);
    }

    const questions = questionsData.questions;

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Die KI hat keine gültige Fragenliste im JSON-Format zurückgegeben.');
    }
    
    return NextResponse.json({ questions });

  } catch (error: unknown) {
    console.error("Fehler in /api/generate-questions:", error);
    const message = error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}