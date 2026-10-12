superseded() {
  local main="$1" lanes="$2" runs="$3" tree held branch tip state failed pushed issues why merged issue index match other
  local -a branches=() tips=() states=() failures=() dates=() issue_lists=()
  local -A replacements=()
  tree=$(git rev-parse "$main^{tree}") || return
  held=$(jq -r '[.[] | select(.status != "completed")] | if any(.[]; .title == "Autoland train") then "*" else [.[] | (.head_branch, (.title | split(" ")[])) | select(startswith("claude/"))] | unique[] end' "$runs") || return
  [ "$held" != '*' ] || return 0
  refs() { git log --format=%B "$(git merge-base "$main" "$1")..$1" | grep -oiE '\b(refs|fixes|closes)[: ]+((tompassarelli/)?smashcraft)?#[0-9]+' | grep -oE '[0-9]+$' | sort -un; }
  while IFS=$'\t' read -r -u 3 branch tip state failed pushed; do
    git cat-file -e "$tip" 2> /dev/null || continue
    issues=$(refs "$tip") || true
    index=${#branches[@]}
    branches+=("$branch"); tips+=("$tip"); states+=("$state"); failures+=("$failed"); dates+=("$pushed"); issue_lists+=("$issues")
    if [ "$state" != FAILURE ]; then
      for issue in $issues; do replacements[$issue]="${replacements[$issue]:-} $index"; done
    fi
  done 3< "$lanes"
  for index in "${!branches[@]}"; do
    branch=${branches[$index]}; tip=${tips[$index]}; state=${states[$index]}; failed=${failures[$index]}; issues=${issue_lists[$index]}
    [[ $'\n'$held$'\n' != *$'\n'"$branch"$'\n'* ]] || continue
    why=""
    if merged=$(git merge-tree --write-tree "$main" "$tip") && [ "$merged" = "$tree" ]; then
      why="merging it leaves main's tree unchanged"
    elif [ "$state" = FAILURE ] && [ -n "$issues" ]; then
      match=${#branches[@]}
      for issue in $issues; do
        for other in ${replacements[$issue]:-}; do
          [[ "${dates[$other]}" > "$failed" ]] && [ "$other" -lt "$match" ] && match=$other
        done
      done
      if [ "$match" -lt "${#branches[@]}" ]; then
        other=${branches[$match]}
        why="\`$other\`, pushed after it failed, refs the same issue"
      fi
    fi
    [ -n "$why" ] || continue
    printf '%s\t%s\t%s\t%s\n' "$branch" "$tip" "$why" "${issues//$'\n'/ }"
  done
}
