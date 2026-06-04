alias sourcezsh='source ~/.zshrc'
alias ccat='\cat'               # original cat command
alias ...='cd ../..'

if command -v bat >/dev/null 2>&1; then
  alias cat='bat --style=plain --paging=never'
fi

# Tools
alias v='nvim'
alias ff='fastfetch'
alias lg='lazygit'
alias y='yazi'
alias oc='opencode'
alias wf='wifitui'
alias gi='git-ignore'
alias ts='tms'
alias tss='tms switch'

# Listing
alias ls='eza --icons=auto --group-directories-first'
alias l='eza --icons=auto --group-directories-first'
alias ll='eza -lah --icons=auto --group-directories-first --git'
alias lh='eza -lh --icons=auto --group-directories-first --git'

alias grep='grep --color=auto'
alias ip='ip --color=auto'

# Chezmoi
alias chd='chezmoi cd'
alias chra='chezmoi re-add'
alias cha='chezmoi add'
alias chap='chezmoi apply'

# Tmux
alias ta='tmux attach'
alias t='tmux'
alias tk='tmux kill-server'
alias tl='tmux ls'
