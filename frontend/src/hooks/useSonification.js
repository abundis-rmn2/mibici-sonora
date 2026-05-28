import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

export function useSonification() {
  const [isReady, setIsReady] = useState(false);
  const isReadyRef = useRef(false);
  const synthRef = useRef(null);
  const reverbRef = useRef(null);
  const analyserRef = useRef(null);
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
    
    // Analyser para el osciloscopio
    analyserRef.current = new Tone.Analyser('waveform', 512);

    reverbRef.current = new Tone.Reverb({
      decay: 4,
      preDelay: 0.1,
    }).connect(analyserRef.current);
    analyserRef.current.toDestination(); // Conectar al master final

    // Kick Synth (Membrane)
    const kickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.8 },
      volume: 2
    }).connect(analyserRef.current); // El kick puede ir más seco o con poco reverb
    kickSynth.toDestination();

    // Hi-Hats/Snare (MetalSynth)
    const metalSynth = new Tone.MetalSynth({
      frequency: 200,
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -8
    }).connect(reverbRef.current);
    
    // Arpegios (FMSynth)
    const arpSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 10,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 1.5 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.1 },
      volume: -5
    });
    arpSynth.maxPolyphony = 32;
    arpSynth.connect(reverbRef.current);

    // Tick/Metronome
    const tickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 1,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      volume: -12
    }).toDestination();

    synthRef.current = { 
      kick: kickSynth, 
      metal: metalSynth, 
      arp: arpSynth,
      tick: tickSynth
    };

    // Configurar Transport de Tone.js (loop de 32 segundos = 8 compases a 60 bpm)
    // 60 BPM = 1 beat por segundo. Loop de 32 beats.
    Tone.Transport.bpm.value = 60; 
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = 32;
    
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

    // Distribuir equitativamente cada grupo a lo largo del compás de 32 segundos
    Object.keys(groups).forEach(key => {
       const groupEvents = groups[key];
       const count = groupEvents.length;
       const step = 32 / count; // El espacio exacto entre cada nota de esta categoría
       
       groupEvents.forEach((event, i) => {
         // Calculamos el tiempo exacto. Añadimos un minúsculo "humanize" (0.05s) para que no suene a máquina
         let timeInSeconds = (i * step) + (Math.random() * 0.05);
         if (timeInSeconds >= 32) timeInSeconds -= 32; // Prevenir desbordamiento del loop
         
         const delta = event.delta || 1;
         const duration = delta === 1 ? '8n' : delta <= 3 ? '4n' : '2n';
         const velocity = Math.min(0.5 + (delta * 0.1), 1); 

         eventsToSchedule.push({ time: timeInSeconds, event, duration, velocity });
       });
    });

    partRef.current = new Tone.Part((time, value) => {
      const { event, duration, velocity } = value;
      
      if (event.event_type === 'bike_taken') {
        if (event.zone === 'ZPN') {
           synthRef.current.metal.triggerAttackRelease("16n", time, velocity);
        } else if (event.zone === 'TLQ') {
           synthRef.current.metal.set({ envelope: { release: 0.1 } });
           synthRef.current.metal.triggerAttackRelease("8n", time, velocity * 0.8);
        } else {
           // GDL - Kick
           synthRef.current.kick.triggerAttackRelease('C1', duration, time, velocity);
        }
      } else {
        // bike_returned - Arp
        const baseOctave = event.zone === 'ZPN' ? 5 : event.zone === 'TLQ' ? 3 : 4;
        const notes = ['C', 'D', 'E', 'G', 'A']; // Pentatonic
        // Use hash of station ID or something to pick a note
        const noteIndex = event.station_id ? parseInt(event.station_id) % notes.length : 0;
        const note = `${notes[noteIndex]}${baseOctave}`;

        synthRef.current.arp.triggerAttackRelease(note, "16n", time, velocity * 0.7);
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
    analyser: analyserRef.current,
    getTransportSeconds
  };
}
