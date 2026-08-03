// @ts-nocheck
import React, { useState } from 'react';
import RoomPage from './RoomPage';

// כאן אנחנו מייבאים את הנתונים המדומים שלנו
const mockRooms = [
  { id: 1, name: 'נגה', host: 'נגה', status: 'פעיל' },
];

const mockSketches = [
  { id: 1, title: 'Sketch Jazz', artist: 'מיכל ד.', status: 'פוצח בהצלחה', genre: 'Jazz' },
  { id: 2, title: 'k Draft...', artist: 'יוני מ.', status: 'פוצח בהצלחה', genre: 'R&B' },
  { id: 3, title: 'ביטס לפצות', artist: 'רב.ד', status: 'דרוש פידבק', genre: 'Hip-Hop' },
];

export default function AppSupabase() {
  const [activeFilter, setActiveFilter] = useState('הכל');
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <>
      {currentPage === 'home' ? (
        <div className="min-h-screen bg-background text-foreground" dir="rtl">
          {/* Header נשאר זהה */}
          <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <span className="text-lg">🎵</span>
                </div>
                <span className="text-lg font-bold tracking-tight">LiveBeat</span>
              </div>
              <button className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-medium">
                  הפרופיל שלי
              </button>
            </div>
          </header>

          {/* Main Layout */}
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
              
              {/* Sidebar - חדרים */}
              <section id="live">
                <h2 className="text-xl font-bold mb-4">חדרים בלייב</h2>
                <div className="flex flex-col gap-3">
                  {mockRooms.map(room => (
                    <div 
                      key={room.id} 
                      onClick={() => setCurrentPage('room')}
                      className="cursor-pointer rounded-xl border border-border bg-card p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{room.name}</p>
                        <p className="text-xs text-muted-foreground">מנהל: {room.host}</p>
                      </div>
                      <span className="text-xs font-bold text-green-500 animate-pulse">LIVE</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Feed */}
              <section id="sketches">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {mockSketches.map(sketch => (
                    <div key={sketch.id} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all">
                      <h3 className="font-bold mb-1">{sketch.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{sketch.artist}</p>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary">
                        {sketch.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : (
        <RoomPage onLeaveRoom={() => setCurrentPage('home')} />
      )}
    </>
  );
}