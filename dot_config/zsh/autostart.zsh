[[ -o interactive && -t 0 && -t 1 ]] || return 0

if command -v fastfetch >/dev/null 2>&1; then
  fastfetch
fi

if [[ -z "$TMUX" && -z "$ZSH_NO_TMUX" ]] && command -v tmux >/dev/null 2>&1; then
  tmux
fi
