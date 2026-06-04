bindkey "^[[1;5C" forward-word      # Ctrl+Right
bindkey "^[[1;2C" forward-word      # Ctrl+Right
bindkey "^[[1;5D" backward-word     # Ctrl+Left
bindkey "^[[1;2D" backward-word     # Ctrl+Left

if (( $+widgets[autosuggest-accept] )); then
  bindkey "^y" autosuggest-accept
  bindkey "^e" autosuggest-accept   # Ctrl+E
fi

bindkey "^f" tms-widget

# Esc Esc: add/toggle sudo for current line (or last cmd)
bindkey '\e\e' sudo-last-command
