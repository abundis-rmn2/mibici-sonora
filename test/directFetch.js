// test/directFetch.js
// Script para probar el cliente Supabase directamente desde NodeJS
require('dotenv').config({ path: '../frontend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
  console.log("Testeando conexión directa a Supabase...");
  
  // Test Stations
  const t1 = performance.now();
  const { data: stations, error: err1 } = await supabase.from('stations').select('*').limit(5);
  const t2 = performance.now();
  
  if (err1) {
    console.error("Error fetching stations:", err1);
  } else {
    console.log(`✅ Stations fetch exitoso (${(t2-t1).toFixed(2)}ms). Estaciones obtenidas:`, stations.length);
  }

  // Test Events
  const t3 = performance.now();
  const { data: events, error: err2 } = await supabase.from('events').select('*').order('timestamp', { ascending: false }).limit(5);
  const t4 = performance.now();

  if (err2) {
    console.error("Error fetching events:", err2);
  } else {
    console.log(`✅ Events fetch exitoso (${(t4-t3).toFixed(2)}ms). Eventos obtenidos:`, events.length);
  }
}

testFetch();
