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
  
  const [isAthkarPlaying, setIsAthkarPlaying] = useState(false);

  const currentAudioRef = useRef(null);
  const playedToday = useRef({});
  const timingsRef = useRef(timings);

  // Keep timingsRef in sync to avoid re-triggering main clock effect
  useEffect(() => {
    timingsRef.current = timings;
  }, [timings]);

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

  const toggleAthkar = (e) => {
    e.stopPropagation();
    
    if (isAthkarPlaying) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setIsAthkarPlaying(false);
    } else {
      setIsAthkarPlaying(true);
      playAudio('/a.opus', () => setIsAthkarPlaying(false))
        .catch((err) => {
          console.error('Athkar Audio Fehler:', err);
          setIsAthkarPlaying(false);
        });
    }
  };

  const toArabicNumerals = (str) => {
    return String(str).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  };

  const fetchPrayerTimes = async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=3&_t=${timestamp}`);
      const data = await response.json();
      if (data.code === 200) {
        setTimings(data.data.timings);

        const hijri = data.data.date.hijri;
        const dayAr = toArabicNumerals(hijri.day);
        const yearAr = toArabicNumerals(hijri.year);
        
        const hijriString = `${dayAr} ${hijri.month.ar} ${yearAr} هـ`;
        setHijriDate(hijriString);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Gebetszeiten:', error);
    }
  };

  const fetchHasselWeather = async () => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=52.798&longitude=9.208&current=temperature_2m,relative_humidity_2m,weather_code&daily=precipitation_probability_max&timezone=auto`);
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

    // Refresh prayer times daily at midnight
    const prayerInterval = setInterval(fetchPrayerTimes, 12 * 60 * 60 * 1000);
    const weatherInterval = setInterval(fetchHasselWeather, 60000);

    return () => {
      clearInterval(prayerInterval);
      clearInterval(weatherInterval);
    };
  }, [city, country]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentHoursMin = `${hours}:${minutes}`;

      setTime(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());

      const currentTimings = timingsRef.current;
      if (currentTimings) {
        const cleanFajr = currentTimings.Fajr ? currentTimings.Fajr.split(' ')[0] : '';
        const cleanDhuhr = currentTimings.Dhuhr ? currentTimings.Dhuhr.split(' ')[0] : '';
        const cleanAsr = currentTimings.Asr ? currentTimings.Asr.split(' ')[0] : '';
        const cleanMaghrib = currentTimings.Maghrib ? currentTimings.Maghrib.split(' ')[0] : '';
        const cleanIsha = currentTimings.Isha ? currentTimings.Isha.split(' ')[0] : '';

        const checkAudios = [
          { key: 'Fajr', time: cleanFajr, src: '/fajer.mp3' },
          { key: 'Dhuhr', time: cleanDhuhr, src: '/azan2.mp3' },
          { key: 'Asr', time: cleanAsr, src: '/azan2.mp3' },
          { key: 'Maghrib', time: cleanMaghrib, src: '/azan2.mp3' },
          { key: 'Isha', time: cleanIsha, src: '/azan2.mp3' },
        ];

        const todayKey = now.toDateString();

        checkAudios.forEach((p) => {
          const audioKey = `${todayKey}-${p.key}`;
          if (p.time && p.time === currentHoursMin && !playedToday.current[audioKey]) {
            setIsAthkarPlaying(false);
            playAudio(p.src)
              .then(() => {
                playedToday.current[audioKey] = true;
              })
              .catch((e) => {
                console.error(`Azan Abspiel-Fehler für ${p.key}:`, e);
              });
          }
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const renderWeatherIcon = (code) => {
    if (code === null) return null;
    if (code === 0) {
      return (
        <svg className="w-4 h-4 text-amber-400 inline" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z" clipRule="evenodd" />
        </svg>
      );
    } else if (code >= 1 && code <= 3) {
      return (
        <svg className="w-4 h-4 text-stone-300 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
        </svg>
      );
    } else if (code >= 51 && code <= 67) {
      return (
        <svg className="w-4 h-4 text-blue-400 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-amber-400 inline" fill="currentColor" viewBox="0 0 20 20">
        <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
      </svg>
    );
  };

  const prayers = timings ? [
    { nameAr: 'الفجر', time: timings.Fajr, key: 'Fajr' },
    { nameAr: 'الشروق', time: timings.Sunrise, key: 'Sunrise' },
    { nameAr: 'الظهر', time: timings.Dhuhr, key: 'Dhuhr' },
    { nameAr: 'العصر', time: timings.Asr, key: 'Asr' },
    { nameAr: 'المغرب', time: timings.Maghrib, key: 'Maghrib' },
    { nameAr: 'العشاء', time: timings.Isha, key: 'Isha' },
  ] : [];

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Lateef:wght@400;700&display=swap');
          .font-oriental { font-family: 'Amiri', serif; }
          .font-oriental-soft { font-family: 'Lateef', cursive; }
        `}
      </style>

      <div className="w-[100vh] h-[100vw] rotate-[-90deg] bg-black text-amber-100 font-sans flex flex-col justify-between p-4 select-none box-border">

        {/* Header */}
        <div className="w-full text-center border-b border-amber-500/30 pb-1.5 shrink-0 flex flex-col items-center justify-center gap-1">
          <h1 className="text-3xl font-oriental font-bold tracking-widest text-amber-500 drop-shadow-[0_2px_5px_rgba(245,158,11,0.3)]">
            مواقيت الصلاة
          </h1>
        </div>

        {/* Info-Zeile über der Uhr */}
        <div className="w-full flex justify-between items-center px-2 mt-2 mb-0.5 shrink-0">
          <span className="text-sm font-bold tracking-wider text-amber-400 uppercase">
            {city}
          </span>

          <div className="flex items-center gap-2 text-2xl shadow-2xl font-bold font-mono text-amber-400">
            <span className="flex items-center gap-1">
              {renderWeatherIcon(weatherCode)}
              {hasselTemp !== '--' ? `${hasselTemp}°C` : '--°C'}
            </span>
            <span className="text-sm text-sky-300 font-sans flex items-center gap-0.5" title="Luftfeuchtigkeit">
              💦 {humidity}%
            </span>
            <span className="text-sm text-blue-400/90 font-sans flex items-center gap-0.5" title="Regenwahrscheinlichkeit">
              🌧️ {rainProb}%
            </span>
          </div>
        </div>

        {/* Hauptuhrzeit */}
        <div className="w-full bg-stone-900/80 border border-amber-500/30 rounded-xl p-3 shadow-2xl backdrop-blur-md shrink-0 my-1 text-center">
          <div className="text-5xl font-bold tracking-widest text-stone-100 drop-shadow-[0_0_12px_rgba(255,255,255,0.2)] font-mono py-1">
            {time || '00:00:00'}
          </div>
        </div>

        {/* ZENTRALE GEBETSZEITEN */}
        <div className="w-full flex-1 flex flex-col justify-center my-2 min-h-0">
          <div className="flex justify-between items-center px-1 mb-1.5 shrink-0 text-xl font-oriental-soft text-green-400">
            <span>{dateStr || '--.--.----'}</span>
            <span dir="rtl" className="text-base">{hijriDate || '--'}</span>
          </div>
          <div className="flex flex-col justify-center flex-1 gap-1.5">
            {prayers.map((prayer, index) => (
              <div
                key={index}
                className="grid grid-cols-2 items-center bg-stone-900/80 hover:bg-stone-900 border border-amber-500/30 px-6 py-2 rounded-lg shadow-md h-full transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-oriental font-bold text-amber-200 text-left">
                    {prayer.nameAr}
                  </span>

                  {prayer.key === 'Maghrib' && (
                    <button
                      onClick={toggleAthkar}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-oriental transition-all duration-300 border cursor-pointer flex items-center gap-1 ${
                        isAthkarPlaying
                          ? 'bg-amber-500 text-black border-amber-400 animate-pulse font-bold'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      }`}
                      title="أذكار المساء"
                    >
                      <span>{isAthkarPlaying ? '⏸' : '▶'}</span>
                      <span>الأذكار</span>
                    </button>
                  )}
                </div>

                <span className="text-2xl font-bold text-amber-400 font-mono text-right">
                  {prayer.time}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}