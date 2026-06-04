function zsh_add_file() {
  [[ -r "$1" ]] || return 0
  source "$1"
}

function zsh_append_path() {
  [[ -d "$1" ]] && path+=("$1")
}

function zsh_prepend_path() {
  [[ -d "$1" ]] && path=("$1" $path)
}

function pf() {
  pacman -Slq | fzf --multi --preview-window '55%,wrap' --preview 'cat <(pacman -Si {1}) <(pacman -Fl {1} | awk "{print \$2}")' | xargs -ro sudo pacman -S
}

function ppf() {
  yay -Slq | fzf --multi --preview-window '55%,wrap' --preview 'cat <(yay -Si {1}) <(yay -Fl {1} | awk "{print \$2}")' | xargs -ro yay -S
}

function pd() {
  pacman -Qq | fzf --multi --preview-window '55%,wrap' --preview 'pacman -Qi {1}' | xargs -ro sudo pacman -Rns
}

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

if [[ -o interactive ]]; then
  zle -N sudo-last-command
fi

function tms-widget() {
  if [[ -n "$TMUX" ]]; then
    tmux display-popup -E -w 70% -h 55% "tms"
  else
    tms
  fi
}

if [[ -o interactive ]]; then
  zle -N tms-widget
fi
