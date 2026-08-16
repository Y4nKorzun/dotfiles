local devlog_records = {
  ["buffer-write"] = '{"event":"buffer-write"}\n',
  ["lsp-attach"] = '{"event":"lsp-attach"}\n',
  ["filetype-typescript"] = '{"event":"filetype-typescript"}\n',
  ["filetype-javascript"] = '{"event":"filetype-javascript"}\n',
  ["filetype-react"] = '{"event":"filetype-react"}\n',
  ["filetype-angular"] = '{"event":"filetype-angular"}\n',
  ["filetype-go"] = '{"event":"filetype-go"}\n',
  ["filetype-rust"] = '{"event":"filetype-rust"}\n',
  ["filetype-css"] = '{"event":"filetype-css"}\n',
  ["filetype-scss"] = '{"event":"filetype-scss"}\n',
  ["filetype-lua"] = '{"event":"filetype-lua"}\n',
}

-- Fixed ceiling: stop at 5 MiB; do not rotate or retain replaced payloads.
local DEVLOG_MAX_BYTES = 5 * 1024 * 1024

local function devlog(event)
  local record = devlog_records[event]
  if not record then
    return
  end

  local directory = vim.fn.stdpath("state") .. "/devlog"
  local directory_stat = vim.uv.fs_lstat(directory)
  if directory_stat and directory_stat.type ~= "directory" then
    return
  end
  if vim.fn.mkdir(directory, "p", "0700") == 0 and not vim.uv.fs_stat(directory) then
    return
  end
  if not vim.uv.fs_chmod(directory, 448) then
    return
  end

  local path = directory .. "/events.jsonl"
  local file_stat = vim.uv.fs_lstat(path)
  if file_stat and file_stat.type ~= "file" then
    return
  end
  if file_stat and file_stat.size + #record > DEVLOG_MAX_BYTES then
    return
  end

  local descriptor = vim.uv.fs_open(path, "a", 384)
  if not descriptor then
    return
  end
  if not vim.uv.fs_chmod(path, 384) then
    vim.uv.fs_close(descriptor)
    return
  end
  file_stat = vim.uv.fs_fstat(descriptor)
  if not file_stat or file_stat.type ~= "file" or file_stat.size + #record > DEVLOG_MAX_BYTES then
    vim.uv.fs_close(descriptor)
    return
  end
  vim.uv.fs_write(descriptor, record, -1)
  vim.uv.fs_close(descriptor)
end

local group = vim.api.nvim_create_augroup("devlog_telemetry", { clear = true })

vim.api.nvim_create_autocmd("BufWritePost", {
  group = group,
  callback = function()
    devlog("buffer-write")
  end,
})

vim.api.nvim_create_autocmd("LspAttach", {
  group = group,
  callback = function()
    devlog("lsp-attach")
  end,
})

local filetype_events = {
  typescript = "filetype-typescript",
  javascript = "filetype-javascript",
  typescriptreact = "filetype-react",
  javascriptreact = "filetype-react",
  angular = "filetype-angular",
  htmlangular = "filetype-angular",
  go = "filetype-go",
  rust = "filetype-rust",
  css = "filetype-css",
  scss = "filetype-scss",
  lua = "filetype-lua",
}

vim.api.nvim_create_autocmd("FileType", {
  group = group,
  callback = function(args)
    local event = filetype_events[args.match]
    if event then
      devlog(event)
    end
  end,
})
