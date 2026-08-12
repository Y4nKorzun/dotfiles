if [[ -o interactive && -t 0 && -t 1 ]]; then
  typeset -ga ZSH_AUTOSUGGEST_STRATEGY
  ZSH_AUTOSUGGEST_STRATEGY=(completion history)
  if [[ -f /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh ]]; then
    source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh
  elif [[ -f /usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh ]]; then
    source /usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
  fi
fi
