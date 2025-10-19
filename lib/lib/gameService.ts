import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  query, 
  orderBy, 
  limit,
  updateDoc,
  increment,
  Timestamp 
} from 'firebase/firestore';

export interface Question {
  q: string;
  a: string[];
  correct: number;
  hint?: string;
}

export interface Game {
  id?: string;
  title: string;
  topic: string;
  difficulty: string;
  plays: number;
  rating: number;
  questions: Question[];
  createdAt?: any;
  accessCode: string;
}

// Spiel speichern
export async function saveGame(game: Game): Promise<string> {
  try {
    const gameData = {
      ...game,
      createdAt: Timestamp.now(),
      plays: 0,
      rating: 0
    };
    
    const docRef = await addDoc(collection(db, 'games'), gameData);
    console.log('Spiel gespeichert mit ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    throw error;
  }
}

// Spiel mit Code laden
export async function loadGameByCode(accessCode: string): Promise<Game | null> {
  try {
    const gamesRef = collection(db, 'games');
    const snapshot = await getDocs(gamesRef);
    
    let foundGame: Game | null = null;
    
    snapshot.forEach((doc) => {
      const data = doc.data() as Game;
      if (data.accessCode === accessCode) {
        foundGame = {
          ...data,
          id: doc.id
        };
      }
    });
    
    return foundGame;
  } catch (error) {
    console.error('Fehler beim Laden:', error);
    return null;
  }
}

// Alle Spiele laden
export async function loadAllGames(): Promise<Game[]> {
  try {
    const gamesRef = collection(db, 'games');
    const q = query(gamesRef, orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    
    const games: Game[] = [];
    snapshot.forEach((doc) => {
      games.push({
        ...doc.data() as Game,
        id: doc.id
      });
    });
    
    return games;
  } catch (error) {
    console.error('Fehler beim Laden aller Spiele:', error);
    return [];
  }
}

// Spiel-Statistik aktualisieren
export async function updateGameStats(gameId: string, won: boolean, score: number) {
  try {
    if (!gameId) return;
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      plays: increment(1)
    });
    
    console.log('Statistik aktualisiert');
  } catch (error) {
    console.error('Fehler beim Aktualisieren:', error);
  }
}