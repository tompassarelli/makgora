#!/usr/bin/env bash
set -euo pipefail
ssh_config="${VM_RETENTION_SSH_CONFIG:-$HOME/.local/state/smashcraft/vast-launch-check/ssh_config}"
host="${VM_RETENTION_HOST:-vast}"
archive="$HOME/.local/state/smashcraft/vm-archive"
state="$HOME/.local/state/smashcraft/vm-retention"
incidents="$HOME/.local/state/agents/watchdog/incidents.md"
warn_gb="${VM_RETENTION_WARN_GB:-10}"
warned="$state/low-disk-warned"
ssh_cmd=(ssh -F "$ssh_config" -o BatchMode=yes)
mkdir -p "$archive" "$state"

free_bytes=$("${ssh_cmd[@]}" "$host" "df -PB1 / | awk 'NR==2 {print \$4}'")
free_gb=$((free_bytes / 1000000000))
echo "vm free: ${free_gb} GB (${free_bytes} bytes), warn below ${warn_gb} GB"
if [ "$free_bytes" -lt $((warn_gb * 1000000000)) ]; then
  if [ ! -e "$warned" ]; then
    line="- $(date -u +%Y-%m-%dT%H:%M:%SZ) smashcraft-vm-low-disk: farm VM ${host} has ${free_gb} GB free on /, below ${warn_gb} GB"
    mkdir -p "$(dirname "$incidents")"
    echo "$line" >> "$incidents"
    notify-send -u critical "Smashcraft farm VM low on disk" "${free_gb} GB free on ${host}, below ${warn_gb} GB" || true
    touch "$warned"
    echo "warned: $line"
  else
    echo "low disk already warned; waiting for recovery"
  fi
elif [ -e "$warned" ]; then
  rm -f -- "$warned"
  echo "vm free space recovered; low-disk warning re-armed"
fi

for set in out fidelity; do
  remote="/home/user/$set"
  local_dir="$archive/$set"
  if ! "${ssh_cmd[@]}" "$host" "test -d $remote"; then
    echo "$set: $remote absent on the VM"
    continue
  fi
  mkdir -p "$local_dir"
  rsync -a -e "ssh -F $ssh_config -o BatchMode=yes" "$host:$remote/" "$local_dir/"

  vm_count=0 vm_bytes=0 lap_count=0 lap_bytes=0
  while IFS=$'\t' read -r -d '' size rel; do
    vm_count=$((vm_count + 1)); vm_bytes=$((vm_bytes + size))
    if [ -f "$local_dir/$rel" ]; then
      lap_count=$((lap_count + 1)); lap_bytes=$((lap_bytes + $(stat -c %s -- "$local_dir/$rel")))
    fi
  done < <("${ssh_cmd[@]}" "$host" "find $remote -type f -printf '%s\t%P\0'")
  echo "$set: vm ${vm_count} files ${vm_bytes} bytes; laptop ${lap_count} files ${lap_bytes} bytes"
  if [ "$vm_count" != "$lap_count" ] || [ "$vm_bytes" != "$lap_bytes" ]; then
    echo "$set: counts or bytes differ; pruning nothing this cycle"
    continue
  fi

  verified="$state/$set.verified"
  : > "$verified"
  old_count=0 old_bytes=0
  while IFS=$'\t' read -r -d '' size rel; do
    if [ -f "$local_dir/$rel" ] && [ "$(stat -c %s -- "$local_dir/$rel")" = "$size" ]; then
      printf '%s/%s\0' "$remote" "$rel" >> "$verified"
      old_count=$((old_count + 1)); old_bytes=$((old_bytes + size))
    fi
  done < <("${ssh_cmd[@]}" "$host" "find $remote -mtime +2 -type f -printf '%s\t%P\0'")
  if [ "$old_count" -gt 0 ]; then
    "${ssh_cmd[@]}" "$host" "xargs -0 -r rm -f --" < "$verified"
  fi
  echo "$set: pruned ${old_count} verified files (${old_bytes} bytes) older than 48 h from the VM"
done
