#!/bin/bash
set -u
runner=$(id -un)
case "$runner" in
  ghr-smashcraft-[0-9]*) ;;
  *) echo "work prune: $runner is not a smashcraft runner, skipping"; exit 0 ;;
esac
work="/srv/ghr/$runner/work"
[ -d "$work" ] || exit 0
before=$(du -sk "$work" | cut -f1)
[ -d "$work/_temp" ] && find "$work/_temp" -mindepth 1 -delete
for repo in "$work"/smashcraft/smashcraft; do
  [ -d "$repo/.git" ] && git -C "$repo" clean -q -ffdx
done
for action in "$work"/_actions/*/*; do
  [ -d "$action" ] || continue
  ls -1t --group-directories-first "$action" | while read -r version; do
    [ -d "$action/$version" ] && echo "$version"
  done | tail -n +2 | while read -r old; do
    rm -rf -- "${action:?}/${old:?}" "${action:?}/${old:?}.completed"
  done
done
after=$(du -sk "$work" | cut -f1)
echo "work prune: $work ${before} KB -> ${after} KB"
exit 0
