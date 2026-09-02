local M = {}

local tools = {
  "git",
  "rg",
  "fd",
  "lazygit",
  "node",
  "dotnet",
  "vtsls",
  "vscode-eslint-language-server",
  "prettier",
  "tailwindcss-language-server",
  "emmet-ls",
  "vscode-html-language-server",
  "vscode-css-language-server",
  "vscode-json-language-server",
  "csharp-ls",
  "csharpier",
  "netcoredbg",
  "js-debug-adapter",
}

local parsers = { "javascript", "typescript", "tsx", "json", "html", "css", "scss", "c_sharp" }
local commands = { "AstroUpdate", "Mason", "Neotree", "ToggleTerm", "DapContinue", "Keyforge" }
local mappings = { "<F5>", "<F9>", "<Leader>du", "<Leader>ff" }

function M.run()
  vim.defer_fn(function()
    local failures = {}
    local function check(ok, message)
      if not ok then table.insert(failures, message) end
    end

    vim.cmd.doautocmd "UIEnter"

    local lazy = require "lazy.core.config"
    require("lazy").load { plugins = vim.tbl_keys(lazy.plugins), wait = true }
    for name, plugin in pairs(lazy.plugins) do
      check(not plugin._.installed or plugin._.loaded ~= nil, "plugin did not load: " .. name)
    end

    check(vim.g.colors_name == "claude", "colorscheme is not claude")
    for _, command in ipairs(commands) do
      check(vim.fn.exists(":" .. command) == 2, "missing command: " .. command)
    end
    for _, mapping in ipairs(mappings) do
      check(next(vim.fn.maparg(mapping, "n", false, true)) ~= nil, "missing mapping: " .. mapping)
    end
    for _, tool in ipairs(tools) do
      check(vim.fn.executable(tool) == 1, "missing executable: " .. tool)
    end
    for _, parser in ipairs(parsers) do
      check(#vim.api.nvim_get_runtime_file("parser/" .. parser .. ".*", false) > 0, "missing parser: " .. parser)
    end

    local snacks = require "snacks"
    check(vim.ui.input == snacks.input.input, "Snacks.input is not active")
    check(vim.ui.select == snacks.picker.select, "Snacks.picker is not active")
    check(snacks.config.image.enabled == false, "optional Snacks.image is enabled")

    local root = vim.env.DOTNET_ROOT
    check(root and vim.uv.fs_stat(vim.fs.joinpath(root, "host", "fxr")), "DOTNET_ROOT is invalid")

    local sources = require "null-ls.sources"
    local formatting = require("null-ls.methods").internal.FORMATTING
    local function has_formatter(filetype, name)
      for _, source in ipairs(sources.get_available(filetype, formatting)) do
        if source.name == name then return true end
      end
      return false
    end
    check(has_formatter("typescriptreact", "prettier"), "Prettier is not registered")
    check(has_formatter("cs", "csharpier"), "CSharpier is not registered")

    local dap = require "dap"
    check(type(dap.adapters["pwa-node"]) == "table", "Node DAP adapter is not registered")
    check(#(dap.configurations.typescript or {}) >= 2, "Node DAP configurations are missing")
    check(type(dap.adapters.coreclr) == "table", "coreclr DAP adapter is not registered")
    check(#(dap.configurations.cs or {}) >= 1, "coreclr DAP configuration is missing")

    local expected_clients = {
      javascript = { "null-ls", "vtsls" },
      javascriptreact = { "emmet_ls", "null-ls", "tailwindcss", "vtsls" },
      typescript = { "null-ls", "vtsls" },
      typescriptreact = { "emmet_ls", "null-ls", "tailwindcss", "vtsls" },
      cs = { "csharp_ls", "null-ls" },
    }
    if expected_clients[vim.bo.filetype] then
      local active = {}
      for _, client in ipairs(vim.lsp.get_clients { bufnr = 0 }) do
        active[client.name] = true
      end
      for _, client in ipairs(expected_clients[vim.bo.filetype]) do
        check(active[client], "missing LSP client: " .. client)
      end
      if vim.bo.filetype ~= "cs" then
        check(active.eslint or active.eslint_nested, "missing LSP client: eslint")
      end
      check(next(vim.fn.maparg("<Leader>lf", "n", false, true)) ~= nil, "missing LSP format mapping")
      check(pcall(vim.treesitter.start, 0), "Treesitter failed for " .. vim.bo.filetype)
    end

    if #failures == 0 then
      print "IDE health: OK"
      vim.cmd "qa!"
    else
      for _, failure in ipairs(failures) do
        print("IDE health: FAIL: " .. failure)
      end
      vim.cmd "cquit 1"
    end
  end, vim.bo.filetype == "" and 1000 or 6000)
end

return M
