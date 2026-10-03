import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [time, setTime] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [hijriDate, setHijriDate] = useState('');
  const [city] = useState('Hassel');
  const [country] = useState('Germany');
  const [timings, setTimings] = useState(null);
  const [hasselTemp, setHasselTemp] = useState('--');
  const [humidity, setHumidity] = useState('--');
  const [rainProb, setRainProb] = useState('--');
  const [weatherCode, setWeatherCode] = useState(null);

  const [activeAthkar, setActiveAthkar] = useState(null);
  const [activeAzanOverlay, setActiveAzanOverlay] = useState(null);
  const [nextPrayerKey, setNextPrayerKey] = useState('');
  const [remainingProgress, setRemainingProgress] = useState(1);
  const [isNightMode, setIsNightMode] = useState(false);
  const [burnInOffset, setBurnInOffset] = useState({ x: 0, y: 0 });

  // Hadith State
  const [hadiths, setHadiths] = useState([]);
  const [currentHadith, setCurrentHadith] = useState(null);
  const hadithBoxRef = useRef(null);

  const currentAudioRef = useRef(null);
  const playedToday = useRef({});
  const timingsRef = useRef(timings);

  useEffect(() => {
    timingsRef.current = timings;
  }, [timings]);

  // Hadiths aus JSON laden
  useEffect(() => {
    fetch('/hadiths.json')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setHadiths(data);
          const randomIndex = Math.floor(Math.random() * data.length);
          setCurrentHadith(data[randomIndex]);
        }
      })
      .catch((err) => console.error('Fehler beim Laden der Hadithe:', err));
  }, []);

  // Nächsten Hadith auswählen
  const pickRandomHadith = (e) => {
    if (e) e.stopPropagation();
    if (hadiths.length > 0) {
      const randomIndex = Math.floor(Math.random() * hadiths.length);
      setCurrentHadith(hadiths[randomIndex]);
      if (hadithBoxRef.current) {
        hadithBoxRef.current.scrollTop = 0;
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      pickRandomHadith();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hadiths]);

  // Automatischer Scroll-Effekt
  useEffect(() => {
    if (!currentHadith) return;

    const el = hadithBoxRef.current;
    if (el) el.scrollTop = 0;

    let isWaitingAtBottom = false;

    const scrollInterval = setInterval(() => {
      const container = hadithBoxRef.current;
      if (!container || isWaitingAtBottom) return;

      const maxScroll = container.scrollHeight - container.clientHeight;

      if (maxScroll > 10) {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
          isWaitingAtBottom = true;
          setTimeout(() => {
            if (hadithBoxRef.current) {
              hadithBoxRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
            setTimeout(() => {
              isWaitingAtBottom = false;
            }, 2000);
          }, 3500);
        } else {
          container.scrollBy({ top: 32, behavior: 'smooth' });
        }
      }
    }, 4000);

    return () => clearInterval(scrollInterval);
  }, [currentHadith]);

  // Audio Player Engine
  const playAudio = (src, onEndedCallback) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    const audio = new Audio(src);
    currentAudioRef.current = audio;
    if (onEndedCallback) {
      audio.onended = onEndedCallback;
    }
    return audio.play();
  };

  // Autoplay Unlocker
  useEffect(() => {
    const unlockAudio = () => {
      const dummyAudio = new Audio('/azan2.mp3');
      dummyAudio.play().then(() => {
        dummyAudio.pause();
      }).catch(() => {});

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

  const toggleAthkar = (type, audioSrc, e) => {
    e.stopPropagation();

    if (activeAthkar === type) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setActiveAthkar(null);
    } else {
      setActiveAthkar(type);
      playAudio(audioSrc, () => setActiveAthkar(null))
        .catch((err) => {
          console.error(`Athkar Audio (${type}) Fehler:`, err);
          setActiveAthkar(null);
        });
    }
  };

  const toArabicNumerals = (str) => {
    return String(str).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  };

  // Gebetszeiten abrufen
  const fetchPrayerTimes = async () => {
    const cacheKey = `prayer_times_${new Date().toISOString().slice(0, 10)}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        setTimings(parsed.timings);
        setHijriDate(parsed.hijriString);
      } catch (err) {}
    }

    try {
      const timestamp = new Date().getTime();
      const response = await fetch(
        `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=3&_t=${timestamp}`
      );
      const data = await response.json();
      if (data.code === 200) {
        setTimings(data.data.timings);

        const hijri = data.data.date.hijri;
        const dayAr = toArabicNumerals(hijri.day);
        const yearAr = toArabicNumerals(hijri.year);
        const hijriString = `${dayAr} ${hijri.month.ar} ${yearAr} هـ`;

        setHijriDate(hijriString);
        localStorage.setItem(cacheKey, JSON.stringify({ timings: data.data.timings, hijriString }));
      }
    } catch (error) {
      console.warn('Gebetszeiten aus Cache geladen:', error);
    }
  };

  // Wetterabruf
  const fetchHasselWeather = async () => {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=52.798&longitude=9.208&current=temperature_2m,relative_humidity_2m,weather_code&daily=precipitation_probability_max&timezone=auto`
      );
      const data = await res.json();

      if (data && data.current) {
        if (typeof data.current.temperature_2m === 'number') {
          setHasselTemp(Math.round(data.current.temperature_2m));
        }
        if (typeof data.current.relative_humidity_2m === 'number') {
          setHumidity(data.current.relative_humidity_2m);
        }
        setWeatherCode(data.current.weather_code);
      }
      if (data && data.daily && data.daily.precipitation_probability_max) {
        setRainProb(data.daily.precipitation_probability_max[0]);
      }
    } catch (e) {
      console.error('Fehler beim Laden des Wetters:', e);
    }
  };

  useEffect(() => {
    fetchPrayerTimes();
    fetchHasselWeather();

    const prayerInterval = setInterval(fetchPrayerTimes, 12 * 60 * 60 * 1000);
    const weatherInterval = setInterval(fetchHasselWeather, 60000);

    return () => {
      clearInterval(prayerInterval);
      clearInterval(weatherInterval);
    };
  }, [city, country]);

  // Burn-In Protection
  useEffect(() => {
    const shiftBurnIn = () => {
      const offsetX = Math.floor(Math.random() * 5) - 2;
      const offsetY = Math.floor(Math.random() * 5) - 2;
      setBurnInOffset({ x: offsetX, y: offsetY });
    };

    const burnInInterval = setInterval(shiftBurnIn, 60 * 60 * 1000);
    return () => clearInterval(burnInInterval);
  }, []);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();

      const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();
      const isNight = currentMinutesOfDay >= 22 * 60 + 30 || currentMinutesOfDay < 4 * 60 + 30;
      setIsNightMode(isNight);

      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentHoursMin = `${hours}:${minutes}`;

      setTime(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());

      const currentTimings = timingsRef.current;
      if (currentTimings) {
        // ==========================================
        // TEST FAJER: Hier manuell manipulieren
        // const fajrTime = '02:10'; // TEST FAJER
        const fajrTime = currentTimings.Fajr?.split(' ')[0]; // TEST FAJER (Original)
        // ==========================================

        const prayerList = [
          { key: 'Fajr', nameAr: 'الفجر', time: fajrTime, src: '/fajer.mp3' },
          { key: 'Sunrise', nameAr: 'الشروق', time: currentTimings.Sunrise?.split(' ')[0], src: null },
          { key: 'Dhuhr', nameAr: 'الظهر', time: currentTimings.Dhuhr?.split(' ')[0], src: '/azan2.mp3' },
          { key: 'Asr', nameAr: 'العصر', time: currentTimings.Asr?.split(' ')[0], src: '/azan2.mp3' },
          { key: 'Maghrib', nameAr: 'المغرب', time: currentTimings.Maghrib?.split(' ')[0], src: '/azan2.mp3' },
          { key: 'Isha', nameAr: 'العشاء', time: currentTimings.Isha?.split(' ')[0], src: '/azan2.mp3' },
        ];

        const todayKey = now.toDateString();
        prayerList.forEach((p) => {
          if (!p.src) return;
          const audioKey = `${todayKey}-${p.key}`;
          if (p.time && p.time === currentHoursMin && !playedToday.current[audioKey]) {
            setActiveAthkar(null);
            setActiveAzanOverlay({ nameAr: p.nameAr, time: p.time });

            playAudio(p.src, () => {
              setActiveAzanOverlay(null);
            })
              .then(() => {
                playedToday.current[audioKey] = true;
              })
              .catch((e) => {
                console.error(`Azan Fehler ${p.key}:`, e);
              });
          }
        });

        const nowMs = now.getTime();
        let targetIndex = -1;
        let targetMs = 0;
        let previousMs = 0;

        for (let i = 0; i < prayerList.length; i++) {
          const p = prayerList[i];
          if (!p.time) continue;
          const [pHours, pMins] = p.time.split(':').map(Number);
          const pDate = new Date(now);
          pDate.setHours(pHours, pMins, 0, 0);

          if (pDate.getTime() > nowMs) {
            targetIndex = i;
            targetMs = pDate.getTime();

            if (i > 0 && prayerList[i - 1].time) {
              const [prevH, prevM] = prayerList[i - 1].time.split(':').map(Number);
              const prevDate = new Date(now);
              prevDate.setHours(prevH, prevM, 0, 0);
              previousMs = prevDate.getTime();
            } else {
              const [lastH, lastM] = prayerList[prayerList.length - 1].time.split(':').map(Number);
              const yestDate = new Date(now);
              yestDate.setDate(yestDate.getDate() - 1);
              yestDate.setHours(lastH, lastM, 0, 0);
              previousMs = yestDate.getTime();
            }
            break;
          }
        }

        if (targetIndex === -1 && prayerList[0].time) {
          targetIndex = 0;
          const [pHours, pMins] = prayerList[0].time.split(':').map(Number);
          const tomorrowFajr = new Date(now);
          tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
          tomorrowFajr.setHours(pHours, pMins, 0, 0);
          targetMs = tomorrowFajr.getTime();

          const [lastH, lastM] = prayerList[prayerList.length - 1].time.split(':').map(Number);
          const lastDate = new Date(now);
          lastDate.setHours(lastH, lastM, 0, 0);
          previousMs = lastDate.getTime();
        }

        if (targetIndex !== -1) {
          setNextPrayerKey(prayerList[targetIndex].key);
          const totalDuration = targetMs - previousMs;
          const timeRemaining = targetMs - nowMs;
          const ratio = Math.max(0, Math.min(1, timeRemaining / totalDuration));
          setRemainingProgress(ratio);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const renderWeatherIcon = (code) => {
    if (code === null) return null;
    if (code === 0) {
      return (
        <svg className="w-7 h-7 text-amber-400 inline" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z" clipRule="evenodd" />
        </svg>
      );
    } else if (code >= 1 && code <= 3) {
      return (
        <svg className="w-7 h-7 text-stone-300 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
        </svg>
      );
    } else if (code >= 51 && code <= 67) {
      return (
        <svg className="w-7 h-7 text-blue-400 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
        </svg>
      );
    }
    return (
      <svg className="w-7 h-7 text-amber-400 inline" fill="currentColor" viewBox="0 0 20 20">
        <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
      </svg>
    );
  };

  const prayers = timings ? [
    { nameAr: 'الفجر', time: timings.Fajr?.split(' ')[0], key: 'Fajr' },
    { nameAr: 'الشروق', time: timings.Sunrise?.split(' ')[0], key: 'Sunrise' },
    { nameAr: 'الظهر', time: timings.Dhuhr?.split(' ')[0], key: 'Dhuhr' },
    { nameAr: 'العصر', time: timings.Asr?.split(' ')[0], key: 'Asr' },
    { nameAr: 'المغرب', time: timings.Maghrib?.split(' ')[0], key: 'Maghrib' },
    { nameAr: 'العشاء', time: timings.Isha?.split(' ')[0], key: 'Isha' },
  ] : [];

  return (
    <div className={`fixed inset-0 w-screen h-screen bg-black flex items-center justify-center overflow-hidden transition-opacity duration-1000 ${isNightMode ? 'opacity-55' : 'opacity-100'}`}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Lateef:wght@400;700&display=swap');
          
          html, body, #root {
            width: 100vw;
            height: 100vh;
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: #000000;
          }

          :root {
            color-scheme: dark only;
          }

          .font-oriental { font-family: 'Amiri', serif; }
          .font-oriental-soft { font-family: 'Lateef', cursive; }

          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }

          @keyframes flicker {
            0%, 100% { filter: drop-shadow(0 0 6px #f59e0b) drop-shadow(0 0 14px #ef4444); opacity: 1; }
            50% { filter: drop-shadow(0 0 3px #fbbf24) drop-shadow(0 0 8px #f97316); opacity: 0.85; }
          }

          .flame-torch {
            animation: flicker 1s infinite alternate ease-in-out;
          }
        `}
      </style>

      {/* Rotiert um 90 Grad, Ausgleich des Monitorrahmens + Pixel-Shift */}
      <div 
        style={{
          width: '100vh',
          height: '100vw',
          transform: `rotate(-90deg) translateY(calc(0.5cm - 10px + ${burnInOffset.y}px)) translateX(${burnInOffset.x}px)`,
          transformOrigin: 'center center'
        }}
        className="bg-black text-amber-100 flex flex-col justify-between pt-2 pb-6 px-4 select-none box-border overflow-hidden"
      >
        {/* AZAN FULLSCREEN OVERLAY */}
        {activeAzanOverlay && (
          <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
            <img
              src="/athan.svg"
              alt="Azan Visual"
              style={{ filter: 'none' }}
              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none bg-black"
            />
            <div className="relative z-10 flex flex-col items-center justify-center text-center -translate-y-16 pointer-events-none w-full px-4">
              <span className="text-amber-300 font-oriental text-4xl md:text-5xl font-bold tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                حان الآن موعد صلاة
              </span>
              <span className="text-white font-oriental font-bold text-7xl md:text-8xl my-2 drop-shadow-[0_4px_14px_rgba(0,0,0,0.95)]">
                {activeAzanOverlay.nameAr}
              </span>
              <span className="text-amber-400 font-mono font-bold text-6xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                {activeAzanOverlay.time}
              </span>
              <span className="text-stone-300 font-mono text-3xl mt-3 tracking-widest opacity-85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                {time}
              </span>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="w-full text-center border-b border-amber-500/25 pb-1 shrink-0 flex flex-col items-center justify-center">
          <h1 className="text-4xl font-oriental font-bold tracking-widest text-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.3)]">
            مواقيت الصلاة
          </h1>
        </header>

        {/* Info-Zeile */}
        <div className="w-full flex justify-between items-center px-2 shrink-0 my-1">
          <span className="text-lg font-bold tracking-wider text-amber-400 uppercase">
            {city}
          </span>

          <div className="flex items-center gap-3 text-2xl font-bold font-mono text-amber-400">
            <span className="flex items-center gap-1.5">
              {renderWeatherIcon(weatherCode)}
              {hasselTemp !== '--' ? `${hasselTemp}°C` : '--°C'}
            </span>
            <span className="text-base text-sky-300 font-sans flex items-center gap-0.5">
              💦 {humidity}%
            </span>
            <span className="text-base text-blue-400/90 font-sans flex items-center gap-0.5">
              🌧️ {rainProb}%
            </span>
          </div>
        </div>

        {/* Hauptuhr */}
        <div className="w-full bg-black/90 border border-amber-500/35 rounded-2xl py-1 px-3 shadow-2xl backdrop-blur-md shrink-0 text-center">
          <div className="text-5xl font-bold tracking-widest text-stone-100 drop-shadow-[0_0_12px_rgba(255,255,255,0.25)] font-mono py-0.5">
            {time || '00:00:00'}
          </div>
        </div>

        {/* Hadith-Kasten mit auffälligem goldenen Rahmen ohne Nummer */}
        {currentHadith && (
          <div 
            dir="rtl"
            className="w-full h-28 my-1 bg-gradient-to-b from-stone-950 via-black to-stone-950 border-2 border-amber-400 ring-1 ring-amber-400/30 shadow-[0_0_20px_rgba(245,158,11,0.25)] rounded-2xl px-4 py-2 flex flex-col justify-between relative overflow-hidden"
          >
            {/* Scrollbarer Textbereich */}
            <div 
              ref={hadithBoxRef}
              className="w-full flex-1 overflow-y-auto no-scrollbar pr-1"
            >
              <p className="font-oriental text-amber-100 text-base md:text-lg leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] text-center select-none">
                {currentHadith.text}
              </p>
            </div>

            {/* Fußleiste zentriert mit dem Wechsel-Button */}
            <div className="w-full flex items-center justify-center shrink-0 border-t border-amber-500/30 pt-1 mt-1">
              <button
                onClick={pickRandomHadith}
                className="px-4 py-0.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400 text-amber-300 font-oriental text-xs rounded-full transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
              >
                <span>حديث آخر</span>
                <span>↻</span>
              </button>
            </div>
          </div>
        )}

        {/* Gebetszeiten-Container */}
        <main className="w-full flex-1 flex flex-col justify-center min-h-0">
          <div className="flex justify-between items-center px-2 mb-1 shrink-0 text-2xl font-oriental-soft text-amber-400">
            <span>{dateStr || '--.--.----'}</span>
            <span dir="rtl" className="text-xl font-oriental">{hijriDate || '--'}</span>
          </div>

          <div className="flex flex-col justify-between flex-1 gap-1.5">
            {prayers.map((prayer, index) => {
              const isNext = prayer.key === nextPrayerKey;

              return (
                <div
                  key={index}
                  className={`relative grid grid-cols-2 items-center px-6 py-2 rounded-xl shadow-lg flex-1 transition-all overflow-hidden ${
                    isNext
                      ? 'bg-amber-950/30'
                      : 'bg-black/85 hover:bg-stone-950 border border-amber-500/25'
                  }`}
                >
                  {/* Animierter schrumpfender Border */}
                  {isNext && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                      <defs>
                        <linearGradient id="torchLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#d97706" />
                          <stop offset="85%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#ffffff" />
                        </linearGradient>
                      </defs>

                      <rect
                        x="2"
                        y="2"
                        width="calc(100% - 4px)"
                        height="calc(100% - 4px)"
                        rx="10"
                        ry="10"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeOpacity="0.2"
                      />

                      <rect
                        x="2"
                        y="2"
                        width="calc(100% - 4px)"
                        height="calc(100% - 4px)"
                        rx="10"
                        ry="10"
                        fill="none"
                        stroke="url(#torchLineGrad)"
                        strokeWidth="2.5"
                        pathLength="100"
                        strokeDasharray="100"
                        strokeDashoffset={100 * (1 - remainingProgress)}
                        className="transition-all duration-1000 ease-linear flame-torch"
                      />
                    </svg>
                  )}

                  <div className="flex items-center gap-3 relative z-10">
                    <span className={`text-4xl font-oriental font-bold text-left ${isNext ? 'text-amber-300' : 'text-amber-200'}`}>
                      {prayer.nameAr}
                    </span>

                    {/* أذكار الصباح bei Fajr */}
                    {prayer.key === 'Fajr' && (
                      <button
                        onClick={(e) => toggleAthkar('sabah', '/sabah.mp3', e)}
                        className={`px-3 py-1 rounded-full text-sm font-oriental transition-all duration-300 border cursor-pointer flex items-center gap-1.5 ${
                          activeAthkar === 'sabah'
                            ? 'bg-amber-500 text-black border-amber-400 animate-pulse font-bold'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                        }`}
                        title="أذكار الصباح"
                      >
                        <span>{activeAthkar === 'sabah' ? '⏸' : '▶'}</span>
                        <span>الأذكار</span>
                      </button>
                    )}

                    {/* أذكار المساء bei Maghrib */}
                    {prayer.key === 'Maghrib' && (
                      <button
                        onClick={(e) => toggleAthkar('masa', '/a.mp3', e)}
                        className={`px-3 py-1 rounded-full text-sm font-oriental transition-all duration-300 border cursor-pointer flex items-center gap-1.5 ${
                          activeAthkar === 'masa'
                            ? 'bg-amber-500 text-black border-amber-400 animate-pulse font-bold'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                        }`}
                        title="أذكار المساء"
                      >
                        <span>{activeAthkar === 'masa' ? '⏸' : '▶'}</span>
                        <span>الأذكار</span>
                      </button>
                    )}
                  </div>

                  <span className={`text-4xl font-bold font-mono text-right relative z-10 ${isNext ? 'text-amber-300' : 'text-amber-400'}`}>
                    {prayer.time}
                  </span>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}