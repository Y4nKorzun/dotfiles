return {
  {
    "patrickkoss/keyforge.nvim",
    cmd = { "Keyforge", "KeyforgeStop", "KeyforgeBuild" },
    build = "make build",
    opts = {},
    keys = {
      { "<Leader>K", "<Cmd>Keyforge<CR>", desc = "Keyforge" },
    },
  },
}
