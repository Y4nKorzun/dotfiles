local astrotheme = require "astrotheme"

package.loaded["astrotheme.palettes.claude"] =
  dofile(vim.fn.stdpath "config" .. "/lua/astrotheme/palettes/claude.lua")

astrotheme.config = require("astrotheme.lib.config").user_config(astrotheme.config)
astrotheme.config.palette = "claude"
astrotheme.config.background = { dark = "claude", light = "claude" }
astrotheme.config.palettes.claude = {}
astrotheme.config.highlights.claude = {
  modify_hl_groups = function(hl, colors)
    hl.DiffAdd.bg = colors.diff.added
    hl.DiffDelete.bg = colors.diff.removed
    hl.DiffChange.bg = colors.diff.changed
    hl.DiffText.bg = colors.ui.selection
  end,
}

astrotheme.load()
