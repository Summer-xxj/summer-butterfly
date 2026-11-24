#!/bin/zsh
set -eu
unsetopt BG_NICE
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  print '请安装 Node.js 22.12+，再双击 start.command。 / Install Node.js 22.12+.'
  read -r '?按回车关闭 / Press Enter to close. '
  exit 1
fi

url='http://127.0.0.1:4173/'
open_browser() {
  if [[ -d '/Applications/Google Chrome.app' ]]; then
    /usr/bin/open -a 'Google Chrome' "$url"
  else
    /usr/bin/open "$url"
  fi
}

if /usr/sbin/lsof -nP -iTCP:4173 -sTCP:LISTEN >/dev/null 2>&1; then
  if curl --noproxy '*' --fail --silent "$url" | /usr/bin/grep -Fq '<html lang="zh-CN" data-palmverse>'; then
    open_browser
    print 'Summer 的宇宙已在运行。'
    exit 0
  fi
  print '端口 4173 已被占用。可运行 npm run dev，使用端口 5173。'
  exit 1
fi

if [[ ! -x node_modules/.bin/vite ]]; then
  print '首次启动：正在安装本地依赖。 / Installing local dependencies.'
  npm ci
fi
if [[ ! -s public/models/hand_landmarker.task ]]; then
  print '缺少手势模型，请恢复项目中的 public/models/hand_landmarker.task。'
  exit 1
fi
if [[ ! -s public/wasm/vision_wasm_internal.wasm || ! -s public/vendor/vision_bundle.js ]]; then
  npm run assets
fi
npm run build

./node_modules/.bin/vite preview --host 127.0.0.1 --port 4173 --strictPort &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
trap 'exit 0' INT TERM
for attempt in {1..60}; do
  kill -0 "$server_pid" 2>/dev/null || exit 1
  if curl --noproxy '*' --fail --silent "$url" > /dev/null; then
    open_browser
    print 'Summer 的宇宙已开启。关闭此终端或按 Control+C 停止。'
    wait "$server_pid"
    exit 0
  fi
  sleep .2
done
print "本地服务器未就绪，请检查终端信息。"
exit 1
