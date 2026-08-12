typeset -U path PATH
[[ -d "$HOME/.local/bin" ]] && path=("$HOME/.local/bin" $path)
[[ -d /opt/homebrew/opt/node@24/bin ]] && path=(/opt/homebrew/opt/node@24/bin $path)
[[ -d "$HOME/.lmstudio/bin" ]] && path+=("$HOME/.lmstudio/bin")

export EDITOR=nvim
export VISUAL=nvim
export LESS='-R'
export OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true

[[ -r "$HOME/.local/bin/env" ]] && source "$HOME/.local/bin/env"
[[ -r "$HOME/.cargo/env" ]] && source "$HOME/.cargo/env"
