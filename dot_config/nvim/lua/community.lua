-- AstroCommunity: import any community modules here
-- We import this file in `lazy_setup.lua` before the `plugins/` folder.
-- This guarantees that the specs are processed before any user plugins.

local project_markers = { "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", ".git" }

local function project_root(path) return vim.fs.root(path, project_markers) end

---@type LazySpec
return {
  "AstroNvim/astrocommunity",
  { import = "astrocommunity.pack.typescript" },
  { import = "astrocommunity.pack.eslint" },
  { import = "astrocommunity.pack.tailwindcss" },
  { import = "astrocommunity.pack.cs" },
  {
    "AstroNvim/astrolsp",
    opts = function(_, opts)
      opts.features.inlay_hints = true
      opts.features.signature_help = true

      local eslint_nested = vim.deepcopy(vim.lsp.config.eslint)
      eslint_nested.root_dir = function(bufnr, on_dir)
        local root = project_root(vim.api.nvim_buf_get_name(bufnr))
        if root and vim.uv.fs_stat(vim.fs.joinpath(root, "config", "eslint.config.js")) then on_dir(root) end
      end
      eslint_nested.settings = vim.tbl_deep_extend(
        "force",
        eslint_nested.settings or {},
        { options = { overrideConfigFile = "config/eslint.config.js" } }
      )

      opts.servers = require("astrocore").list_insert_unique(opts.servers, { "eslint_nested" })
      opts.config.eslint_nested = eslint_nested
      opts.config.csharp_ls = vim.tbl_deep_extend("force", opts.config.csharp_ls or {}, {
        cmd = function(dispatchers, config)
          return vim.lsp.rpc.start({ "csharp-ls", "--loglevel", "warning" }, dispatchers, {
            cwd = config.cmd_cwd or config.root_dir,
            env = config.cmd_env,
            detached = config.detached,
          })
        end,
        settings = { csharp = { logLevel = "warning" } },
      })
    end,
  },
  {
    "jay-babu/mason-null-ls.nvim",
    opts = function(_, opts)
      opts.ensure_installed = require("astrocore").list_insert_unique(opts.ensure_installed, { "prettier" })
      opts.handlers.prettierd = function() end
      opts.handlers.prettier = function()
        local null_ls = require "null-ls"
        null_ls.register(null_ls.builtins.formatting.prettier.with {
          extra_args = function(params)
            local root = project_root(params.bufname)
            local nested = root and vim.fs.joinpath(root, "config", "prettier.config.json")
            return nested and vim.uv.fs_stat(nested) and { "--config", nested } or {}
          end,
        })
      end
    end,
  },
  {
    "WhoIsSethDaniel/mason-tool-installer.nvim",
    opts = function(_, opts)
      opts.ensure_installed = require("astrocore").list_insert_unique(opts.ensure_installed, { "prettier" })
    end,
  },
  {
    "jay-babu/mason-nvim-dap.nvim",
    opts = function(_, opts)
      opts.handlers.js = function()
        local dap = require "dap"
        dap.adapters["pwa-node"] = {
          type = "server",
          host = "localhost",
          port = "${port}",
          executable = { command = "js-debug-adapter", args = { "${port}" } },
        }

        local configurations = {
          {
            name = "Node: Launch current file",
            type = "pwa-node",
            request = "launch",
            program = "${file}",
            cwd = "${workspaceFolder}",
            sourceMaps = true,
            console = "integratedTerminal",
          },
          {
            name = "Node: Attach to process",
            type = "pwa-node",
            request = "attach",
            processId = require("dap.utils").pick_process,
            cwd = "${workspaceFolder}",
            sourceMaps = true,
          },
        }

        for _, filetype in ipairs { "javascript", "javascriptreact", "typescript", "typescriptreact" } do
          dap.configurations[filetype] = configurations
        end
      end
    end,
  },
}
