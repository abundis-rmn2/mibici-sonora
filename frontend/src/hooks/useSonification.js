import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

export function useSonification() {
  const [isReady, setIsReady] = useState(false);
  const isReadyRef = useRef(false);
  const synthRef = useRef(null);
  const reverbRef = useRef(null);

  const initAudio = async () => {
    if (isReady) {
      console.log('🔈 Audio ya estaba inicializado.');
      return;
    }
    
    console.log('🔈 Inicializando motor de Tone.js...');
    // Navegadores requieren Tone.start() tras una interacción del usuario
    await Tone.start();
    
    // HACK PARA iOS: Tocar un sonido inaudible inmediatamente en el mismo hilo de la interacción
    // para forzar a Safari a "despertar" el motor de audio.
    const unlockSynth = new Tone.Synth().toDestination();
    unlockSynth.triggerAttackRelease("C4", "64n", Tone.now(), 0);
    
    console.log('🔈 Tone.start() exitoso. Creando sintetizadores...');
    
    // Crear un reverb generoso para dar sensación de "ciudad espaciosa"
    reverbRef.current = new Tone.Reverb({
      decay: 4,
      preDelay: 0.1,
    }).toDestination();

    // 🔴 Sonidos para bike_taken (PERCUSIÓN MÚLTIPLE)
    // GDL: Boom (Kick Drum) - Más intenso
    const kickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 6, // Mayor rango de caída = más "Punch"
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.8 },
      volume: 4 // +4 decibeles para mayor intensidad
    }).connect(reverbRef.current);
    
    // ZPN: Tarola (Snare - ruido blanco) - Menos volumen, duración más corta
    const snareSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0 }, // decay de 0.2 a 0.1
      volume: -5 // -5 decibeles
    }).connect(reverbRef.current);

    // TLQ: Hi-hat (ruido rosa corto)
    const hihatSynth = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 }
    }).connect(reverbRef.current);
    
    // 🟢 Sonido para bike_returned (ARMÓNICO)
    const returnedSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.2, decay: 0.5, sustain: 0.4, release: 1.5 }
    });
    returnedSynth.maxPolyphony = 64; // Aumentar límite de voces para evitar "Max polyphony exceeded"
    returnedSynth.connect(reverbRef.current);

    // ⏱️ Sonido para el Timer / Metrónomo
    const tickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 1,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      volume: -12 // Volumen bajo para no ser molesto
    }).toDestination(); // Directo sin reverb para que sea seco y preciso

    synthRef.current = { 
      kick: kickSynth, 
      snare: snareSynth, 
      hihat: hihatSynth, 
      returned: returnedSynth,
      tick: tickSynth
    };
    setIsReady(true);
    isReadyRef.current = true;
    console.log('🔈 Motor de audio LISTO para sonar.');
  };

  const stopAudio = () => {
    console.log('🔈 Deteniendo audio.');
    setIsReady(false);
    isReadyRef.current = false;
    // Podríamos desconectar o limpiar synths aquí si fuera necesario
  };

  const lastScheduledRef = useRef({});

  const playBeatAudio = (eventsInBeat, beat) => {
    if (!isReadyRef.current || !synthRef.current || eventsInBeat.length === 0) return;
    
    // Todos los eventos en este beat se tocan "ahora"
    const time = Tone.now();
    
    // Diccionario para contar cuántas veces suena el mismo tipo de evento (nota) en este beat
    const noteCounts = {};
    
    eventsInBeat.forEach((event, i) => {
      const delta = event.delta || 1;
      const duration = delta === 1 ? '8n' : delta <= 3 ? '4n' : '2n';
      const velocity = Math.min(0.5 + (delta * 0.1), 1); 
      
      // Identificador único para saber si es la misma "nota" o sintetizador
      const noteKey = `${event.event_type}-${event.zone}`;
      const count = noteCounts[noteKey] || 0;
      noteCounts[noteKey] = count + 1;
      
      // Añadir medio tiempo (0.5 segundos) si hay notas iguales para que no se empalmen
      let safeTime = time + (count * 0.5);

      if (event.event_type === 'bike_taken') {
        let synthName = '';
        // Tocar instrumento de percusión distinto según el municipio
        if (event.zone === 'ZPN') {
           synthName = 'snare';
        } else if (event.zone === 'TLQ') {
           synthName = 'hihat';
        } else {
           synthName = 'kick';
        }

        // PREVENIR ERROR DE TONE.JS: "The time must be greater than or equal to the last scheduled time"
        // Aseguramos que el tiempo sea estrictamente mayor al último programado para ESTE sintetizador
        if (lastScheduledRef.current[synthName] && safeTime <= lastScheduledRef.current[synthName]) {
            safeTime = lastScheduledRef.current[synthName] + 0.1; // Desfasar ligeramente hacia el futuro
        }
        lastScheduledRef.current[synthName] = safeTime;

        if (synthName === 'snare') {
           synthRef.current.snare.triggerAttackRelease("32n", safeTime, velocity * 0.7);
        } else if (synthName === 'hihat') {
           synthRef.current.hihat.triggerAttackRelease("32n", safeTime, velocity * 0.5);
        } else {
           const isStrongBeat = beat === 0 || beat === 4;
           synthRef.current.kick.triggerAttackRelease(isStrongBeat ? 'C1' : 'G1', duration, safeTime, Math.min(velocity * 1.5, 1));
        }
      } else {
        const chordProgression = [
          ['C4', 'E4', 'G4', 'B4'], // Beat 0,1: Cmaj7
          ['C4', 'E4', 'G4', 'B4'], 
          ['A3', 'C4', 'E4', 'G4'], // Beat 2,3: Amin7
          ['A3', 'C4', 'E4', 'G4'], 
          ['F3', 'A3', 'C4', 'E4'], // Beat 4,5: Fmaj7
          ['F3', 'A3', 'C4', 'E4'], 
          ['G3', 'B3', 'D4', 'F4'], // Beat 6,7: Gdom7
          ['G3', 'B3', 'D4', 'F4']
        ];
        let chord = chordProgression[beat] || chordProgression[0];
        
        // Modificar octava del acorde según municipio
        if (event.zone === 'ZPN') {
           chord = chord.map(note => note.slice(0, -1) + (parseInt(note.slice(-1)) + 1));
        } else if (event.zone === 'TLQ') {
           chord = chord.map(note => note.slice(0, -1) + (parseInt(note.slice(-1)) - 1));
        }

        const synthName = 'returned';
        if (lastScheduledRef.current[synthName] && safeTime <= lastScheduledRef.current[synthName]) {
            safeTime = lastScheduledRef.current[synthName] + 0.1;
        }
        lastScheduledRef.current[synthName] = safeTime;

        synthRef.current.returned.triggerAttackRelease(chord, duration, safeTime, velocity * 0.7);
      }
    });
  };

  const playTick = (beat) => {
    if (!isReadyRef.current || !synthRef.current) return;
    const time = Tone.now();
    // Beat 0 = Acorde fuerte (inicio del reloj), Beats 1-7 = Acorde débil
    if (beat === 0) {
      synthRef.current.tick.triggerAttackRelease("C6", "32n", time, 0.6); // Click fuerte
    } else {
      synthRef.current.tick.triggerAttackRelease("G5", "32n", time, 0.2); // Click débil
    }
  };

  return { isReady, initAudio, stopAudio, playBeatAudio, playTick };
}
