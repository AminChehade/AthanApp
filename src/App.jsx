import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [time, setTime] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [city, setCity] = useState('Berlin');
  const [country, setCountry] = useState('Germany');
  const [timings, setTimings] = useState(null);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const audioRef = useRef(null);
  const playedToday = useRef({});

  useEffect(() => {
    audioRef.current = new Audio('/azan.mp3');

    const unlockAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }).catch(() => {});
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const fetchPrayerTimes = async () => {
    try {
      const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=3`);
      const data = await response.json();
      if (data.code === 200) {
        setTimings(data.data.timings);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Zeiten:', error);
    }
  };

  useEffect(() => {
    fetchPrayerTimes();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentHoursMin = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      
      setTime(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());

      if (timings) {
        const checkPrayers = [
          { key: 'Fajr', time: timings.Fajr },
          { key: 'Dhuhr', time: timings.Dhuhr },
          { key: 'Asr', time: timings.Asr },
          { key: 'Maghrib', time: timings.Maghrib },
          { key: 'Isha', time: timings.Isha },
        ];

        const todayKey = now.toDateString();

        checkPrayers.forEach((p) => {
          const prayerTimeKey = `${todayKey}-${p.key}`;
          if (p.time === currentHoursMin && !playedToday.current[prayerTimeKey]) {
            playedToday.current[prayerTimeKey] = true;
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch((e) => console.error('Audio-Wiedergabe blockiert:', e));
            }
          }
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timings]);

  const toggleTestAudio = () => {
    if (!audioRef.current) return;

    if (isPlayingTest) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingTest(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        setIsPlayingTest(true);
      }).catch((e) => console.error('Audio konnte nicht abgespielt werden:', e));

      audioRef.current.onended = () => {
        setIsPlayingTest(false);
      };
    }
  };

  const prayers = timings ? [
    { name: 'FAJR', nameAr: 'الفجر', time: timings.Fajr },
    { name: 'SHUROOQ', nameAr: 'الشروق', time: timings.Sunrise },
    { name: 'ZUHR', nameAr: 'الظهر', time: timings.Dhuhr },
    { name: 'ASR', nameAr: 'العصر', time: timings.Asr },
    { name: 'MAGHRIB', nameAr: 'المغرب', time: timings.Maghrib },
    { name: 'ISHA', nameAr: 'العشاء', time: timings.Isha },
  ] : [];

  return (
    <div className="min-h-screen bg-black text-red-600 font-mono flex flex-col items-center justify-between p-6 select-none">
      
      {/* Header */}
      <div className="w-full text-center border-b-2 border-red-900 pb-4">
        <h1 className="text-2xl font-bold tracking-widest text-amber-500">AL-FATIHA</h1>
        <p className="text-xs text-amber-600/70 tracking-wider">AZAN DIGITAL CLOCK</p>
      </div>

      {/* Test Audio Button */}
      <button 
        onClick={toggleTestAudio}
        className={`w-full my-2 font-bold py-2 rounded text-center transition-colors cursor-pointer border ${
          isPlayingTest 
            ? 'bg-red-950 text-red-400 border-red-600 animate-pulse' 
            : 'bg-zinc-900 text-amber-500 border-zinc-700 hover:border-amber-500'
        }`}
      >
        {isPlayingTest ? 'STOP AUDIO TEST' : 'TEST AZAN AUDIO'}
      </button>

      {/* Hauptuhrzeit & Datum */}
      <div className="w-full my-2 bg-zinc-950 border-2 border-red-900/50 rounded-xl p-6 text-center shadow-[0_0_30px_rgba(239,68,68,0.15)]">
        <div className="text-6xl font-black tracking-wider text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
          {time || '00:00:00'}
        </div>
        <div className="text-xl font-bold text-red-300 mt-2 tracking-widest">
          {dateStr || '--.--.----'}
        </div>
      </div>

      {/* Gebetszeiten Liste */}
      <div className="w-full flex-1 flex flex-col justify-center gap-3 my-2">
        {prayers.map((prayer) => (
          <div 
            key={prayer.name} 
            className="flex justify-between items-center bg-zinc-900/80 border-l-4 border-red-600 px-6 py-4 rounded-r-lg shadow-inner"
          >
            <span className="text-lg font-bold text-red-400 tracking-wider">{prayer.name}</span>
            <span className="text-xl font-bold text-amber-500">{prayer.nameAr}</span>
            <span className="text-2xl font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
              {prayer.time}
            </span>
          </div>
        ))}
      </div>

      {/* Standort-Einstellungen */}
      <div className="w-full grid grid-cols-3 gap-2 mt-2 pt-4 border-t border-zinc-800">
        <input 
          type="text" 
          value={city} 
          onChange={(e) => setCity(e.target.value)} 
          placeholder="Stadt"
          className="bg-zinc-900 text-white text-sm px-3 py-2 rounded border border-zinc-700 text-center focus:outline-none focus:border-red-500"
        />
        <input 
          type="text" 
          value={country} 
          onChange={(e) => setCountry(e.target.value)} 
          placeholder="Land"
          className="bg-zinc-900 text-white text-sm px-3 py-2 rounded border border-zinc-700 text-center focus:outline-none focus:border-red-500"
        />
        <button 
          onClick={fetchPrayerTimes}
          className="bg-amber-600 hover:bg-amber-500 text-black font-bold text-sm rounded py-2 transition-colors cursor-pointer"
        >
          UPDATE
        </button>
      </div>

    </div>
  );
}