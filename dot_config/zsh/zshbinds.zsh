[[ -o interactive ]] || return 0

function sudo-last-command() {
  if [[ -z $BUFFER ]]; then
    BUFFER="sudo $(fc -ln -1)"
  elif [[ $BUFFER == sudo\ * ]]; then
    BUFFER=${BUFFER#sudo }
  else
    BUFFER="sudo $BUFFER"
  fi
  CURSOR=${#BUFFER}
}

function tms-widget() {
  if [[ -n "$TMUX" ]]; then
    tmux display-popup -E -w 70% -h 55% "tms"
  else
    tms
  fi
}

function tmux-pane-picker-widget() {
  [[ -n "$TMUX" ]] || return 0

  local window_id
  window_id=$(tmux display-message -p '#{window_id}' 2>/dev/null) || return 0
  [[ -n "$window_id" ]] || return 0

  TMUX_PICKER_WINDOW="$window_id" "$ZSHDIR/tmux-pane-picker" >/dev/null 2>&1
}

zle -N sudo-last-command
zle -N tms-widget
zle -N tmux-pane-picker-widget

autoload -Uz bracketed-paste-magic
zle -N bracketed-paste bracketed-paste-magic

bindkey "^[[1;5C" forward-word      # Ctrl+Right
bindkey "^[[1;2C" forward-word      # Ctrl+Right
bindkey "^[[1;5D" backward-word     # Ctrl+Left
bindkey "^[[1;2D" backward-word     # Ctrl+Left

bindkey -M emacs '^[[A' history-beginning-search-backward
bindkey -M emacs '^[[B' history-beginning-search-forward

if (( $+widgets[autosuggest-accept] )); then
  bindkey "^y" autosuggest-accept
  bindkey "^e" autosuggest-accept   # Ctrl+E
fi

bindkey "^f" tms-widget
bindkey '^x^p' tmux-pane-picker-widget

# Esc Esc: add/toggle sudo for current line (or last cmd)
bindkey '\e\e' sudo-last-command
