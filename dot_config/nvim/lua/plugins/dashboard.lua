local weather = "Minsk: loading weather…"
local weather_requested = false

local function weather_section()
  if not weather_requested then
    weather_requested = true
    if vim.fn.executable "curl" ~= 1 then
      weather = "Weather unavailable"
    else
      vim.system({
        "curl",
        "-fsS",
        "--connect-timeout",
        "1",
        "--max-time",
        "3",
        "https://wttr.in/Minsk?m&format=%l:+%c+%t,+feels+%f,+wind+%w",
      }, { text = true }, function(result)
        weather = result.code == 0 and vim.trim(result.stdout or "") or "Weather unavailable"
        vim.schedule(function()
          if vim.bo.filetype == "snacks_dashboard" then require("snacks").dashboard.update() end
        end)
      end)
    end
  end

  return { text = "  " .. weather, align = "center", padding = 1 }
end

return {
  "folke/snacks.nvim",
  opts = function(_, opts)
    opts.image.enabled = false
    opts.dashboard.preset.header = table.concat({
      "███╗   ██╗██╗   ██╗██╗███╗   ███╗",
      "████╗  ██║██║   ██║██║████╗ ████║",
      "██╔██╗ ██║██║   ██║██║██╔████╔██║",
      "██║╚██╗██║╚██╗ ██╔╝██║██║╚██╔╝██║",
      "██║ ╚████║ ╚████╔╝ ██║██║ ╚═╝ ██║",
      "╚═╝  ╚═══╝  ╚═══╝  ╚═╝╚═╝     ╚═╝",
    }, "\n")

    table.insert(opts.dashboard.preset.keys, {
      icon = "󰊴 ",
      key = "k",
      desc = "Keyforge  ",
      action = ":Keyforge",
    })

    opts.dashboard.sections = {
      { section = "header", padding = 2 },
      weather_section,
      { section = "keys", gap = 1, padding = 1 },
      {
        icon = " ",
        title = "Recent Files",
        section = "recent_files",
        limit = 5,
        indent = 2,
        padding = 1,
      },
      {
        icon = " ",
        title = "Projects",
        section = "projects",
        limit = 6,
        dirs = {
          vim.fn.expand "~/Projects/twikki/Twikki-Web",
          vim.fn.expand "~/Projects/twikki/Twikki-API",
          vim.fn.expand "~/Projects/Lambo/Web",
          vim.fn.expand "~/Projects/LifeOS/EddieOS",
          vim.fn.expand "~/Projects/meet-local-transcriber",
          vim.fn.expand "~/Projects/Larnax",
        },
        indent = 2,
        padding = 1,
      },
      { section = "startup" },
    }
  end,
}
