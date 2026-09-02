-- This will run last in the setup process.
-- This is just pure lua so anything that doesn't
-- fit in the normal config locations above can go here

if not vim.env.DOTNET_ROOT then
  local dotnet = vim.uv.fs_realpath(vim.fn.exepath "dotnet")
  local bin = dotnet and vim.fs.dirname(dotnet)
  for _, root in ipairs { bin, bin and vim.fs.joinpath(vim.fs.dirname(bin), "libexec") } do
    if root and vim.uv.fs_stat(vim.fs.joinpath(root, "host", "fxr")) then
      vim.env.DOTNET_ROOT = root
      break
    end
  end
end
