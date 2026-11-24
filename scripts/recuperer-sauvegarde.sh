#!/usr/bin/env bash
# Récupère une sauvegarde chiffrée dans "$1" (fichier de sortie) selon $VERSION :
#   vide          → la plus récente (branche « sauvegardes », une seule version, réécrite à chaque sauvegarde)
#   AAAA-MM-JJ    → la copie de ce jour (artefact GitHub Actions, gardé 30 jours)
#   identifiant de commit → anciennes sauvegardes enregistrées dans main (avant le 25/11/2026)
set -euo pipefail
sortie="$1"
if [ -z "${VERSION:-}" ]; then
  git fetch -q origin sauvegardes 2>/dev/null || { echo "::error::Aucune sauvegarde : la branche « sauvegardes » n'existe pas encore (lancez « Sauvegarde de la base »)"; exit 1; }
  git show FETCH_HEAD:base.json.enc > "$sortie"
  echo "date=$(git log -1 --format=%ct FETCH_HEAD)" >> "$GITHUB_OUTPUT"
elif [[ "$VERSION" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  url=$(curl -fsSL -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/$GITHUB_REPOSITORY/actions/artifacts?per_page=100&name=sauvegarde-$VERSION" \
    | python3 -c "import json,sys; a=[x for x in json.load(sys.stdin)['artifacts'] if not x['expired']]; print(a[0]['archive_download_url'] if a else '')")
  if [ -z "$url" ]; then echo "::error::Aucune sauvegarde du $VERSION (les copies quotidiennes sont gardées 30 jours ; un jour sans changement de la base n'a pas de copie)"; exit 1; fi
  curl -fsSL -H "Authorization: Bearer $GH_TOKEN" -o "$RUNNER_TEMP/copie.zip" "$url"
  unzip -p "$RUNNER_TEMP/copie.zip" base.json.enc > "$sortie"; rm -f "$RUNNER_TEMP/copie.zip"
  echo "date=" >> "$GITHUB_OUTPUT"
else
  git show "$VERSION:sauvegarde/base.json.enc" > "$sortie"
  echo "date=" >> "$GITHUB_OUTPUT"
fi
