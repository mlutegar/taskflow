# 32 - Redesign da Tela de Perfil

Volta ao [[0-Painel]].

## Contexto
A tela de **Perfil** (`frontend/src/components/auth/ProfilePage.tsx`) usava emojis como ícones
(👤 no título, 🔄/⏳ no botão de atualizar, 🚪 no botão de sair) e um layout simples de cards
empilhados. Objetivo: visual mais polido e substituir emojis por ícones reais.

## O que mudou
- **Emojis → ícones [lucide-react](https://lucide.dev)** (lib já usada no projeto — ver `Sidebar.tsx`,
  `layout/navItems.tsx`). Nenhuma dependência nova.
  - `User` → header
  - `Mail` → card **CONTA**
  - `Package` → card **VERSÃO INSTALADA**
  - `RefreshCw` → botão **Buscar atualizações** (gira via `@keyframes profile-spin` quando `checking`)
  - `LogOut` → botão **Sair da conta** (cor `--danger`)
- **Header** com avatar circular (fundo `--accent` translúcido via `color-mix`) + email como subtítulo.
- **Cards de info** em linha: ícone num chip arredondado (`--surface-2`) + label pequeno e valor.
- **Botões de ação** viraram cards com borda, hover que realça a borda (`--accent` / `--danger`).

## Detalhes técnicos
- Mantido o padrão do projeto: **inline styles** + **CSS variables** do tema dark
  (`--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--accent`, `--danger`,
  `--radius`, `--radius-sm`).
- A animação de spin é injetada por uma tag `<style>` local no componente
  (`@keyframes profile-spin`), pois não havia keyframe de spin no `index.css`.
- Lógica inalterada: `handleCheckUpdates` (limpa cache + service workers e recarrega) e
  `handleSignOut` seguem usando `useConfirm`.

## Arquivo
- `frontend/src/components/auth/ProfilePage.tsx`

## Melhorias v2 (pacote completo)
Segundo passo, indo além do redesign visual:

- **Migração para CSS module** `ProfilePage.module.css` (segue o padrão de
  `Sidebar.module.css`): saíram os inline styles e os handlers de hover no JS.
  Ganhos: `:hover`, `:focus-visible` (acessibilidade de teclado) e `min-height`
  de 44/52px para toque no mobile.
- **Avatar com inicial** do nome/email + gradiente `--accent → --accent-hover`.
- **Nome de exibição editável** inline (lápis → input; Enter salva, Esc cancela),
  persistido em `localStorage` (`taskflow.displayName`).
- **Copiar email** (`navigator.clipboard`) com feedback (ícone vira ✓ + toast).
- **Tema claro/escuro**: novo `lib/theme.ts` (get/set/toggle/init, persistido em
  `taskflow.theme`, aplicado via `data-theme="light"` no `<html>`). Paleta clara
  adicionada em `index.css` reusando os mesmos nomes de variável. `initTheme()`
  roda no `main.tsx` antes do render (evita flash). Toggle segmentado na seção
  **Aparência**.
- **Verificação de atualização honesta**: usa o Service Worker
  (`registration.update()` + checa `waiting`/`installing`). Sem update →
  toast "Você já está na última versão ✓"; com update → confirma, limpa cache e
  recarrega. Substitui o antigo `reload(true)` (arg obsoleto que dava erro TS).
- **Versão exibida** agora inclui `APP_VERSION` além do build date.
- **Toasts** reusando o `useToast` global (`shared/Toast`).
- **Acessibilidade**: `aria-label` nos botões, `aria-hidden` nos ícones,
  `aria-pressed` no toggle, `role="group"`, foco visível.
- **Seções agrupadas**: Conta · Aparência · Sobre o app · Sessão.

### Arquivos v2
- `frontend/src/components/auth/ProfilePage.tsx` (reescrito)
- `frontend/src/components/auth/ProfilePage.module.css` (novo)
- `frontend/src/lib/theme.ts` (novo)
- `frontend/src/index.css` (paleta do tema claro)
- `frontend/src/main.tsx` (`initTheme()` no bootstrap)

## Relacionadas
- [[27-Redesign-Bottom-Nav-Mobile]] — outro trabalho de redesign de UI
- [[15-Redesign-Card-Nova-Tarefa]], [[16-Redesign-Form-Adicionar-Projeto]]
- [[33-PWA-Update-e-Deploy]] — banner global de nova versão (`UpdatePrompt`)
