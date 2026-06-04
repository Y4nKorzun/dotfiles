if [[ -o interactive && -t 0 && -t 1 ]]; then
  typeset -ga ZSH_AUTOSUGGEST_STRATEGY
  ZSH_AUTOSUGGEST_STRATEGY=(completion history)
  zsh_add_file /usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
fi
