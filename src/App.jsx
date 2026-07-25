import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [time, setTime] = useState('');
  const [milliseconds, setMilliseconds] = useState('000');
  const [dateStr, setDateStr] = useState('');
  const [hijriDate, setHijriDate] = useState('');
  const [city, setCity] = useState('Hassel');
  const [country, setCountry] = useState('Germany');
  const [timings, setTimings] = useState(null);
  const [hasselTemp, setHasselTemp] = useState('--');

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

  // Wandelt westliche Zahlen in arabische Ziffern um (z.B. 1447 -> ١٤٤٧)
  const toArabicNumerals = (str) => {
    return String(str).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  };

  const calculateIsha = (maghribStr) => {
    if (!maghribStr) return '--:--';
    const cleanTime = maghribStr.split(' ')[0];
    const [hours, minutes] = cleanTime.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) return maghribStr;

    let totalMinutes = hours * 60 + minutes + 90;
    totalMinutes = totalMinutes % (24 * 60);

    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;

    const formattedHours = String(newHours).padStart(2, '0');
    const formattedMinutes = String(newMinutes).padStart(2, '0');

    return `${formattedHours}:${formattedMinutes}`;
  };

  const fetchPrayerTimes = async () => {
    try {
      const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=3`);
      const data = await response.json();
      if (data.code === 200) {
        const fetchedTimings = { ...data.data.timings };

        if (fetchedTimings.Maghrib) {
          fetchedTimings.Isha = calculateIsha(fetchedTimings.Maghrib);
        }

        setTimings(fetchedTimings);

        const hijri = data.data.date.hijri;
        const dayAr = toArabicNumerals(hijri.day);
        const yearAr = toArabicNumerals(hijri.year);
        
        // Vollständig arabisch formatiert
        const hijriString = `${dayAr} ${hijri.month.ar} ${yearAr} هـ`;
        setHijriDate(hijriString);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Gebetszeiten:', error);
    }
  };

  const fetchHasselWeather = async () => {
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de&format=json`);
      const geoData = await geoRes.json();

      if (geoData.results && geoData.results.length > 0) {
        const { latitude, longitude } = geoData.results[0];
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`);
        const weatherData = await weatherRes.json();

        if (weatherData && weatherData.current && typeof weatherData.current.temperature_2m === 'number') {
          setHasselTemp(Math.round(weatherData.current.temperature_2m));
        }
      }
    } catch (e) {
      console.error('Fehler beim Laden des Wetters:', e);
    }
  };

  useEffect(() => {
    fetchPrayerTimes();
    fetchHasselWeather();
    const weatherInterval = setInterval(fetchHasselWeather, 60000);
    return () => clearInterval(weatherInterval);
  }, [city, country]);

  // Intervall für Uhrzeit & Millisekunden (läuft mit requestAnimationFrame für flüssige Millisekunden)
  useEffect(() => {
    let animationFrameId;

    const updateClock = () => {
      const now = new Date();
      const currentHoursMin = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

      setTime(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setMilliseconds(String(now.getMilliseconds()).padStart(3, '0'));
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
              audioRef.current.play().catch((e) => console.error('Audio blockiert:', e));
            }
          }
        });
      }

      animationFrameId = requestAnimationFrame(updateClock);
    };

    animationFrameId = requestAnimationFrame(updateClock);

    return () => cancelAnimationFrame(animationFrameId);
  }, [timings]);

  const prayers = timings ? [
    { nameAr: 'الفجر', time: timings.Fajr },
    { nameAr: 'الشروق', time: timings.Sunrise },
    { nameAr: 'الظهر', time: timings.Dhuhr },
    { nameAr: 'العصر', time: timings.Asr },
    { nameAr: 'المغرب', time: timings.Maghrib },
    { nameAr: 'العشاء', time: timings.Isha },
  ] : [];

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      <div className="w-[100vh] h-[100vw] rotate-[-90deg] bg-black text-amber-100 font-sans flex flex-col justify-between p-4 select-none box-border">

        {/* Header */}
        <div className="w-full text-center border-b border-amber-500/30 pb-1.5 shrink-0 flex flex-col items-center justify-center gap-0.5">
          <h1 className="text-xl font-serif font-bold tracking-widest text-amber-500 drop-shadow-[0_2px_5px_rgba(245,158,11,0.3)]">
            مواقيت الصلاة
          </h1>
        </div>

        {/* Info-Zeile über der Uhr */}
        <div className="w-full flex justify-between items-center px-2 mt-2 mb-0.5 shrink-0">
          <span className="text-sm font-bold tracking-wider text-amber-400 uppercase">
            {city}
          </span>
          <span className="text-sm font-bold font-mono text-amber-400">
            {hasselTemp !== '--' ? `${hasselTemp}°C` : '--°C'}
          </span>
        </div>

        {/* Hauptuhrzeit inkl. kleinen Millisekunden */}
        <div className="w-full bg-stone-900/80 border border-amber-500/30 rounded-xl p-3 shadow-2xl backdrop-blur-md shrink-0 my-1 text-center">
          <div className="flex justify-center items-baseline gap-1 font-mono py-1">
            <span className="text-5xl font-bold tracking-widest text-stone-100 drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
              {time || '00:00:00'}
            </span>
            {/* <span className="text-xs text-amber-400/70 font-mono w-8 text-left">
              .{milliseconds}
            </span> */}
          </div>
        </div>

        {/* ZENTRALE GEBETSZEITEN */}
        <div className="w-full flex-1 flex flex-col justify-center my-2 min-h-0">
          <div className="flex justify-between items-center px-1 mb-1.5 shrink-0 text-xs font-serif text-amber-400">
            <span>{dateStr || '--.--.----'}</span>
            <span dir="rtl">{hijriDate || '--'}</span>
          </div>
          <div className="flex flex-col justify-center flex-1 gap-1.5">
            {prayers.map((prayer, index) => (
              <div
                key={index}
                className="grid grid-cols-2 items-center bg-stone-900/80 hover:bg-stone-900 border border-amber-500/30 px-6 py-2 rounded-lg shadow-md h-full transition-all"
              >
                <span className="text-xl font-serif text-amber-200 text-left">
                  {prayer.nameAr}
                </span>
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