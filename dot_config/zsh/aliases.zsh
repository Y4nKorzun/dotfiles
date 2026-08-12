alias sourcezsh='source ~/.zshrc'
alias ...='cd ../..'

if command -v cat >/dev/null 2>&1; then
  alias ccat='\cat'               # original cat command
fi

if command -v bat >/dev/null 2>&1; then
  alias cat='bat --style=plain --paging=never'
fi

# Tools
command -v nvim >/dev/null 2>&1 && alias v='nvim'
command -v fastfetch >/dev/null 2>&1 && alias ff='fastfetch'
command -v lazygit >/dev/null 2>&1 && alias lg='lazygit'
command -v opencode >/dev/null 2>&1 && alias oc='opencode'
command -v wifitui >/dev/null 2>&1 && alias wf='wifitui'
command -v git-ignore >/dev/null 2>&1 && alias gi='git-ignore'
if command -v tms >/dev/null 2>&1; then
  alias ts='tms'
  alias tss='tms switch'
fi

# Listing
if command -v eza >/dev/null 2>&1; then
  alias ls='eza --icons=auto --group-directories-first'
  alias l='eza --icons=auto --group-directories-first'
  alias ll='eza -lah --icons=auto --group-directories-first --git'
  alias lh='eza -lh --icons=auto --group-directories-first --git'
fi

command -v grep >/dev/null 2>&1 && alias grep='grep --color=auto'
command -v ip >/dev/null 2>&1 && alias ip='ip --color=auto'

# Chezmoi
if command -v chezmoi >/dev/null 2>&1; then
  alias chd='chezmoi cd'
  alias chra='chezmoi re-add'
  alias cha='chezmoi add'
  alias chap='chezmoi apply'
fi

# Tmux
if command -v tmux >/dev/null 2>&1; then
  alias ta='tmux attach'
  alias t='tmux'
  alias tk='tmux kill-server'
  alias tl='tmux ls'
fi
