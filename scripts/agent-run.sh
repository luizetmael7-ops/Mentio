#!/usr/bin/env bash
# Lanceur générique d'agent en mode headless.
#
#   ./scripts/agent-run.sh editeur
#
# Chaque agent lit CLAUDE.md puis son propre brief, et écrit son compte-rendu dans
# ops/logs/. Le wrapper est volontairement mince : toute la logique vit dans le
# brief et le skill, pour qu'un agent puisse être corrigé sans toucher au code.
set -euo pipefail

AGENT="${1:-}"
[ -z "$AGENT" ] && { echo "Usage : $0 <nom-agent>"; exit 1; }

BRIEF=".claude/agents/${AGENT}.md"
[ -f "$BRIEF" ] || { echo "Brief introuvable : $BRIEF"; exit 1; }

DATE="$(date +%Y-%m-%d)"
LOG="ops/logs/${DATE}-${AGENT}.md"
mkdir -p ops/logs

echo "▶ Agent ${AGENT} — ${DATE}"

# --max-turns borne le nombre d'aller-retours : un agent qui boucle coûte cher et
# ne produit rien d'utile. --allowedTools interdit tout ce qui n'est pas nécessaire.
#
# 40 → 100. L'Éditeur du Baromètre a échoué trois semaines de suite sur « Reached max
# turns », et le Baromètre n'a plus paru depuis le 13 août. Ce n'était pas une boucle :
# produire une édition demande de déclencher la mesure, d'attendre, de vérifier quatre
# invariants, de rédiger un commentaire en quatre paragraphes, de mettre à jour trois
# fichiers, d'écrire son log et d'ouvrir une PR. 40 tours ne suffisaient pas.
claude -p "$(cat "$BRIEF")" \
  --allowedTools "Read,Write,Edit,Grep,Glob,Bash(git*),Bash(npm*),Bash(npx*),Bash(curl*)" \
  --max-turns 100 \
  2>&1 | tee -a "$LOG"

echo "✓ Compte-rendu : ${LOG}"
