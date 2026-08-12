if command -v fzf >/dev/null 2>&1 && command -v fd >/dev/null 2>&1; then
  export FZF_DEFAULT_COMMAND="fd --hidden --strip-cwd-prefix"
  export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
  export FZF_ALT_C_COMMAND="fd --type=d --hidden --strip-cwd-prefix"
fi

command -v zoxide >/dev/null 2>&1 && eval "$(zoxide init zsh)"

if [[ -o interactive && -t 0 && -t 1 ]] && command -v fzf >/dev/null 2>&1; then
  if fzf --zsh >/dev/null 2>&1; then
    source <(fzf --zsh)
  else
    [[ -r /usr/share/fzf/key-bindings.zsh ]] && source /usr/share/fzf/key-bindings.zsh
    [[ -r /usr/share/fzf/completion.zsh ]] && source /usr/share/fzf/completion.zsh
    [[ -r "$HOME/.fzf.zsh" ]] && source "$HOME/.fzf.zsh"
  fi
fi
