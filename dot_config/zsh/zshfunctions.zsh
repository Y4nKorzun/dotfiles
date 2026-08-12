function pf() {
  command -v fzf >/dev/null 2>&1 || { print -u2 'pf: fzf is required'; return 1; }

  local package selection
  if command -v brew >/dev/null 2>&1; then
    selection=$(brew formulae | fzf --multi --preview-window 'right:55%,wrap' --preview 'brew info --formula {}') || return $?
    while IFS= read -r package; do
      [[ -n "$package" ]] || continue
      brew install --formula "$package" || return $?
    done <<< "$selection"
  elif command -v pacman >/dev/null 2>&1; then
    selection=$(pacman -Slq | fzf --multi --preview-window '55%,wrap' --preview 'cat <(pacman -Si {1}) <(pacman -Fl {1} | awk "{print \$2}")') || return $?
    while IFS= read -r package; do
      [[ -n "$package" ]] || continue
      sudo pacman -S "$package" || return $?
    done <<< "$selection"
  else
    print -u2 'pf: brew or pacman is required'
    return 1
  fi
}

function ppf() {
  command -v fzf >/dev/null 2>&1 || { print -u2 'ppf: fzf is required'; return 1; }
  command -v yay >/dev/null 2>&1 || { print -u2 'ppf: yay is required'; return 1; }

  local package selection
  selection=$(yay -Slq | fzf --multi --preview-window '55%,wrap' --preview 'cat <(yay -Si {1}) <(yay -Fl {1} | awk "{print \$2}")') || return $?
  while IFS= read -r package; do
    [[ -n "$package" ]] || continue
    yay -S "$package" || return $?
  done <<< "$selection"
}

function y() {
  local tmp cwd yazi_status=1
  tmp=$(mktemp "${TMPDIR:-/tmp}/yazi-cwd.XXXXXX") || return 1
  {
    yazi "$@" --cwd-file="$tmp"
    yazi_status=$?
    if [[ -r "$tmp" ]]; then
      cwd=$(<"$tmp")
      [[ -n "$cwd" && -d "$cwd" ]] && builtin cd -- "$cwd"
    fi
  } always {
    command rm -f -- "$tmp"
  }
  return "$yazi_status"
}

function pd() {
  command -v fzf >/dev/null 2>&1 || { print -u2 'pd: fzf is required'; return 1; }

  local package selection
  if command -v brew >/dev/null 2>&1; then
    selection=$(brew leaves --installed-on-request | fzf --height=40% --layout=reverse --border --multi --preview-window 'right:55%,wrap' --preview 'brew info --formula {}') || return $?
    while IFS= read -r package; do
      [[ -n "$package" ]] || continue
      brew uninstall --formula "$package" || return $?
    done <<< "$selection"
  elif command -v pacman >/dev/null 2>&1; then
    selection=$(pacman -Qq | fzf --height=40% --layout=reverse --border --multi --preview-window '55%,wrap' --preview 'pacman -Qi {1}') || return $?
    while IFS= read -r package; do
      [[ -n "$package" ]] || continue
      sudo pacman -Rns "$package" || return $?
    done <<< "$selection"
  else
    print -u2 'pd: brew or pacman is required'
    return 1
  fi
}

function pc() {
  command -v fzf >/dev/null 2>&1 || { print -u2 'pc: fzf is required'; return 1; }
  command -v brew >/dev/null 2>&1 || { print -u2 'pc: brew is required'; return 1; }

  local cask selection
  selection=$(brew casks | fzf --height=40% --layout=reverse --border --multi --preview-window 'right:55%,wrap' --preview 'brew info --cask {}') || return $?
  while IFS= read -r cask; do
    [[ -n "$cask" ]] || continue
    brew install --cask "$cask" || return $?
  done <<< "$selection"
}
