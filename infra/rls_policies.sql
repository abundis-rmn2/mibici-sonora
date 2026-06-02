-- Habilitar RLS en las tablas si no está habilitado
alter table public.stations enable row level security;
alter table public.events enable row level security;

-- Política para permitir acceso SELECT público a todas las estaciones
create policy "Public select for stations" 
on public.stations
for select 
using (true);

-- Política para permitir acceso SELECT público a todos los eventos
create policy "Public select for events" 
on public.events
for select 
using (true);

-- Nota: Solo habilitamos SELECT público porque solo necesitamos leer datos directamente.
-- Las escrituras (INSERT/UPDATE/DELETE) se siguen haciendo desde el Edge node con la Service Key.
