# Daily Focus Sync — Task Cards

---

1) **Sincronização de Sessões Daily Focus**: Persistir o histórico completo de sessões (level, tarefas, modos, horários) no Supabase para que o usuário veja no computador o que fez no celular e vice-versa.

- Pedido:
Contexto: o projeto é TaskFlow (React + Vite + Supabase). Arquivo de histórico: `frontend/src/lib/dailyFocusHistory.js`. A função `addSession(session)` salva no localStorage com a chave `daily_focus_history`. A função `getSessions()` lê do localStorage. O Supabase client está em `frontend/src/lib/supabase.js`. Auth usa `supabase.auth.getUser()`.

Tarefas:

1. Criar migration SQL em `supabase/daily_focus_sessions_migration.sql`:
```sql
CREATE TABLE daily_focus_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed_at TIME,
  level INTEGER NOT NULL DEFAULT 1,
  tasks TEXT[] NOT NULL DEFAULT '{}',
  timings JSONB NOT NULL DEFAULT '[]',
  rush_mode BOOLEAN NOT NULL DEFAULT false,
  estado_id TEXT,
  tab_mode BOOLEAN NOT NULL DEFAULT false,
  cycle_count INTEGER NOT NULL DEFAULT 0,
  tabs_opened INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE daily_focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY 'user_own_sessions' ON daily_focus_sessions
  FOR ALL USING (auth.uid() = user_id);
```

2. Em `frontend/src/api/dailyFocusSessions.js` (novo arquivo), criar:
- `saveSession(session)`: insere no Supabase (converte date de 'DD/MM/YYYY' para ISO 'YYYY-MM-DD' antes de inserir)
- `fetchSessions()`: busca todas as sessões do usuário logado, ordenadas por created_at DESC, mapeia de volta para o formato do app

3. Em `frontend/src/lib/dailyFocusHistory.js`, modificar:
- `addSession(session)`: após salvar no localStorage, chamar `saveSession(session)` da API (sem await — fire and forget para não bloquear UI)
- `getSessions()`: manter leitura do localStorage como fallback; criar nova função `loadRemoteSessions()` que faz fetch do Supabase e mescla com localStorage (deduplicar por `date + completedAt`)

4. Em `frontend/src/main.jsx` ou no componente de boot da app (onde auth é verificado), após login chamar `loadRemoteSessions()` e popular o localStorage com os dados do Supabase para que todo o resto do app continue funcionando sem mudança.

5. O `frontend/src/components/dashboard/DashboardPage.jsx` já usa `getSessions()` — vai funcionar automaticamente após a mesclagem no boot.

Preservar formato de data local (DD/MM/YYYY) no localStorage. Não quebrar fluxo offline.

- Implementação:

---

2) **Sincronização de Check-ins e Feedbacks**: Persistir os check-ins emocionais e feedbacks pós-sessão no Supabase para alimentar corretamente as seções 'Estados Emocionais' e 'Mais Eficazes' do Dashboard com dados de todos os dispositivos.

- Pedido:
Contexto: `frontend/src/lib/checkinLog.js` gerencia dois arrays no localStorage: `checkinLog` (entradas: {estadoId, modeId, date, hour}) e `checkinFeedback` (entradas: {estadoId, modeId, rating, date}). As funções são `logCheckinUsage(estadoId, modeId)` e `logSessionFeedback(estadoId, modeId, rating)`. O Dashboard lê via `getCheckinLog()` e `getSessionFeedback()`.

Tarefas:

1. Criar migration SQL `supabase/daily_focus_checkins_migration.sql`:
```sql
CREATE TABLE daily_focus_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estado_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL,
  rating SMALLINT DEFAULT NULL CHECK (rating IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE daily_focus_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY 'user_own_checkins' ON daily_focus_checkins
  FOR ALL USING (auth.uid() = user_id);
```

2. Em `frontend/src/api/dailyFocusCheckins.js` (novo arquivo):
- `saveCheckin(estadoId, modeId, date, hour)`: INSERT no Supabase
- `updateCheckinFeedback(estadoId, modeId, date, rating)`: UPDATE no registro mais recente com aquele estadoId+modeId+date
- `fetchCheckins()`: busca todos os registros do usuário

3. Em `frontend/src/lib/checkinLog.js`:
- `logCheckinUsage(estadoId, modeId)`: após localStorage, chamar `saveCheckin(...)` fire-and-forget
- `logSessionFeedback(estadoId, modeId, rating)`: após localStorage, chamar `updateCheckinFeedback(...)` fire-and-forget
- Criar `loadRemoteCheckins()`: fetch e mescla com localStorage (deduplicar por date+estadoId+hour)

4. No boot do app (após login), chamar `loadRemoteCheckins()`.

5. Não mudar nada no DashboardPage.jsx — ele já lê via `getCheckinLog()` e `getSessionFeedback()`, que agora terão dados de todos os dispositivos.

- Implementação:

---

3) **Estado Diário Cross-Device (Nível e Modos Usados Hoje)**: Sincronizar o nível atual do dia e os modos já utilizados com o Supabase para que, ao trocar de dispositivo durante o dia, o usuário continue de onde parou.

- Pedido:
Contexto: `frontend/src/lib/dailyFocusDay.js` mantém no localStorage a chave `taskflow.dailyFocus.day` com shape: `{date: 'YYYY-MM-DD', level: number, usedModes: {[modeId]: count}}`. Funções: `getTodayRecord()`, `setTodayRecord(record)`, `incrementTodayMode(modeId)`, `getTodayLevel()`.

Tarefas:

1. Criar migration SQL `supabase/daily_focus_day_state_migration.sql`:
```sql
CREATE TABLE daily_focus_day_state (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  used_modes JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
ALTER TABLE daily_focus_day_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY 'user_own_day_state' ON daily_focus_day_state
  FOR ALL USING (auth.uid() = user_id);
```

2. Em `frontend/src/api/dailyFocusDayState.js` (novo arquivo):
- `fetchTodayState()`: SELECT onde date = today e user_id = auth.uid()
- `upsertTodayState(level, usedModes)`: UPSERT com ON CONFLICT (user_id, date) DO UPDATE

3. Em `frontend/src/lib/dailyFocusDay.js`:
- `setTodayRecord(record)`: após salvar no localStorage, chamar `upsertTodayState(...)` fire-and-forget
- `loadRemoteTodayState()`: fetch do Supabase; se existir e for de hoje, mesclar com localStorage (pegar o maior level entre os dois, unir usedModes somando contagens)

4. No boot do app, chamar `loadRemoteTodayState()`.

5. Em `DailyFocusPage.jsx`, o botão de iniciar sessão já usa `getTodayRecord()` para saber quais modos estão bloqueados — vai funcionar automaticamente.

- Implementação:

---

4) **Achievements Cross-Device**: Persistir conquistas desbloqueadas no Supabase para que o usuário não perca seus troféus ao usar outro dispositivo.

- Pedido:
Contexto: `frontend/src/lib/dailyFocusAchievements.js` salva no localStorage com chave `daily_focus_achievements` um array de strings com IDs das conquistas desbloqueadas (ex: ['first_session', 'level_3', 'rush_master']). Funções: `getAchievements()`, `addAchievement(id)`, `hasAchievement(id)`.

Tarefas:

1. Criar migration SQL `supabase/daily_focus_achievements_migration.sql`:
```sql
CREATE TABLE daily_focus_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id)
);
ALTER TABLE daily_focus_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY 'user_own_achievements' ON daily_focus_achievements
  FOR ALL USING (auth.uid() = user_id);
```

2. Em `frontend/src/api/dailyFocusAchievements.js` (novo arquivo):
- `fetchAchievements()`: SELECT achievement_ids WHERE user_id = auth.uid()
- `upsertAchievement(id)`: UPSERT fazendo array_append no achievement_ids existente

3. Em `frontend/src/lib/dailyFocusAchievements.js`:
- `addAchievement(id)`: após localStorage, chamar `upsertAchievement(id)` fire-and-forget
- `loadRemoteAchievements()`: fetch do Supabase; fazer union com localStorage (Set para deduplicar) e salvar no localStorage

4. No boot do app, chamar `loadRemoteAchievements()`.

5. O DashboardPage.jsx e os toasts de conquista em DailyFocusPage.jsx já usam `getAchievements()` — funcionarão automaticamente.

- Implementação:

---

5) **Dashboard Analítico Avançado — Daily Focus**: Enriquecer o Dashboard com gráficos e insights personalizados baseados no histórico sincronizado: melhores dias da semana, eficácia por modo, nível médio por humor e card de insight personalizado.

- Pedido:
Contexto: `frontend/src/components/dashboard/DashboardPage.jsx` (547 linhas) já usa Recharts para gráficos. Dados via `getSessions()` (dailyFocusHistory.js) e `getCheckinLog()` + `getSessionFeedback()` (checkinLog.js). Modos definidos em `frontend/src/data/modes.js`.

Tarefas:

1. Criar `frontend/src/components/dashboard/MoodPatternChart.jsx`:
- RadarChart (Recharts) com level médio por dia da semana (Dom a Sáb)
- Dados de `getSessions()` agrupados por `new Date(session.date).getDay()`
- Título: 'Seus melhores dias'

2. Criar `frontend/src/components/dashboard/ModeEffectivenessChart.jsx`:
- BarChart horizontal com % de feedbacks positivos por modo (só modos com 2+ feedbacks)
- Dados de `getSessionFeedback()` agrupados por modeId
- Buscar nome e emoji do modo em `modes.js`
- Substituir lista 'Mais Eficazes' atual por este componente

3. Criar `frontend/src/components/dashboard/InsightCard.jsx`:
- Card de texto com insight gerado localmente (sem IA)
- Lógica: achar par (dayOfWeek, modeId) com maior level médio no último mês
- Template: 'Você tende a ter sessões de nível mais alto às {dia} usando {emoji} {nome}'
- Se dados insuficientes (<5 sessões no mês), mostrar: 'Complete mais sessões para ver seus insights personalizados ✨'

4. Criar `frontend/src/components/dashboard/MoodLevelChart.jsx`:
- BarChart com level médio por estado emocional (estados com 3+ sessões)
- Emojis: travado 😶, cansado 😪, ansioso 😬, sem_foco 🌀, disperso 🍃, bem 😊, energizado ⚡
- Dados cruzando estadoId + level de `getSessions()`

5. Em `DashboardPage.jsx`, adicionar seção 'Insights Pessoais' após achievements, importando os 4 componentes acima. Manter layout CSS Modules responsivo seguindo padrão existente do arquivo.

- Implementação:
