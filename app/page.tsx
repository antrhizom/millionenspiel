'use client';

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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
  Timestamp,
  arrayUnion
} from 'firebase/firestore';

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

const LEVELS = [10, 100, 1000, 10000, 100000, 1000000];

interface Question {
  level: number;
  q: string;
  a: string[];
  correct: number;
  hint?: string;
}

interface Game {
  id?: string;
  title: string;
  topic: string;
  difficulty: string;
  plays: number;
  rating: number;
  ratings?: number[];
  questions: Question[];
  createdAt?: any;
  creator: string;
}

interface PlayerScore {
  id?: string;
  playerName: string;
  gameId: string;
  gameTitle: string;
  level: number;
  earnedMoney: number;
  completed: boolean;
  timestamp: any;
}

async function saveGame(game: Game): Promise<string> {
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

async function loadAllGames(): Promise<Game[]> {
  try {
    console.log('🔄 Lade Spiele aus Firebase...');
    const gamesRef = collection(db, 'games');
    const q = query(gamesRef, orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    
    console.log('📊 Anzahl Spiele gefunden:', snapshot.size);
    
    const games: Game[] = [];
    snapshot.forEach((docSnap) => {
      const gameData = docSnap.data() as Game;
      console.log('✅ Spiel geladen:', gameData.title);
      games.push({
        ...gameData,
        id: docSnap.id
      });
    });
    
    console.log('✅ Alle Spiele geladen:', games.length);
    return games;
  } catch (error) {
    console.error('❌ Fehler beim Laden aller Spiele:', error);
    return [];
  }
}

async function updateGameStats(gameId: string, won: boolean) {
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

async function addRating(gameId: string, rating: number) {
  try {
    if (!gameId) return;
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      ratings: arrayUnion(rating)
    });
    
    const gameDoc = await getDocs(query(collection(db, 'games')));
    gameDoc.forEach(async (docSnap) => {
      if (docSnap.id === gameId) {
        const data = docSnap.data();
        const ratings = data.ratings || [];
        const avg = ratings.length > 0 
          ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length 
          : 0;
        await updateDoc(gameRef, { rating: avg });
      }
    });
    
    console.log('Bewertung hinzugefügt');
  } catch (error) {
    console.error('Fehler beim Bewerten:', error);
  }
}

async function savePlayerScore(playerScore: PlayerScore): Promise<void> {
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

async function getPlayerScores(playerName: string): Promise<PlayerScore[]> {
  try {
    const scoresRef = collection(db, 'playerScores');
    const snapshot = await getDocs(scoresRef);
    
    const scores: PlayerScore[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as PlayerScore;
      if (data.playerName === playerName) {
        scores.push({
          ...data,
          id: docSnap.id
        });
      }
    });
    
    return scores.sort((a, b) => b.earnedMoney - a.earnedMoney);
  } catch (error) {
    console.error('Fehler beim Laden der Scores:', error);
    return [];
  }
}

async function getAllPlayerScores(): Promise<PlayerScore[]> {
  try {
    const scoresRef = collection(db, 'playerScores');
    const snapshot = await getDocs(scoresRef);
    
    const scores: PlayerScore[] = [];
    snapshot.forEach((docSnap) => {
      scores.push({
        ...docSnap.data() as PlayerScore,
        id: docSnap.id
      });
    });
    
    return scores.sort((a, b) => b.earnedMoney - a.earnedMoney);
  } catch (error) {
    console.error('Fehler beim Laden aller Scores:', error);
    return [];
  }
}

export default function Home() {
  const [view, setView] = useState<'archive' | 'game' | 'create' | 'dashboard'>('archive');
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [playerName, setPlayerName] = useState<string>('');

  // Lade gespeicherten Nutzernamen beim Start (automatisch)
  useEffect(() => {
    const savedName = localStorage.getItem('millionenspiel_playerName');
    if (savedName) {
      console.log('✅ Gespeicherter Name gefunden:', savedName);
      setPlayerName(savedName);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
      <nav className="bg-black bg-opacity-50 p-4 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold text-yellow-400">💰 Millionenspiel</h1>
          {playerName && (
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setView('archive')}
                className={`px-4 py-2 rounded-lg transition ${
                  view === 'archive' 
                    ? 'bg-white text-purple-900 font-bold' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                📚 Spiele
              </button>
              <button
                onClick={() => setView('create')}
                className={`px-4 py-2 rounded-lg transition ${
                  view === 'create' 
                    ? 'bg-white text-green-900 font-bold' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                ➕ Erstellen
              </button>
              <button
                onClick={() => setView('dashboard')}
                className={`px-4 py-2 rounded-lg transition ${
                  view === 'dashboard' 
                    ? 'bg-white text-orange-900 font-bold' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                📊 Dashboard
              </button>
              <span className="px-4 py-2 bg-white text-purple-900 rounded-lg font-bold">
                👤 {playerName}
              </span>
              <button
                onClick={() => {
                  if (confirm('Möchtest du dich abmelden und einen neuen Namen wählen?')) {
                    localStorage.removeItem('millionenspiel_playerName');
                    setPlayerName('');
                    setView('archive');
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                title="Abmelden"
              >
                🚪
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-8">
        {!playerName ? (
          <PlayerNameInput setPlayerName={setPlayerName} />
        ) : (
          <>
            {view === 'game' && currentGame && <GameView game={currentGame} setView={setView} playerName={playerName} />}
            {view === 'archive' && <ArchiveView setCurrentGame={setCurrentGame} setView={setView} playerName={playerName} />}
            {view === 'create' && <CreateView setView={setView} playerName={playerName} />}
            {view === 'dashboard' && <DashboardView playerName={playerName} />}
          </>
        )}
      </div>
    </div>
  );
}

function PlayerNameInput({ setPlayerName }: any) {
  const [generatedName, setGeneratedName] = useState('');
  const [showExistingNameInput, setShowExistingNameInput] = useState(false);
  const [existingName, setExistingName] = useState('');

  useEffect(() => {
    generateRandomName();
  }, []);

  const adjectives = [
    'Schnelle', 'Kluge', 'Mutige', 'Lustige', 'Starke', 'Kreative', 'Coole', 
    'Wilde', 'Clevere', 'Geniale', 'Magische', 'Legendäre', 'Epische', 'Ninja',
    'Mystische', 'Goldene', 'Silberne', 'Fliegende', 'Tanzende', 'Singende'
  ];

  const nouns = [
    'Fuchs', 'Adler', 'Tiger', 'Panda', 'Delfin', 'Löwe', 'Wolf', 'Bär',
    'Drache', 'Phönix', 'Einhorn', 'Falke', 'Gepard', 'Hai', 'Panther',
    'Affe', 'Eule', 'Rabe', 'Salamander', 'Kobra'
  ];

  const generateRandomName = () => {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 99) + 1;
    setGeneratedName(`${adj}${noun}${num}`);
  };

  const handleSubmitGenerated = () => {
    if (generatedName.trim()) {
      console.log('💾 Speichere Namen:', generatedName.trim());
      localStorage.setItem('millionenspiel_playerName', generatedName.trim());
      setPlayerName(generatedName.trim());
    }
  };

  const handleSubmitExisting = () => {
    if (existingName.trim()) {
      console.log('💾 Speichere Namen:', existingName.trim());
      localStorage.setItem('millionenspiel_playerName', existingName.trim());
      setPlayerName(existingName.trim());
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-20">
      <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-8 border border-white border-opacity-20">
        <div className="text-center mb-6">
          <h2 className="text-5xl font-bold mb-4 text-yellow-400">👋 Willkommen!</h2>
          <p className="text-xl text-white mb-2">Wähle deinen Spielernamen</p>
        </div>

        {!showExistingNameInput ? (
          <div>
            {/* Neuer generierter Name */}
            <div className="mb-6 p-4 bg-blue-500 bg-opacity-20 border-2 border-blue-400 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-3xl">🎲</div>
                <div className="flex-1">
                  <h3 className="font-bold text-blue-300 mb-2">Neuer Spieler</h3>
                  <p className="text-sm text-gray-200 mb-4">
                    Dir wird automatisch ein zufälliger Name zugewiesen. <strong>Merke ihn dir gut!</strong> Mit diesem Namen kannst du später wieder einsteigen.
                  </p>
                  
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 px-4 py-3 rounded-lg bg-gray-900 text-white text-xl font-bold text-center border-2 border-yellow-400">
                      {generatedName}
                    </div>
                    <button
                      onClick={generateRandomName}
                      className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-bold"
                      title="Neuen Namen generieren"
                    >
                      🎲 Neu
                    </button>
                  </div>

                  <button
                    onClick={handleSubmitGenerated}
                    className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-lg font-bold rounded-xl transition transform hover:scale-105"
                  >
                    Mit "{generatedName}" spielen 🚀
                  </button>
                </div>
              </div>
            </div>

            {/* Button für bestehende Spieler */}
            <div className="mt-4">
              <button
                onClick={() => setShowExistingNameInput(true)}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition"
              >
                🔑 Ich habe bereits einen Namen
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Bestehenden Namen eingeben */}
            <div className="mb-6 p-4 bg-orange-500 bg-opacity-20 border-2 border-orange-400 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-3xl">🔑</div>
                <div className="flex-1">
                  <h3 className="font-bold text-orange-300 mb-2">Bestehender Spieler</h3>
                  <p className="text-sm text-gray-200 mb-4">
                    Gib deinen früher generierten Namen ein, um auf deine Statistiken zuzugreifen.
                  </p>
                  
                  <input
                    type="text"
                    value={existingName}
                    onChange={(e) => setExistingName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmitExisting()}
                    placeholder="z.B. SchnellerFuchs42"
                    className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white placeholder-gray-500 border-2 border-orange-400 focus:border-orange-300 focus:outline-none text-lg mb-4"
                    maxLength={30}
                  />

                  <button
                    onClick={handleSubmitExisting}
                    disabled={!existingName.trim()}
                    className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 text-white text-lg font-bold rounded-xl transition transform hover:scale-105"
                  >
                    Mit "{existingName || '...'}" anmelden 🎮
                  </button>
                </div>
              </div>
            </div>

            {/* Zurück-Button */}
            <button
              onClick={() => {
                setShowExistingNameInput(false);
                setExistingName('');
              }}
              className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition"
            >
              ← Zurück zu neuem Namen
            </button>
          </>
        )}

        {/* Info-Box */}
        <div className="mt-6 p-3 bg-gray-800 bg-opacity-50 rounded-lg">
          <p className="text-xs text-gray-300 text-center">
            💡 <strong>Wichtig:</strong> Namen werden automatisch generiert. Merke dir deinen Namen, um später auf deine Statistiken zugreifen zu können!
          </p>
        </div>
      </div>
    </div>
  );
}

function ArchiveView({ setCurrentGame, setView, playerName }: any) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTopic, setFilterTopic] = useState('Alle');
  const [filterDifficulty, setFilterDifficulty] = useState('Alle');
  const [sortBy, setSortBy] = useState<'rating' | 'plays' | 'date'>('date');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    setLoading(true);
    try {
      const allGames = await loadAllGames();
      setGames(allGames);
    } catch (error) {
      console.error('❌ Archiv: Fehler beim Laden:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectGame = (game: Game) => {
    setCurrentGame(game);
    setView('game');
  };

  const uniqueTopics = ['Alle', ...Array.from(new Set(games.map(g => g.topic)))];

  const filteredGames = games
    .filter(g => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        g.title.toLowerCase().includes(q) ||
        (g.topic || '').toLowerCase().includes(q) ||
        (g.creator || '').toLowerCase().includes(q);

      const matchesTopic = filterTopic === 'Alle' || g.topic === filterTopic;
      const matchesDifficulty =
        filterDifficulty === 'Alle' || g.difficulty === filterDifficulty;

      return matchesSearch && matchesTopic && matchesDifficulty;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'plays') return (b.plays || 0) - (a.plays || 0);
      // 'date' – createdAt kann fehlen, daher stabil sortieren
      const at = (a as any).createdAt?.toMillis?.() ?? 0;
      const bt = (b as any).createdAt?.toMillis?.() ?? 0;
      return bt - at;
    });

  if (loading) {
    return (
      <div className="text-white text-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 max-w-2xl mx-auto border border-white/20">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-400 mb-4"></div>
          <h2 className="text-3xl font-bold mb-4">📚 Lade Spiele...</h2>
          <p className="text-gray-300">Verbinde mit Firebase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <h2 className="text-4xl font-bold mb-2 text-center">
        <span className="inline-flex items-center gap-3 text-yellow-400">
          📚 <span className="text-white">Spiele-Archiv</span>
        </span>
      </h2>
      <p className="text-center mb-8 text-gray-700 dark:text-gray-300">
        Willkommen {playerName}!{' '}
        {games.length === 0 ? (
          <span className="block mt-2 text-yellow-600 dark:text-yellow-300">
            Noch keine Spiele in der Datenbank
          </span>
        ) : (
          <span>
            {filteredGames.length} von {games.length} Spielen
          </span>
        )}
      </p>

      {/* Filterleiste */}
      <div className="mb-8 bg-white/70 dark:bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/40 dark:border-white/20">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">🔍 Suchen & Filtern</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Suche nach Titel, Thema oder Ersteller..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 rounded-lg border-2 bg-white/90 text-gray-900 border-gray-300 focus:border-blue-500 focus:outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:focus:border-blue-400"
          />

          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="px-4 py-2 rounded-lg border-2 bg-white/90 text-gray-900 border-gray-300 focus:border-blue-500 focus:outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:focus:border-blue-400"
          >
            {uniqueTopics.map(topic => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>

          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="px-4 py-2 rounded-lg border-2 bg-white/90 text-gray-900 border-gray-300 focus:border-blue-500 focus:outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:focus:border-blue-400"
          >
            <option value="Alle">Alle Schwierigkeiten</option>
            <option value="Einfach">Einfach</option>
            <option value="Mittel">Mittel</option>
            <option value="Schwer">Schwer</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 rounded-lg border-2 bg-white/90 text-gray-900 border-gray-300 focus:border-blue-500 focus:outline-none dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:focus:border-blue-400"
          >
            <option value="date">Neueste zuerst</option>
            <option value="rating">Beste Bewertung</option>
            <option value="plays">Meistgespielt</option>
          </select>
        </div>
      </div>

      {/* Karten */}
      {games.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl mb-4 text-gray-700 dark:text-gray-300">Noch keine Spiele vorhanden.</p>
          <button
            onClick={() => setView('create')}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-bold rounded-xl transition transform hover:scale-105"
          >
            ➕ Erstes Spiel erstellen
          </button>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-700 dark:text-gray-300">Keine Spiele gefunden mit diesen Filtern.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              className="rounded-2xl p-6 bg-white/90 text-gray-900 border border-gray-200 hover:shadow-lg transition dark:bg-white/10 dark:text-white dark:border-white/20"
            >
              {/* TITEL zuerst (wichtig) */}
              <h3 className="text-2xl font-extrabold mb-1 tracking-tight">
                {game.title || 'Ohne Titel'}
              </h3>

              {/* Thema & Creator als Unterzeile */}
              <div className="text-sm mb-3">
                <div className="text-gray-600 dark:text-gray-300">
                  📖 {game.topic || 'Ohne Thema'}
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  👤 {game.creator || 'Unbekannt'}
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold
                  ${game.difficulty === 'Einfach' ? 'bg-green-100 text-green-800 dark:bg-green-600 dark:text-white' :
                    game.difficulty === 'Mittel' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-600 dark:text-white' :
                    'bg-red-100 text-red-800 dark:bg-red-600 dark:text-white'}`}>
                  {game.difficulty}
                </span>
                <span className="text-yellow-500 font-semibold">
                  ⭐ {game.rating ? game.rating.toFixed(1) : 'N/A'}
                </span>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                🎮 {game.plays} gespielt
              </div>

              <button
                onClick={() => selectGame(game)}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
              >
                ▶️ Jetzt spielen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GameView({ game, setView, playerName }: { game: Game; setView: any; playerName: string }) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [earnedMoney, setEarnedMoney] = useState(0);
  const [jokerUsed, setJokerUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [shuffledAnswers, setShuffledAnswers] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [userRating, setUserRating] = useState(0);

  useEffect(() => {
    selectRandomQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel, game]);

  const selectRandomQuestion = () => {
    console.log('🎯 Wähle Frage für Level:', currentLevel + 1);
    console.log('📋 Alle Fragen:', game.questions.length);

    // Nach Level filtern (neue Struktur)
    let levelQuestions = game.questions.filter(q => q.level === currentLevel + 1);

    // Fallback: indexbasierte Auswahl (alte Struktur)
    if (levelQuestions.length === 0) {
      console.log('⚠️ Keine level property, nutze Index-basierte Auswahl');
      const startIdx = currentLevel * 3;
      levelQuestions = game.questions.slice(startIdx, startIdx + 3);
    }

    console.log('📊 Gefilterte Fragen für Level', currentLevel + 1, ':', levelQuestions.length);

    if (levelQuestions.length > 0) {
      const randomQ = levelQuestions[Math.floor(Math.random() * levelQuestions.length)];
      console.log('✅ Gewählte Frage:', randomQ.q);
      setCurrentQuestion(randomQ);

      // Antworten mischen
      const answers = randomQ.a.map((answer, index) => ({ answer, originalIndex: index }));
      for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
      }
      setShuffledAnswers(answers.map(a => a.answer));
      setCorrectIndex(answers.findIndex(a => a.originalIndex === randomQ.correct));
    } else {
      console.error('❌ Keine Fragen für Level gefunden!', currentLevel + 1);
    }
    setSelectedAnswer(null);
    setShowHint(false);
  };

  const handleAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);

    setTimeout(() => {
      if (answerIndex === correctIndex) {
        const newMoney = LEVELS[currentLevel];
        setEarnedMoney(newMoney);

        if (currentLevel === 5) {
          setWon(true);
          setGameOver(true);
          setShowRating(true);
          if (game.id) {
            updateGameStats(game.id, true);
            savePlayerScore({
              playerName,
              gameId: game.id,
              gameTitle: game.title,
              level: currentLevel + 1,
              earnedMoney: newMoney,
              completed: true,
              timestamp: Timestamp.now()
            });
          }
        } else {
          setTimeout(() => {
            setCurrentLevel(currentLevel + 1);
          }, 1500);
        }
      } else {
        setGameOver(true);
        if (game.id) {
          updateGameStats(game.id, false);
          savePlayerScore({
            playerName,
            gameId: game.id,
            gameTitle: game.title,
            level: currentLevel + 1,
            earnedMoney: earnedMoney,
            completed: false,
            timestamp: Timestamp.now()
          });
        }
      }
    }, 1000);
  };

  const useJoker = () => {
    if (!jokerUsed && currentQuestion?.hint) {
      setJokerUsed(true);
      setShowHint(true);
    }
  };

  // ➕ Neu: komplettes Zurücksetzen für „Nochmal spielen“
  const retryGame = () => {
    setCurrentLevel(0);
    setEarnedMoney(0);
    setJokerUsed(false);
    setShowHint(false);
    setGameOver(false);
    setWon(false);
    setSelectedAnswer(null);
    setCurrentQuestion(null);
    setShuffledAnswers([]);
    setCorrectIndex(0);
    setShowRating(false);
    setUserRating(0);
    // nächste Frage direkt vorbereiten
    setTimeout(() => selectRandomQuestion(), 0);
  };

  const handleRatingSubmit = async () => {
    if (userRating > 0 && game.id) {
      await addRating(game.id, userRating);
      alert('Danke für deine Bewertung!');
      setView('archive');
    }
  };

  if (gameOver) {
    return (
      <div className="text-center text-white">
        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-12 max-w-2xl mx-auto border border-white border-opacity-20">
          <h2 className="text-4xl font-bold mb-6 text-yellow-400">
            {won ? '🎉 Gratuliere!' : '😢 Schade!'}
          </h2>
          <p className="text-6xl font-bold mb-6">{earnedMoney.toLocaleString()} CHF</p>
          <p className="text-xl mb-6">
            {won
              ? `Fantastisch ${playerName}! Du hast die Million gewonnen! 🏆`
              : `Leider verloren, ${playerName}! Du hast Level ${currentLevel + 1} erreicht.`}
          </p>

          {showRating && (
            <div className="mb-8 p-6 bg-blue-900 bg-opacity-30 rounded-lg">
              <h3 className="text-2xl font-bold mb-4">⭐ Bewerte dieses Spiel</h3>
              <div className="flex justify-center space-x-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setUserRating(star)}
                    className={`text-5xl transition transform hover:scale-110 ${
                      star <= userRating ? 'text-yellow-400' : 'text-gray-500'
                    }`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <button
                onClick={handleRatingSubmit}
                disabled={userRating === 0}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition"
              >
                Bewertung absenden
              </button>
            </div>
          )}

          {/* Neue Optionen am Spielende */}
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={retryGame}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold rounded-xl transition transform hover:scale-105"
            >
              🔁 Nochmal spielen
            </button>
            <button
              onClick={() => setView('archive')}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-lg font-bold rounded-xl transition transform hover:scale-105"
            >
              🎮 Neues Spiel wählen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion || shuffledAnswers.length === 0) {
    return <div className="text-white text-center">Lade Frage...</div>;
  }

  return (
    <div className="text-white">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-3xl font-bold text-yellow-400">{game.title}</h2>
        <button
          onClick={() => setView('archive')}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
        >
          Beenden
        </button>
      </div>

      <div className="mb-8 flex justify-between items-center">
        <div className="flex space-x-2">
          {LEVELS.map((level, idx) => (
            <div
              key={level}
              className={`px-4 py-2 rounded-lg font-bold ${
                idx === currentLevel
                  ? 'bg-yellow-500 text-black'
                  : idx < currentLevel
                  ? 'bg-green-600'
                  : 'bg-gray-600 bg-opacity-50'
              }`}
            >
              {level.toLocaleString()}
            </div>
          ))}
        </div>
        <button
          onClick={useJoker}
          disabled={jokerUsed || !currentQuestion.hint}
          className={`px-6 py-3 rounded-lg font-bold ${
            jokerUsed || !currentQuestion.hint
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600'
          }`}
        >
          {jokerUsed ? '🔒 Joker verwendet' : '💡 Joker'}
        </button>
      </div>

      <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-8 border border-white border-opacity-20">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 mb-8 shadow-2xl border-4 border-white border-opacity-20">
          <h3 className="text-3xl font-bold text-center text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
            {currentQuestion.q}
          </h3>
        </div>

        {showHint && currentQuestion.hint && (
          <div className="mb-6 p-4 bg-orange-500 bg-opacity-30 rounded-lg border border-orange-400">
            <p className="text-lg">💡 Hinweis: {currentQuestion.hint}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {shuffledAnswers.map((answer, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={selectedAnswer !== null}
              className={`p-6 rounded-xl text-xl font-semibold transition transform hover:scale-105 ${
                selectedAnswer === idx
                  ? idx === correctIndex
                    ? 'bg-green-600'
                    : 'bg-red-600'
                  : selectedAnswer !== null && idx === correctIndex
                  ? 'bg-green-600'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {String.fromCharCode(65 + idx)}: {answer}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateView({ setView, playerName }: any) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Mittel');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Umfassende Themenliste
  const themenKategorien = {
    'MINT - Mathematik': [
      'Arithmetik & Algebra',
      'Geometrie',
      'Trigonometrie',
      'Analysis & Calculus',
      'Statistik & Wahrscheinlichkeit',
      'Lineare Algebra',
      'Zahlentheorie',
      'Diskrete Mathematik'
    ],
    'MINT - Informatik': [
      'Programmierung',
      'Algorithmen & Datenstrukturen',
      'Datenbanken',
      'Künstliche Intelligenz',
      'Cybersecurity',
      'Netzwerke',
      'Web-Entwicklung',
      'Software Engineering'
    ],
    'MINT - Naturwissenschaften': [
      'Physik - Mechanik',
      'Physik - Elektrizität & Magnetismus',
      'Physik - Optik',
      'Chemie - Allgemein',
      'Chemie - Organisch',
      'Chemie - Anorganisch',
      'Biologie - Zellbiologie',
      'Biologie - Genetik',
      'Biologie - Evolution',
      'Biologie - Ökologie',
      'Astronomie',
      'Geologie'
    ],
    'MINT - Technik & Ingenieurwesen': [
      'Elektrotechnik',
      'Maschinenbau',
      'Bauingenieurwesen',
      'Robotik',
      'Energietechnik',
      'Materialwissenschaften'
    ],
    'Geisteswissenschaften - Sprachen': [
      'Deutsch - Grammatik',
      'Deutsch - Literatur',
      'Englisch',
      'Französisch',
      'Spanisch',
      'Italienisch',
      'Latein',
      'Altgriechisch'
    ],
    'Geisteswissenschaften - Geschichte': [
      'Alte Geschichte',
      'Mittelalter',
      'Neuzeit',
      'Zeitgeschichte',
      'Schweizer Geschichte',
      'Europäische Geschichte',
      'Weltgeschichte',
      'Kunstgeschichte'
    ],
    'Geisteswissenschaften - Gesellschaft': [
      'Philosophie',
      'Ethik',
      'Religion',
      'Psychologie',
      'Soziologie',
      'Politik',
      'Wirtschaft',
      'Recht'
    ],
    'Geisteswissenschaften - Kultur': [
      'Literatur',
      'Musik',
      'Kunst & Malerei',
      'Theater',
      'Film',
      'Architektur',
      'Medienwissenschaften'
    ],
    'Geografie & Umwelt': [
      'Physische Geografie',
      'Humangeografie',
      'Länder & Hauptstädte',
      'Klima & Wetter',
      'Umweltschutz',
      'Nachhaltigkeit'
    ],
    'Alltag & Gesellschaft': [
      'Gesundheit & Medizin',
      'Ernährung',
      'Erste Hilfe',
      'Verkehr & Mobilität',
      'Wohnen',
      'Finanzen & Versicherungen',
      'Beruf & Karriere',
      'Medien & Kommunikation'
    ],
    'Freizeit & Hobby': [
      'Sport - Fussball',
      'Sport - Tennis',
      'Sport - Ski & Snowboard',
      'Sport - Schwimmen',
      'Sport - Leichtathletik',
      'Kochen & Backen',
      'Gärtnern',
      'Fotografie',
      'Reisen & Tourismus',
      'Spiele & Gaming',
      'Handwerk & DIY'
    ],
    'Diverses': [
      'Allgemeinwissen',
      'Schweizer Kultur',
      'Feiertage & Bräuche',
      'Promis & Unterhaltung',
      'Technik im Alltag',
      'Mode & Lifestyle'
    ]
  };

  const handleGenerate = async () => {
    if (!text || text.length < 50) {
      setError('Text muss mindestens 50 Zeichen lang sein');
      return;
    }
    if (!title || !topic) {
      setError('Bitte Titel und Thema eingeben');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, difficulty, topic }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler bei der Generierung');
      }

      const { questions } = await response.json();

      const newGame: Game = {
        title,
        topic,
        difficulty,
        plays: 0,
        rating: 0,
        creator: playerName,
        questions
      };

      await saveGame(newGame);
      alert('Spiel erfolgreich erstellt! ✅');
      setView('archive');
    } catch (error: any) {
      setError(error.message || 'Fehler bei der Fragengenerierung');
    } finally {
      setLoading(false);
    }
  };

  // Styles für gute Lesbarkeit auf hellem & dunklem Hintergrund
  const fieldBase = 'w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition';
  const fieldColors = 'bg-white/90 text-gray-900 border-gray-300 focus:border-blue-500 ' +
                      'dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:focus:border-blue-400';
  const labelCls = 'block text-sm font-bold mb-2 text-gray-900 dark:text-gray-200';
  const helpCls  = 'text-xs text-gray-600 dark:text-gray-400';

  return (
    <div className="text-gray-900 dark:text-white max-w-4xl mx-auto">
      <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">✨ Neues Spiel erstellen</h2>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 border border-red-300 rounded-lg dark:bg-red-500/20 dark:text-red-200 dark:border-red-500/40">
          <p className="text-base">⚠️ {error}</p>
        </div>
      )}

      <div className="bg-white/70 dark:bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/40 dark:border-white/20">
        <h3 className="text-2xl font-bold mb-6">📝 Spielinformationen</h3>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="title" className={labelCls}>Spieltitel *</label>
            <input
              id="title"
              type="text"
              placeholder="z.B. Schweizer Geschichte Quiz"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${fieldBase} ${fieldColors} placeholder-gray-500 dark:placeholder-gray-400`}
              aria-label="Spieltitel"
              required
            />
          </div>

          <div>
            <label htmlFor="topic" className={labelCls}>Themenbereich *</label>
            <select
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={`${fieldBase} ${fieldColors}`}
              aria-label="Themenbereich"
              required
            >
              <option value="">-- Bitte Thema auswählen --</option>
              {Object.entries(themenKategorien).map(([kategorie, themen]) => (
                <optgroup key={kategorie} label={kategorie}>
                  {themen.map((thema) => (
                    <option key={thema} value={thema}>{thema}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className={helpCls}>Kategorie wählen – die KI nutzt das für passendere Fragen.</p>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="difficulty" className={labelCls}>Schwierigkeit</label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className={`${fieldBase} ${fieldColors}`}
            aria-label="Schwierigkeit"
          >
            <option value="Einfach">Einfach</option>
            <option value="Mittel">Mittel</option>
            <option value="Schwer">Schwer</option>
          </select>
          <p className={helpCls}>Wähle die ungefähre Schwierigkeit der Fragen.</p>
        </div>

        <h3 className="text-2xl font-bold mb-4 mt-8">📄 Lerntext eingeben</h3>

        <div className="relative">
          <textarea
            id="learntext"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Text hier eingeben..."
            disabled={loading}
            className={`w-full h-64 resize-y ${fieldBase} ${fieldColors} placeholder-gray-600 dark:placeholder-gray-400`}
            maxLength={10000}
            aria-label="Lerntext"
          />
          <div className="absolute bottom-2 right-3 text-xs text-gray-600 dark:text-gray-400">
            {text.length} / 10'000 Zeichen
          </div>
        </div>
        <p className={`${helpCls} mt-2`}>Tipp: 1–3 gut strukturierte Absätze liefern die besten Fragen.</p>

        <button
          onClick={handleGenerate}
          disabled={loading || text.length < 50 || !title || !topic}
          className="w-full mt-8 px-8 py-4 rounded-xl text-white text-xl font-bold
                     transition transform hover:scale-105
                     disabled:opacity-60 disabled:cursor-not-allowed
                     bg-gradient-to-r from-green-500 to-emerald-600
                     hover:from-green-600 hover:to-emerald-700"
        >
          {loading ? '🤖 KI generiert Fragen... (ca. 30 Sekunden)' : '✨ Mit KI generieren'}
        </button>

        <button
          onClick={() => setView('archive')}
          disabled={loading}
          className="w-full mt-4 px-8 py-4 bg-gray-200 hover:bg-gray-300 text-gray-900
                     dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white
                     rounded-xl text-lg font-bold transition"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}


function DashboardView({ playerName }: { playerName: string }) {
  // ---------- Hilfskomponente: Einheitliche Überschriften (Icon + Label) ----------
 const SectionHeader = ({
  icon,
  label,
  sub,
  className = "",
}: { icon: string; label: string; sub?: string; className?: string }) => (
  <div className={`mb-4 ${className}`}>
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl
                    bg-gray-900/85 text-white border border-white/15 backdrop-blur">
      <span className="text-xl leading-none">{icon}</span>
      <span className="font-bold">{label}</span>
      {sub && <span className="text-xs text-gray-300">• {sub}</span>}
    </div>
  </div>
);

  const [allScores, setAllScores] = useState<PlayerScore[]>([]);
  const [myScores, setMyScores] = useState<PlayerScore[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Filter-States ----
  const [filterTopic, setFilterTopic] = useState<string>("Alle");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("Alle");
  const [filterCreator, setFilterCreator] = useState<string>("Alle");
  const [search, setSearch] = useState<string>("");
  const [minPlays, setMinPlays] = useState<number>(0);
  const [onlyCompleted, setOnlyCompleted] = useState<boolean>(false);
  const [topLimit, setTopLimit] = useState<number>(10);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [scores, playerScores, games] = await Promise.all([
        getAllPlayerScores(),
        getPlayerScores(playerName),
        loadAllGames(),
      ]);
      setAllScores(scores);
      setMyScores(playerScores);
      setAllGames(games);
      setLoading(false);
    })();
  }, [playerName]);

  // ---- Daten-Indizes ----
  const gamesById = new Map((allGames || []).map((g) => [g.id as string, g]));

  // ---- Optionen für Filter ----
  const topicOptions = ["Alle", ...Array.from(new Set(allGames.map((g) => g.topic || "Ohne Thema")))];
  const difficultyOptions = ["Alle", "Einfach", "Mittel", "Schwer"];
  const creatorOptions = ["Alle", ...Array.from(new Set(allGames.map((g) => g.creator || "Unbekannt")))];

  // ---- Helfer: Textsuche ----
  const norm = (s: string) => (s || "").toLowerCase();
  const matchesSearchGame = (g: Game) => {
    if (!search) return true;
    const q = norm(search);
    return norm(g.title).includes(q) || norm(g.topic || "").includes(q) || norm(g.creator || "").includes(q);
  };
  const matchesSearchScore = (s: PlayerScore) => {
    if (!search) return true;
    const q = norm(search);
    const g = gamesById.get(s.gameId);
    return (
      norm(s.playerName).includes(q) ||
      norm(s.gameTitle).includes(q) ||
      (g && (norm(g.topic || "").includes(q) || norm(g.creator || "").includes(q)))
    );
  };

  // ---- Gefilterte Spiele ----
  const filteredGames = allGames.filter((g) => {
    if (!matchesSearchGame(g)) return false;
    if (filterTopic !== "Alle" && (g.topic || "Ohne Thema") !== filterTopic) return false;
    if (filterDifficulty !== "Alle" && g.difficulty !== filterDifficulty) return false;
    if (filterCreator !== "Alle" && (g.creator || "Unbekannt") !== filterCreator) return false;
    if ((g.plays || 0) < minPlays) return false;
    return true;
  });

  // ---- Gefilterte Scores ----
  const filteredScores = allScores.filter((s) => {
    const g = gamesById.get(s.gameId);
    if (!g) return false;
    if (!matchesSearchScore(s)) return false;
    if (onlyCompleted && !s.completed) return false;
    if (filterTopic !== "Alle" && (g.topic || "Ohne Thema") !== filterTopic) return false;
    if (filterDifficulty !== "Alle" && g.difficulty !== filterDifficulty) return false;
    if (filterCreator !== "Alle" && (g.creator || "Unbekannt") !== filterCreator) return false;
    if ((g.plays || 0) < minPlays) return false;
    return true;
  });

  // ---- Kennzahlen (global) ----
  const totalGames = allGames.length;
  const totalPlays = allGames.reduce((sum, g) => sum + (g.plays || 0), 0);
  const avgRating =
    allGames.length > 0
      ? (allGames.reduce((sum, g) => sum + (g.rating || 0), 0) / allGames.length).toFixed(1)
      : "0";
  const totalPlayers = new Set(allScores.map((s) => s.playerName)).size;
  const millionWins = allScores.filter((s) => s.completed).length;

  // ---- Persönliche Kennzahlen ----
  const myTotalPlays = myScores.length;
  const myWins = myScores.filter((s) => s.completed).length;
  const myTotalEarnings = myScores.reduce((sum, s) => sum + (s.earnedMoney || 0), 0);

  // ---- 4) Top 5 beliebteste Spiele (aus gefilterten Spielen) ----
  const topPopularGames = [...filteredGames].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 5);

  // ---- 5) Top 3 Spieler pro Kategorie (aus gefilterten Scores) ----
  const scoresByTopic: Record<string, PlayerScore[]> = filteredScores.reduce((acc, s) => {
    const g = gamesById.get(s.gameId);
    const topic = g?.topic || "Ohne Thema";
    (acc[topic] ||= []).push(s);
    return acc;
  }, {} as Record<string, PlayerScore[]>);

  // bestes Ergebnis je Spieler innerhalb der Kategorie, dann Top3
  const top3ByTopic: Array<{ topic: string; players: Array<{ playerName: string; earnedMoney: number }> }> =
    Object.entries(scoresByTopic)
      .map(([topic, scores]) => {
        const bestByPlayer = scores.reduce((m, s) => {
          const prev = m.get(s.playerName) ?? 0;
          const val = s.earnedMoney || 0;
          if (val > prev) m.set(s.playerName, val);
          return m;
        }, new Map<string, number>());

        const players = Array.from(bestByPlayer.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([playerName, earnedMoney]) => ({ playerName, earnedMoney }));

        return { topic, players };
      })
      .sort((a, b) => a.topic.localeCompare(b.topic));

  // ---- 6) Top 5 Themenbereiche (aus gefilterten Spielen) ----
  const topicCounts = filteredGames.reduce<Record<string, number>>((acc, g) => {
    const key = g.topic || "Ohne Thema";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const totalTopicGames = Object.values(topicCounts).reduce((a, b) => a + b, 0);
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ---- Leaderboard (mit Limit) ----
  const limitedLeaderboard = [...filteredScores]
    .sort((a, b) => (b.earnedMoney || 0) - (a.earnedMoney || 0))
    .slice(0, Math.max(1, Math.min(100, topLimit)));

  const resetFilters = () => {
    setFilterTopic("Alle");
    setFilterDifficulty("Alle");
    setFilterCreator("Alle");
    setSearch("");
    setMinPlays(0);
    setOnlyCompleted(false);
    setTopLimit(10);
  };

  if (loading) {
    return (
      <div className="text-white text-center">
        <h2 className="text-4xl font-bold mb-8">📊 Dashboard</h2>
        <p className="text-xl">Lade Statistiken...</p>
      </div>
    );
  }

  return (
    <div className="text-white">
      <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">📊 Dashboard – {playerName}</h2>

      {/* --- Filterleiste --- */}
      <div className="mb-8 bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20">
        <SectionHeader icon="⚙️" label="Filter" />
        <div className="grid md:grid-cols-6 gap-4">
          <input
            type="text"
            placeholder="Suche (Spiel, Thema, Creator, Spielername)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white border-2 border-gray-600 focus:border-blue-500 focus:outline-none md:col-span-2"
          />
          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white border-2 border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {topicOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white border-2 border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {difficultyOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={filterCreator}
            onChange={(e) => setFilterCreator(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white border-2 border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {creatorOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300 whitespace-nowrap">Min. Plays</label>
            <input
              type="number"
              min={0}
              value={minPlays}
              onChange={(e) => setMinPlays(Math.max(0, Number(e.target.value)))}
              className="w-24 px-3 py-2 rounded-lg bg-gray-800 text-white border-2 border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyCompleted}
              onChange={(e) => setOnlyCompleted(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-sm text-gray-300">Nur vollständige Runs (Million)</span>
          </label>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300">Top-Limit</label>
            <input
              type="number"
              min={1}
              max={100}
              value={topLimit}
              onChange={(e) => setTopLimit(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="w-20 px-3 py-2 rounded-lg bg-gray-800 text-white border-2 border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="ml-auto flex gap-3">
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">
              Zurücksetzen
            </button>
            <div className="px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-300">
              {filteredGames.length} / {allGames.length} Spiele · {filteredScores.length} Scores
            </div>
          </div>
        </div>
      </div>

      {/* 1) Deine Statistiken */}
      <div className="mb-8">
        <SectionHeader icon="👤" label="Deine Statistiken" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-blue-600 bg-opacity-30 backdrop-blur-md rounded-2xl p-6 border border-blue-400">
            <div className="text-4xl mb-2">🎮</div>
            <div className="text-3xl font-bold">{myTotalPlays}</div>
            <div className="text-sm text-gray-300">Gespielte Spiele</div>
          </div>
          <div className="bg-green-600 bg-opacity-30 backdrop-blur-md rounded-2xl p-6 border border-green-400">
            <div className="text-4xl mb-2">🏆</div>
            <div className="text-3xl font-bold">{myWins}</div>
            <div className="text-sm text-gray-300">Millionen gewonnen</div>
          </div>
          <div className="bg-yellow-600 bg-opacity-30 backdrop-blur-md rounded-2xl p-6 border border-yellow-400">
            <div className="text-4xl mb-2">💰</div>
            <div className="text-3xl font-bold">{myTotalEarnings.toLocaleString()} CHF</div>
            <div className="text-sm text-gray-300">Gesamtgewinn</div>
          </div>
        </div>
      </div>

      {/* 2) Gesamt-Statistiken */}
      <div className="mb-10">
        <SectionHeader icon="🌍" label="Gesamt-Statistiken" />
        <div className="grid md:grid-cols-5 gap-6">
          <div className="bg-blue-600 bg-opacity-30 backdrop-blur-md rounded-2xl p-6 border border-blue-400">
            <div className="text-4xl mb-2">🎮</div>
            <div className="text-3xl font-bold">{totalGames}</div>
            <div className="text-sm text-gray-300">Verfügbare Spiele</div>
          </div>
          <div className="bg-green-600 bg-opacity-30 backdrop-blur-md rounded-2xl p-6 border border-green-400">
            <div className="text-4xl mb-2">🔢</div>
            <div className="text-3xl font-bold">{totalPlays}</div>
            <div className="text-sm text-gray-300">Gesamt gespielt</div>
          </div>
          <div className="bg-purple-600 bg-opacity-30 backdrop-blur-md rounded-2xl p-6 border border-purple-400">
            <div className="text-4xl mb-2">⭐</div>
            <div className="text-3xl font-bold">{avgRating}</div>
            <div className="text-sm text-gray-300">Ø Bewertung</div>
          </div>
          <div className="bg-orange-600 bg-opacity-30 backdrop-blur-md rounded-2xl p-6 border border-orange-400">
            <div className="text-4xl mb-2">👥</div>
            <div className="text-3xl font-bold">{totalPlayers}</div>
            <div className="text-sm text-gray-300">Aktive Spieler</div>
          </div>
          <div className="bg-yellow-600 bg-opacity-30 backdrop-blur-md rounded-2xl p-6 border border-yellow-400">
            <div className="text-4xl mb-2">💰</div>
            <div className="text-3xl font-bold">{millionWins}</div>
            <div className="text-sm text-gray-300">Millionen gewonnen</div>
          </div>
        </div>
      </div>

      {/* 3) Top X global + eigene letzten Spiele (nebeneinander) */}
      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20">
          <SectionHeader icon="🏆" label={`Top ${topLimit} – Globale Bestenliste`} sub="gefiltert" className="mb-6" />
          {limitedLeaderboard.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Keine Einträge</p>
          ) : (
            <div className="space-y-3">
              {limitedLeaderboard.map((score, idx) => (
                <div
                  key={score.id}
                  className={`flex justify-between items-center p-3 rounded-lg ${
                    score.playerName === playerName ? "bg-yellow-600 bg-opacity-30" : "bg-gray-800 bg-opacity-50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-xl font-bold text-gray-300">#{idx + 1}</div>
                    <div>
                      <div className="font-bold">{score.playerName}</div>
                      <div className="text-xs text-gray-400">{score.gameTitle}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-yellow-400">{score.earnedMoney.toLocaleString()}</div>
                    {score.completed && <div className="text-xs text-green-400">✅ Million!</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20">
          <SectionHeader icon="📈" label="Deine letzten Spiele" sub="gefiltert" className="mb-6" />
          {myScores
            .filter((s) => {
              const g = gamesById.get(s.gameId);
              if (!g) return false;
              if (filterTopic !== "Alle" && (g.topic || "Ohne Thema") !== filterTopic) return false;
              if (filterDifficulty !== "Alle" && g.difficulty !== filterDifficulty) return false;
              if (filterCreator !== "Alle" && (g.creator || "Unbekannt") !== filterCreator) return false;
              if ((g.plays || 0) < minPlays) return false;
              if (onlyCompleted && !s.completed) return false;
              if (!matchesSearchScore(s)) return false;
              return true;
            })
            .slice(0, 10).length === 0 ? (
            <p className="text-center text-gray-400 py-8">Keine Einträge</p>
          ) : (
            <div className="space-y-3">
              {myScores
                .filter((s) => {
                  const g = gamesById.get(s.gameId);
                  if (!g) return false;
                  if (filterTopic !== "Alle" && (g.topic || "Ohne Thema") !== filterTopic) return false;
                  if (filterDifficulty !== "Alle" && g.difficulty !== filterDifficulty) return false;
                  if (filterCreator !== "Alle" && (g.creator || "Unbekannt") !== filterCreator) return false;
                  if ((g.plays || 0) < minPlays) return false;
                  if (onlyCompleted && !s.completed) return false;
                  if (!matchesSearchScore(s)) return false;
                  return true;
                })
                .slice(0, 10)
                .map((score) => (
                  <div key={score.id} className="flex justify-between items-center p-3 bg-gray-800 bg-opacity-50 rounded-lg">
                    <div>
                      <div className="font-bold">{score.gameTitle}</div>
                      <div className="text-xs text-gray-400">Level {score.level} erreicht</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-yellow-400">{score.earnedMoney.toLocaleString()}</div>
                      {score.completed && <div className="text-xs text-green-400">✅ Million!</div>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* 4) Top 5 beliebteste Spiele */}
      <div className="mb-10 bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20">
        <SectionHeader icon="🔥" label="Top 5 beliebteste Spiele" sub="gefiltert" className="mb-2" />
        {topPopularGames.length === 0 ? (
          <p className="text-center text-gray-400 py-6">Keine Spiele</p>
        ) : (
          <div className="space-y-3">
            {topPopularGames.map((g, i) => (
              <div key={g.id || i} className="flex justify-between items-center p-3 bg-gray-800 bg-opacity-50 rounded-lg">
                <div>
                  <div className="font-bold">{g.title}</div>
                  <div className="text-xs text-gray-400">
                    📖 {g.topic} • 👤 {g.creator || "Unbekannt"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-yellow-400">🎮 {g.plays}</div>
                  <div className="text-xs text-gray-400">⭐ {(g.rating || 0).toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5) Top 3 Spieler pro Kategorie */}
      <div className="mb-10 bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20">
        <SectionHeader icon="👑" label="Top 3 Spieler pro Kategorie" sub="gefiltert" className="mb-2" />
        {top3ByTopic.length === 0 ? (
          <p className="text-center text-gray-400 py-6">Keine Einträge</p>
        ) : (
          <div className="space-y-6">
            {top3ByTopic.map(({ topic, players }) => (
              <div key={topic} className="bg-gray-800 bg-opacity-40 rounded-xl p-4">
                <div className="font-bold mb-3">🏷️ {topic}</div>
                {players.length === 0 ? (
                  <div className="text-sm text-gray-400">Keine Einträge</div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-3">
                    {players.map((p, rank) => (
                      <div
                        key={`${topic}-${p.playerName}`}
                        className="flex justify-between items-center p-3 rounded-lg bg-gray-900 bg-opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg text-gray-400">#{rank + 1}</span>
                          <span className="font-semibold">{p.playerName}</span>
                        </div>
                        <div className="text-yellow-400 font-bold">{p.earnedMoney.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6) Top 5 häufigste Themenbereiche */}
      <div className="mb-2 bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20">
        <SectionHeader icon="📚" label="Top 5 häufigste Themenbereiche" sub="gefiltert" className="mb-2" />
        {topTopics.length === 0 ? (
          <p className="text-center text-gray-400 py-6">Keine Themen vorhanden</p>
        ) : (
          <div className="space-y-3">
            {topTopics.map(([topic, count]) => {
              const share = totalTopicGames > 0 ? Math.round((count / totalTopicGames) * 100) : 0;
              return (
                <div key={topic} className="flex justify-between items-center p-3 bg-gray-800 bg-opacity-50 rounded-lg">
                  <div className="font-semibold">🏷️ {topic}</div>
                  <div className="text-sm text-gray-300">
                    {count} Spiele • {share}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}