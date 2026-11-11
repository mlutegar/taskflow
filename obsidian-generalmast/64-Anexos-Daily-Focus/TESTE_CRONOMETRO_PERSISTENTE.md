# Guia de Teste: Cronômetro Persistente no Daily Focus

## Objetivo

Validar que o cronômetro continua contando corretamente mesmo quando o usuário não está com a aba aberta, minimiza o navegador, bloqueia a tela do celular ou fecha completamente o navegador.

## Pré-requisitos

1. Aplicação rodando localmente ou em staging
2. Usuário autenticado no TaskFlow
3. Acesso ao Daily Focus
4. Console do navegador aberto (para logs)

---

## Cenários de Teste

### 1. Navegação entre Abas ✅

**Passos**:
1. Iniciar sessão Daily Focus de 15 minutos
2. Trabalhar por 3 minutos (verificar que timer mostra ~12:00)
3. Trocar de aba (ir para outra aba do navegador)
4. Aguardar 5 minutos (cronometrar externamente)
5. Voltar à aba do Daily Focus

**Resultado Esperado**:
- Timer deve mostrar ~7 minutos restantes (não 12 minutos)
- Tempo transcorrido durante ausência foi corretamente descontado

**Verificação**:
```javascript
// Console log esperado ao retornar
"[DailyFocus] Timer updated: remaining 420s" // ~7min
```

---

### 2. Bloqueio de Tela (Celular) 📱

**Passos**:
1. Acessar TaskFlow no celular
2. Iniciar sessão de 10 minutos
3. Bloquear tela do celular (botão power)
4. Aguardar 8 minutos
5. Desbloquear e voltar ao app

**Resultado Esperado**:
- Timer deve mostrar ~2 minutos restantes
- FloatingModeCard deve estar sincronizado

---

### 3. Fechar e Reabrir Navegador 🔄

**Passos**:
1. Iniciar sessão de 20 minutos
2. Trabalhar por 5 minutos (timer mostra ~15:00)
3. **Fechar completamente o navegador** (não apenas a aba)
4. Aguardar 10 minutos
5. Reabrir navegador e acessar TaskFlow

**Resultado Esperado**:
- Sessão é recuperada automaticamente
- Timer mostra ~5 minutos restantes
- Fase "work" está ativa

**Verificação localStorage**:
```javascript
// No console
JSON.parse(localStorage.getItem('taskflow_sess_daily_focus'))
// Deve ter: timerRemaining ≈ 300, phase: "work"

JSON.parse(localStorage.getItem('taskflow.dailyFocus.live'))
// Deve ter: remainingSecs, anchorTs (timestamp antigo), running: true
```

---

### 4. Pausa Durante 15 Minutos ⏸️

**Passos**:
1. Iniciar sessão de 30 minutos
2. Trabalhar por 10 minutos (timer mostra ~20:00)
3. Clicar em **Pausar**
4. Aguardar 15 minutos com timer pausado
5. Clicar em **Retomar**

**Resultado Esperado**:
- Timer retoma com ~20 minutos restantes
- Tempo pausado NÃO foi descontado
- Label "pausado" aparece durante pausa

**Verificação**:
```javascript
// Enquanto pausado
const snap = JSON.parse(localStorage.getItem('taskflow.dailyFocus.live'))
console.log(snap.running) // false
console.log(snap.remainingSecs) // ~1200 (congelado)

// Ao retomar
console.log(snap.running) // true
console.log(snap.anchorTs) // Date.now() NOVO (não o antigo)
```

---

### 5. Finalização com Navegador Fechado 🏁

**Passos**:
1. Iniciar sessão de 5 minutos
2. Trabalhar por 2 minutos (timer mostra ~3:00)
3. **Fechar navegador**
4. Aguardar 5 minutos (cronometrar externamente)
5. Reabrir navegador e acessar TaskFlow

**Resultado Esperado**:
- Sessão já está concluída automaticamente
- Console log: `[DailyFocus] Timer completed while away, auto-completing task`
- Tela de celebração ou próxima tarefa aparece
- Timer mostra 00:00

---

### 6. Múltiplas Abas Abertas 🪟

**Passos**:
1. Abrir TaskFlow em **2 abas** do navegador
2. Iniciar sessão na **aba 1**
3. Aguardar 1 minuto
4. Verificar **aba 2**

**Resultado Esperado**:
- Ambas as abas mostram o mesmo tempo restante (sincronizadas)
- FloatingModeCard aparece em ambas

**Nota**: Pode haver atraso de até 2.5s (debounce da sincronização)

---

### 7. Pausar e Retomar Repetidamente 🔁

**Passos**:
1. Iniciar sessão de 10 minutos
2. Trabalhar por 2 minutos → **Pausar** → aguardar 1 min → **Retomar**
3. Trabalhar por 3 minutos → **Pausar** → aguardar 2 min → **Retomar**
4. Trabalhar até acabar o timer

**Resultado Esperado**:
- Tempo total de pausa (3 minutos) NÃO é descontado
- Timer conta apenas os ~5 minutos efetivos de trabalho
- Cada retomada cria novo `anchorTs`

---

### 8. Reconexão após Perda de Internet 📡

**Passos**:
1. Iniciar sessão de 15 minutos
2. Trabalhar por 5 minutos
3. **Desconectar internet** (Wi-Fi off ou cabo)
4. Aguardar 8 minutos
5. **Reconectar internet**

**Resultado Esperado**:
- Timer continua funcionando offline (localStorage)
- Ao reconectar, sincroniza com backend
- Timer mostra ~2 minutos restantes

**Console logs esperados**:
```
"[DailyFocus] Network reconnected, syncing..."
"[DailyFocus] Active session synced"
```

---

### 9. Reinicialização do Backend 🔧

**Passos**:
1. Iniciar sessão de 20 minutos no frontend
2. Trabalhar por 5 minutos
3. **Reiniciar servidor backend** (docker restart ou npm restart)
4. Continuar trabalhando no frontend

**Resultado Esperado**:
- Timer continua funcionando normalmente (estado em localStorage)
- Sincronização falha temporariamente (erro 502/503)
- Ao backend voltar, próxima sincronização funciona
- Nenhuma perda de estado no frontend

---

### 10. Deploy Durante Sessão Ativa 🚀

**Passos**:
1. Iniciar sessão de 30 minutos
2. Trabalhar por 10 minutos
3. **Fazer deploy da aplicação** (frontend recarrega automaticamente)
4. Aguardar reload automático

**Resultado Esperado**:
- Página recarrega
- Sessão é recuperada do localStorage/backend
- Timer mostra ~20 minutos restantes (tempo transcorrido durante reload é considerado)

---

## Verificação Automática (Testes Unitários)

Execute os testes automatizados:

```bash
cd frontend
npm test -- DailyTimer.test.tsx
```

**Testes incluídos**:
- ✅ Cálculo via snapshot (não decremento)
- ✅ Compensação de tempo transcorrido
- ✅ Congelamento ao pausar
- ✅ onComplete chamado ao terminar
- ✅ Detecção automática de conclusão
- ✅ onTick com tempo correto via timestamps

---

## Debugging

### Verificar Snapshot no Console

```javascript
// Ver snapshot atual
const snap = JSON.parse(localStorage.getItem('taskflow.dailyFocus.live'))
console.log('Snapshot:', snap)

// Calcular tempo restante manualmente
import { liveRemaining } from './lib/dailyFocusLive'
const remaining = liveRemaining(snap)
console.log('Remaining:', remaining, 'seconds')

// Ver sessão persistida
const session = JSON.parse(localStorage.getItem('taskflow_sess_daily_focus'))
console.log('Session:', session)
```

### Forçar Sincronização

```javascript
// No console do navegador
import { flushActiveSessionPush } from './lib/dailyFocusLive'
flushActiveSessionPush()
```

### Simular Retorno após Tempo

```javascript
// Modificar anchorTs manualmente para simular tempo passado
const snap = JSON.parse(localStorage.getItem('taskflow.dailyFocus.live'))
snap.anchorTs = Date.now() - 300000 // 5 minutos atrás
localStorage.setItem('taskflow.dailyFocus.live', JSON.stringify(snap))
// Recarregar página
location.reload()
```

---

## Checklist de Validação

Após executar todos os cenários:

- [ ] Timer não depende de setInterval para contabilizar tempo
- [ ] Tempo é calculado via liveRemaining() com timestamps
- [ ] Pausas congelam remainingSecs corretamente
- [ ] Recarregar página recupera tempo correto
- [ ] Fechar/reabrir navegador mantém sessão ativa
- [ ] Múltiplas abas mostram tempo sincronizado
- [ ] Finalização automática ocorre ao retornar após timeout
- [ ] Modo Rush e Modo Tab continuam funcionando
- [ ] Todos os 10 cenários passam
- [ ] Código existente continua sem regressões

---

## Problemas Conhecidos / Limitações

### Notificações Push
- ❌ **Não implementado**: notificar quando tempo acabar com app fechado
- **Solução futura**: Service Worker + Web Push API

### Precisão de Timestamps
- `Date.now()` depende do relógio do dispositivo
- Mudanças manuais de fuso horário podem afetar cálculo
- **Mitigação**: erro é detectado ao sincronizar com backend

### Navegadores Antigos
- Navegadores sem suporte a `visibilitychange` não detectam retorno à aba
- **Impacto**: verificação de conclusão só ocorre ao recarregar página

---

## Contato

Dúvidas ou bugs encontrados:
- Verificar logs no console (filtro: `[DailyFocus]`)
- Inspecionar localStorage (chaves: `taskflow.dailyFocus.*`)
- Verificar sincronização backend (endpoint: `/daily-focus/active-session`)
