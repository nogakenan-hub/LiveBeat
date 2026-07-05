// @ts-nocheck
import React, { useState } from 'react';
import SketchCard from './components/SketchCard';
import CreateRoomModal from './components/CreateRoomModal';

const mockRooms = [
  { id: 1, name: 'נגה', host: 'נגה', status: 'פעיל' },
];

const mockSketches = [
  { id: 1, title: 'Sketch Jazz', artist: 'מיכל ד.', status: 'פוצח בהצלחה', genre: 'Jazz' },
  { id: 2, title: 'k Draft...', artist: 'יוני מ.', status: 'פוצח בהצלחה', genre: 'R&B' },
  { id: 3, title: 'ביטס לפצות', artist: 'רב.ד', status: 'דרוש פידבק', genre: 'Hip-Hop' },
];

export default function App() {
  const [activeFilter, setActiveFilter] = useState('הכל');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const filters = ['הכל', 'בעבודה', 'פוצח בהצלחה', 'דרוש פידבק'];

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <span className="text-lg">🎵</span>
            </div>
            <span className="text-lg font-bold tracking-tight">LiveBeat</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            <a href="#sketches" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors">פיד היצירה</a>
            <a href="#live" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors">חדרי לייב</a>
          </nav>
          <button className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">👤</div>
            הפרופיל שלי
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-border bg-card/50 px-4 py-10 text-center">
        <h1 className="text-3xl font-bold mb-2">ברוכים הבאים לקהילה 🎵</h1>
        <p className="text-muted-foreground">העלו התחלות וטיוטות, קבלו פידבק, פצחו יחד. חדרי הלייב מחכים לכם.</p>
      </section>

      {/* Main Layout */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">

          {/* Sidebar */}
          <section id="live">
            <div className="mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-live">📡</span> חדרים בלייב
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{mockRooms.length} חדרים פעילים כרגע</p>
            </div>

            <button className="w-full flex items-center justify-center gap-2 rounded-lg bg-live px-4 py-2.5 text-sm font-medium text-white hover:bg-live/90 transition-all mb-4">
              + פתח חדר לייב חדש
            </button>

            <div className="flex flex-col gap-3">
              {mockRooms.map(room => (
                <div key={room.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-live/30 transition-all">
                  <div>
                    <p className="font-medium">{room.name}</p>
                    <p className="text-xs text-muted-foreground">מנהל: {room.host}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-live animate-pulse">LIVE</span>
                    <button className="text-xs bg-secondary hover:bg-primary hover:text-primary-foreground px-3 py-1.5 rounded-lg transition-all">
                      הצטרפות
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Feed */}
          <section id="sketches">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">🎵 פיד היצירה</h2>
                <p className="text-sm text-muted-foreground mt-1">{mockSketches.length} קטעים בקהילה</p>
              </div>
              <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all">
                + העלאת קטע חדש
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {filters.map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeFilter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Sketch Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {mockSketches.map(sketch => (
                <div key={sketch.id} onClick={() => setIsModalOpen(true)}>
                  <SketchCard sketch={sketch} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <footer className="border-t border-border mt-12 py-6 text-center text-sm text-muted-foreground">
        סקיצה פתוחה © 2026 — קהילה לפיצוח סקיצות
      </footer>

      <CreateRoomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}