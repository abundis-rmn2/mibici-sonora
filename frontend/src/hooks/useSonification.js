import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { CONFIG } from '../config/constants';

export function useSonification() {
  const [isReady, setIsReady] = useState(false);
  const isReadyRef = useRef(false);
  const synthRef = useRef(null);
  const reverbRef = useRef(null);
  const analyserReturnedRef = useRef(null);
  const analyserTakenRef = useRef(null);
  const echoRef = useRef(null); // Ref para el nuevo Echo (FeedbackDelay)
  const partRef = useRef(null);
  const onRippleRef = useRef(null); // Ref to hold the current callback
  const drawCallbackRef = useRef(null); // Ref to hold the draw callback

  // Function to update the callback so Tone.Draw always calls the latest one
  const setOnRipple = (callback) => {
    onRippleRef.current = callback;
  };

  const initAudio = async () => {
    if (isReady) {
      console.log('🔈 Audio ya estaba inicializado.');
      return;
    }
    
    console.log('🔈 Inicializando motor de Tone.js...');
    await Tone.start();
    
    const unlockSynth = new Tone.Synth().toDestination();
    unlockSynth.triggerAttackRelease("C4", "64n", Tone.now(), 0);
    
    console.log('🔈 Tone.start() exitoso. Creando sintetizadores techno...');
    
    // Analysers separados para el osciloscopio
    analyserReturnedRef.current = new Tone.Analyser('waveform', 512);
    analyserTakenRef.current = new Tone.Analyser('waveform', 512);

    // CRÍTICO: Los analizadores se congelan (freezan) si son un "callejón sin salida" en el grafo de Web Audio.
    // Para solucionarlo, los conectamos a un canal maestro en completo silencio (Gain = 0) que va al Destination.
    const keepAliveGain = new Tone.Gain(0).toDestination();
    analyserReturnedRef.current.connect(keepAliveGain);
    analyserTakenRef.current.connect(keepAliveGain);

    reverbRef.current = new Tone.Reverb({
      decay: 8, // Dub reverb (cola muy larga)
      preDelay: 0.15, // Separación del ataque
      wet: 0.55 // Mucha presencia ambiental
    }).toDestination();

    // Kick Synth (Membrane) - SECCO (Dry) y más agudo
    const kickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.08, // Curva más natural
      octaves: 1.5, // Reducir el barrido para que no suene a cohete (peww)
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.0, release: 0.2 },
      volume: -4 // Bajado de volumen a petición
    });
    kickSynth.connect(analyserReturnedRef.current); // Al osciloscopio rojo
    kickSynth.toDestination(); // Directo a la salida (CERO reverb)

    // Hi-Hats/Snare (MetalSynth) para Zapopan y Tlaquepaque
    const metalSynth = new Tone.MetalSynth({
      frequency: 250,
      envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: 2 // Bajamos un poco porque el reverb lo inflará
    });
    metalSynth.connect(analyserReturnedRef.current); // Al osciloscopio rojo
    metalSynth.connect(reverbRef.current); // Al Dub Reverb
    metalSynth.toDestination(); // Para mantener el ataque seco presente
    
    // Arpegios (FMSynth)
    const arpSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 10,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 1.5 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.1 },
      volume: 2 // Subir volumen para que ZPN y TLQ resalten
    });
    arpSynth.maxPolyphony = 32;

    // Mucho mucho Echo (Feedback Delay) exclusivo para los arpegios
    echoRef.current = new Tone.FeedbackDelay({
      delayTime: "4n.", // Delay con ritmo con puntillo
      feedback: 0.65, // Muchas repeticiones
      wet: 0.6 // Volumen alto del eco
    }).connect(reverbRef.current); // El eco va al Dub Reverb para expandirse aún más

    // Conectar el Echo al analizador verde para que visualice también las colas del delay
    echoRef.current.connect(analyserTakenRef.current);

    arpSynth.connect(echoRef.current); // Al Echo Masivo
    // arpSynth pasa a través del Echo, el cual alimenta tanto al analizador como al reverb.

    // Tick/Metronome (Cambiado a Synth simple para evitar que suene como bombo extra)
    const tickSynth = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      volume: -16
    }).toDestination();

    synthRef.current = { 
      kick: kickSynth, 
      metal: metalSynth, 
      arp: arpSynth,
      tick: tickSynth
    };

    // Configurar Transport de Tone.js (loop de CONFIG.LOOP_DURATION_SECONDS segundos = compases a 60 bpm)
    // 60 BPM = 1 beat por segundo. Loop de LOOP_DURATION_SECONDS beats.
    Tone.Transport.bpm.value = 60; 
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = CONFIG.LOOP_DURATION_SECONDS;
    
    setIsReady(true);
    isReadyRef.current = true;
    
    // Tone.Transport.start(); // Iniciar el bucle solo después del primer fetch y la primera partitura
    console.log('🔈 Motor de audio LISTO, esperando primer fetch para iniciar loop.');
  };

  const stopAudio = () => {
    console.log('🔈 Deteniendo audio.');
    Tone.Transport.stop();
    setIsReady(false);
    isReadyRef.current = false;
  };

  const transportStartedRef = useRef(false);

  const scheduleEvents = (enrichedEvents) => {
    if (!isReadyRef.current || !synthRef.current) return [];
    
    // Limpiar partitura anterior si existe
    if (partRef.current) {
      partRef.current.dispose();
    }

    const eventsToSchedule = [];

    // Agrupar por categoría (tipo + zona) para no empalmarlos
    const groups = {};
    enrichedEvents.forEach(e => {
       const key = `${e.event_type}-${e.zone}`;
       if (!groups[key]) groups[key] = [];
       groups[key].push(e);
    });

    // Distribuir equitativamente cada grupo a lo largo del compás de CONFIG.LOOP_DURATION_SECONDS
    Object.keys(groups).forEach(key => {
       const groupEvents = groups[key];
       const count = groupEvents.length;
       const step = CONFIG.LOOP_DURATION_SECONDS / count; // El espacio exacto entre cada nota de esta categoría
       
       groupEvents.forEach((event, i) => {
         // Calculamos el tiempo exacto. Añadimos más "humanize" (swing aleatorio) para que no suene tan rígido
         let timeInSeconds = (i * step) + (Math.random() * 0.25) - 0.1; // +/- aleatoriedad
         
         // Desfase de medio segundo para los puntos rojos/bicis ancladas (contratiempo)
         if (event.event_type === 'bike_returned') {
           timeInSeconds += 0.5;
         }

         if (timeInSeconds >= CONFIG.LOOP_DURATION_SECONDS) timeInSeconds -= CONFIG.LOOP_DURATION_SECONDS; // Prevenir desbordamiento del loop
         if (timeInSeconds < 0) timeInSeconds += CONFIG.LOOP_DURATION_SECONDS;
         
         const delta = event.delta || 1;
         const duration = delta === 1 ? '8n' : delta <= 3 ? '4n' : '2n';
         // Aleatorizar un poco el volumen (velocity) para que suene más orgánico
         const velocity = Math.min(0.4 + (Math.random() * 0.3) + (delta * 0.1), 1); 

         eventsToSchedule.push({ time: timeInSeconds, event, duration, velocity });
       });
    });

    partRef.current = new Tone.Part((time, value) => {
      const { event, duration, velocity } = value;
      
      // Invertido a petición: Bicis devueltas (bike_returned) suenan como percusión (batería rítmica)
      if (event.event_type === 'bike_returned') {
        // Añadir "groove" extra: pequeño desfase aleatorio para las percusiones
        const jitter = (Math.random() * 0.15) - 0.075; 
        const playTime = time + jitter;

        if (event.zone === 'ZPN') {
           synthRef.current.metal.triggerAttackRelease("16n", playTime, velocity);
        } else if (event.zone === 'TLQ') {
           synthRef.current.metal.set({ envelope: { release: 0.1 } });
           synthRef.current.metal.triggerAttackRelease("8n", playTime, velocity * 0.8);
        } else {
           // GDL - Kick (Afinación más aguda a petición)
           const kickPitches = ['C3', 'D3', 'E3', 'G3'];
           const randomPitch = kickPitches[Math.floor(Math.random() * kickPitches.length)];
           synthRef.current.kick.triggerAttackRelease(randomPitch, duration, playTime, velocity);
        }
      } else {
        // Invertido: Bicis tomadas (bike_taken) suenan como Arpegios (melódico)
        const baseOctave = event.zone === 'ZPN' ? 5 : event.zone === 'TLQ' ? 3 : 4;
        const notes = ['C', 'D', 'E', 'G', 'A']; // Pentatonic
        // Use hash of station ID or something to pick a note
        const noteIndex = event.station_id ? parseInt(event.station_id) % notes.length : 0;
        const noteName = notes[noteIndex];
        const mainNote = `${noteName}${baseOctave}`;

        // Nota principal
        synthRef.current.arp.triggerAttackRelease(mainNote, "16n", time, velocity * 0.7);

        // "una nota abajo a y medio segundo despues para darle otra profundidad"
        const lowerNote = `${noteName}${baseOctave - 1}`;
        synthRef.current.arp.triggerAttackRelease(lowerNote, "8n", time + 0.5, velocity * 0.5);
      }

      // Sincronización Visual: Programar el ripple en el mapa usando Tone.Draw
      Tone.Draw.schedule(() => {
        if (onRippleRef.current) {
          onRippleRef.current(event);
        }
      }, time);

    }, eventsToSchedule).start(0);
    
    // Iniciar Transport una sola vez después de la primera partitura
    if (!transportStartedRef.current) {
      Tone.Transport.start();
      transportStartedRef.current = true;
      console.log('🔈 Transport iniciado después del primer fetch/partitura.');
    }

    // Resincronizar el playhead para que inicie la partitura desde cero
    // y evitar desfases entre el setInterval (polling) y el loop de Tone.js
    Tone.Transport.seconds = 0;

    return eventsToSchedule;
  };

  const playTick = (beat) => {
    // Si queremos el tick sincronizado, deberíamos programarlo en el loop en vez de tocarlo manual
    // Para simplificar, dejaremos que la UI lo llame, o lo ignoramos. 
    // Como el metrónomo es visual, lo mejor es que UI siga haciendo el setTimeout o use Tone.Transport.
    // Dejaré el método manual para que page.js lo siga llamando.
    if (!isReadyRef.current || !synthRef.current) return;
    const time = Tone.now();
    if (beat === 0) {
      synthRef.current.tick.triggerAttackRelease("C6", "32n", time, 0.6);
    } else {
      synthRef.current.tick.triggerAttackRelease("G5", "32n", time, 0.2);
    }
  };

  // Expose Tone.Transport.seconds for the sequencer
  const getTransportSeconds = () => {
    return isReadyRef.current ? Tone.Transport.seconds : 0;
  };

  return { 
    isReady, 
    initAudio, 
    stopAudio, 
    scheduleEvents, 
    playTick, 
    setOnRipple,
    analyserReturned: analyserReturnedRef.current,
    analyserTaken: analyserTakenRef.current,
    getTransportSeconds
  };
}
