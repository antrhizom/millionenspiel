import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  Timestamp, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  query, 
  orderBy, 
  limit,
  updateDoc,
  increment,
  arrayUnion,
  getDoc,
  DocumentData 
} from 'firebase/firestore';

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// Interfaces
export interface Question {
  level: number;
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
  ratings?: number[];
  questions: Question[];
  createdAt: Timestamp;
  creator: string;
}

export interface PlayerScore {
  id?: string;
  playerName: string;
  gameId: string;
  gameTitle: string;
  level: number;
  earnedMoney: number;
  completed: boolean;
  timestamp: Timestamp;
}

// Functions
export async function saveGame(game: Omit<Game, 'id' | 'createdAt' | 'plays' | 'rating' | 'ratings'>): Promise<string> {
  try {
    const gameData = {
      ...game,
      createdAt: Timestamp.now(),
      plays: 0,
      rating: 0,
      ratings: []
    };
    
    const docRef = await addDoc(collection(db, 'games'), gameData);
    console.log('Spiel gespeichert mit ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    throw error;
  }
}

export async function loadAllGames(): Promise<Game[]> {
  try {
    const gamesRef = collection(db, 'games');
    const q = query(gamesRef, orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    
    const games: Game[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;
      const game: Game = {
        id: docSnap.id,
        title: data.title,
        topic: data.topic,
        difficulty: data.difficulty,
        plays: data.plays,
        rating: data.rating,
        ratings: data.ratings,
        questions: data.questions,
        createdAt: data.createdAt,
        creator: data.creator,
      };
      games.push(game);
    });
    
    return games;
  } catch (error) {
    console.error('❌ Fehler beim Laden aller Spiele:', error);
    return [];
  }
}

export async function updateGameStats(gameId: string) {
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

export async function addRating(gameId: string, rating: number) {
  try {
    if (!gameId) return;
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      ratings: arrayUnion(rating)
    });
    
    const gameSnap = await getDoc(gameRef);
    if (gameSnap.exists()) {
        const data = gameSnap.data();
        const ratings: number[] = data.ratings || [];
        const avg = ratings.length > 0
            ? ratings.reduce((a, b) => a + b, 0) / ratings.length
            : 0;
        await updateDoc(gameRef, { rating: avg });
    }
    
    console.log('Bewertung hinzugefügt');
  } catch (error) {
    console.error('Fehler beim Bewerten:', error);
  }
}

export async function savePlayerScore(playerScore: Omit<PlayerScore, 'id' | 'timestamp'>): Promise<void> {
  try {
    await addDoc(collection(db, 'playerScores'), {
      ...playerScore,
      timestamp: Timestamp.now()
    });
    console.log('Spieler-Score gespeichert');
  } catch (error) {
    console.error('Fehler beim Speichern des Scores:', error);
  }
}

export async function getPlayerScores(playerName: string): Promise<PlayerScore[]> {
  try {
    const q = query(collection(db, "playerScores"));
    const snapshot = await getDocs(q);
    
    const scores: PlayerScore[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;
      if (data.playerName === playerName) {
        const score: PlayerScore = {
          id: docSnap.id,
          playerName: data.playerName,
          gameId: data.gameId,
          gameTitle: data.gameTitle,
          level: data.level,
          earnedMoney: data.earnedMoney,
          completed: data.completed,
          timestamp: data.timestamp,
        };
        scores.push(score);
      }
    });
    
    return scores.sort((a, b) => b.earnedMoney - a.earnedMoney);
  } catch (error) {
    console.error('Fehler beim Laden der Scores:', error);
    return [];
  }
}

export async function getAllPlayerScores(): Promise<PlayerScore[]> {
  try {
    const scoresRef = collection(db, 'playerScores');
    const snapshot = await getDocs(scoresRef);
    
    const scores: PlayerScore[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData;
      const score: PlayerScore = {
        id: docSnap.id,
        playerName: data.playerName,
        gameId: data.gameId,
        gameTitle: data.gameTitle,
        level: data.level,
        earnedMoney: data.earnedMoney,
        completed: data.completed,
        timestamp: data.timestamp,
      };
      scores.push(score);
    });
    
    return scores.sort((a, b) => b.earnedMoney - a.earnedMoney);
  } catch (error) {
    console.error('Fehler beim Laden aller Scores:', error);
    return [];
  }
}
