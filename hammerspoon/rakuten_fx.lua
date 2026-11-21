-- rakuten_fx.lua
-- 楽天FX証券 WebTrader の約定照会・注文照会CSVを自動ダウンロードする。
--
-- 使い方は2つ:
--   1) ホットキー (cmd+shift+t): ダイアログで開始日を聞いて、約定照会→注文照会の順に
--      CSVをダウンロードフォルダへ保存する（従来どおり）。
--   2) ローカルHTTPブリッジ (127.0.0.1:CONFIG.bridgePort): fx-review アプリの
--      「CSV取り込み」画面から日付を指定して呼び出すと、ダウンロードしたCSVの中身を
--      そのままJSONで返す。アプリ側はそれでファイル選択を省略できる。
--
-- 導入手順は hammerspoon/README.md を参照。

local CONFIG = {
  hotkeyMods     = { "cmd", "shift" },
  hotkeyKey      = "t",
  chromeBundleID = "com.google.Chrome",
  alertSeconds   = 4,
  pollInterval   = 0.5,
  pollTimeout    = 10.0,
  stepDelay      = 1.5,
  downloadTimeout = 10.0, -- ダウンロード完了をダウンロードフォルダで待つ秒数

  -- ローカルHTTPブリッジ（fx-reviewアプリとの連携）
  bridgePort = 17391,
  -- フロントエンドのオリジン。本番URLを使う場合はここに追加する
  allowedOrigins = {
    ["http://localhost:5173"] = true,
    ["http://127.0.0.1:5173"] = true,
  },
}

------------------------------------------------------------
-- 通知
------------------------------------------------------------
local function showStatus(msg, type)
  local prefix = ({ success="✅ ", error="❌ ", warn="⚠️ ", info="ℹ️ " })[type or "info"] or ""
  hs.alert.closeAll()
  hs.alert.show(prefix .. msg, nil, nil, CONFIG.alertSeconds)
end

------------------------------------------------------------
-- ChromeでJSを実行し、戻り値を文字列で返す
------------------------------------------------------------
local function runJS(js)
  local escaped = js:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', ' ')
  local script = string.format([[
tell application "Google Chrome"
  set res to execute active tab of front window javascript "%s"
  return res as string
end tell
]], escaped)
  local ok, result = hs.osascript.applescript(script)
  return ok, tostring(result or "")
end

------------------------------------------------------------
-- 楽天FXのタブを前面に出す
-- blocking=true のときだけ、見つからない場合にダイアログで案内する
-- （HTTPブリッジ経由ではモーダルダイアログがイベントループを止めてしまうので出さない）
------------------------------------------------------------
local function focusRakutenTab(blocking)
  local script = [[
tell application "Google Chrome"
  set found to false
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      if URL of t contains "fx.rakuten-sec.co.jp" then
        set active tab index of w to i
        set index of w to 1
        set found to true
        activate
        exit repeat
      end if
    end repeat
    if found then exit repeat
  end repeat
  return found
end tell
]]
  local ok, result = hs.osascript.applescript(script)
  if ok and result == true then
    return true
  end

  if blocking then
    local btn = hs.dialog.blockAlert(
      "楽天FX WebTraderが見つかりません",
      "Chromeで楽天FX WebTraderを開いてからもう一度実行してください。\nhttps://fx.rakuten-sec.co.jp/",
      "URLをコピー", "キャンセル"
    )
    if btn == "URLをコピー" then
      hs.pasteboard.setContents("https://fx.rakuten-sec.co.jp/")
      showStatus("URLをコピーしました", "info")
    end
  end
  return false
end

------------------------------------------------------------
-- fx-reviewアプリ自身のタブ（originで始まるURL）を前面に出す。
-- CSV自動取り込みの最後、WebTraderのタブに切り替えっぱなしにせず、
-- 手元の画面をfx-review側へ戻すために使う。見つからなければ何もしない
-- （Chromeで開いていない・別オリジンで開いている等）。
------------------------------------------------------------
local function focusAppTab(origin)
  if not origin or origin == "" then return false end
  local script = string.format([[
tell application "Google Chrome"
  set found to false
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      if URL of t starts with "%s" then
        set active tab index of w to i
        set index of w to 1
        set found to true
        activate
        exit repeat
      end if
    end repeat
    if found then exit repeat
  end repeat
  return found
end tell
]], origin)
  local ok, result = hs.osascript.applescript(script)
  return ok and result == true
end

------------------------------------------------------------
-- 期間入力ダイアログ（開始日のみ）
------------------------------------------------------------
local function askDateRange(callback)
  local ok1, startDate = hs.dialog.textPrompt(
    "楽天FX CSVダウンロード",
    "開始日を入力してください（例：2026/11/01）",
    "",
    "ダウンロード開始", "キャンセル"
  )
  if ok1 == "キャンセル" or startDate == "" then
    showStatus("キャンセルしました", "info")
    return
  end

  local y, m, d = startDate:match("(%d+)/(%d+)/(%d+)")
  if not (y and m and d) then
    showStatus("日付の形式が正しくありません（例：2026/11/01）", "error")
    return
  end

  callback(y, m, d)
end

------------------------------------------------------------
-- タブリンクをクリック（「約定照会」「注文照会」の切り替え）
--
-- クリック前に、今表示されているiframeのdocumentへ目印(data-rkt-pending)を
-- 付けておく。タブ切り替えでiframeが新しいページへ遷移すると、新しい
-- documentにはこの目印が付いていないので、「まだ古いページのままか」を
-- 判定できる（＝固定秒数の代わりに実際の遷移完了を検知する）。
-- 目印付けとクリックを1回のJS実行にまとめて、取りこぼし(競合)を防ぐ。
------------------------------------------------------------
local function clickTabLink(label)
  runJS(string.format([[
(function() {
  try {
    var frame = document.getElementById('mainFrame');
    if (frame && frame.contentDocument && frame.contentDocument.documentElement) {
      frame.contentDocument.documentElement.setAttribute('data-rkt-pending', '1');
    }
  } catch (e) {}
  var links = document.querySelectorAll('a');
  for (var i = 0; i < links.length; i++) {
    if (links[i].textContent.trim() === '%s') {
      links[i].click(); return;
    }
  }
})();
]], label))
end

------------------------------------------------------------
-- iframeに特定ボタンが出るまでポーリングして操作
------------------------------------------------------------
local function waitAndRun(checkJS, onDone)
  local elapsed = 0
  local timer
  timer = hs.timer.doEvery(CONFIG.pollInterval, function()
    elapsed = elapsed + CONFIG.pollInterval
    local ok, result = runJS(checkJS)
    if ok and result == "OK" then
      timer:stop()
      onDone(true, "OK")
    elseif ok and result:sub(1, 6) == "ERROR:" then
      timer:stop()
      onDone(false, result)
    elseif elapsed >= CONFIG.pollTimeout then
      timer:stop()
      onDone(false, "ERROR:タイムアウト（iframeの読み込みに時間がかかりすぎています）")
    end
  end)
end

------------------------------------------------------------
-- 約定照会: 日付セット → 表示ボタンクリック
--
-- clickTabLink が付けた data-rkt-pending が残っている間は、まだタブ切り替え
-- （iframeのページ遷移）が完了していない古いdocumentなので WAIT を返し続ける。
-- 目印が消えて（＝新しいdocumentに切り替わって）必要な要素が揃って初めて
-- 操作に進む。固定の待ち時間は使わない。
------------------------------------------------------------
local function searchYakujo(y, m, d, onDone)
  local js = string.format([[
(function() {
  var frame = document.getElementById('mainFrame');
  if (!frame) return 'WAIT';
  var doc = frame.contentDocument;
  if (!doc) return 'WAIT';
  try {
    if (doc.documentElement.getAttribute('data-rkt-pending') === '1') return 'WAIT';
  } catch (e) { return 'WAIT'; }
  var fy = doc.querySelector('input[name="fromDateY"]');
  var fm = doc.querySelector('input[name="fromDateM"]');
  var fd = doc.querySelector('input[name="fromDateD"]');
  var btn = doc.querySelector('input[type="image"][src*="btn_display"]');
  if (!fy || !fm || !fd) return 'WAIT';
  if (!btn) return 'WAIT';
  fy.value = '%s'; fm.value = '%s'; fd.value = '%s';
  var ty = doc.querySelector('input[name="toDateY"]');
  var tm = doc.querySelector('input[name="toDateM"]');
  var td = doc.querySelector('input[name="toDateD"]');
  if (ty) ty.value = ''; if (tm) tm.value = ''; if (td) td.value = '';
  if (typeof doc.defaultView.showPosition === 'function') {
    doc.defaultView.showPosition();
  } else {
    btn.click();
  }
  return 'OK';
})();
]], y, m, d)
  waitAndRun(js, onDone)
end

------------------------------------------------------------
-- 注文照会: 注文日ラジオ → 日付セット → 表示ボタンクリック
--
-- 「訂正・取消可能な注文のみ」(orderRefMode_1) がデフォルトで選ばれているため、
-- 「注文日」(orderRefMode_2) に切り替える。切り替え直後は画面がフィールドを
-- 再描画する（＝日付入力欄のDOM要素が作り直される）ため、固定秒数で待つ
-- 代わりに、切り替え前の要素に目印(data-rkt-pending)を付けておき、その目印
-- が付いた要素が「作り直されて消える」までポーリングして待つ。
------------------------------------------------------------
local function searchChumon(y, m, d, onDone)
  -- フェーズ1: タブ遷移が完了し、ラジオボタンが操作可能になるまで待ってからクリック
  local jsRadioReady = [[
(function() {
  var frame = document.getElementById('mainFrame');
  if (!frame) return 'WAIT';
  var doc = frame.contentDocument;
  if (!doc) return 'WAIT';
  try {
    if (doc.documentElement.getAttribute('data-rkt-pending') === '1') return 'WAIT';
  } catch (e) { return 'WAIT'; }
  var radio2 = doc.getElementById('orderRefMode_2');
  if (!radio2) return 'WAIT';
  var fy = doc.querySelector('input[name="fromDateY"]');
  if (fy) fy.setAttribute('data-rkt-pending', '1');
  radio2.checked = true;
  var event = doc.createEvent('Event');
  event.initEvent('change', true, true);
  radio2.dispatchEvent(event);
  radio2.click();
  return 'OK';
})();
]]

  waitAndRun(jsRadioReady, function(okRadio, msgRadio)
    if not okRadio then
      onDone(false, msgRadio)
      return
    end

    -- フェーズ2: ラジオ切り替えによる再描画が終わる（＝目印付き要素が作り直されて
    -- 消える）まで待ってから、日付をセットして表示ボタンを押す
    local jsAfterRadio = string.format([[
(function() {
  var frame = document.getElementById('mainFrame');
  if (!frame) return 'WAIT';
  var doc = frame.contentDocument;
  if (!doc) return 'WAIT';
  var fy = doc.querySelector('input[name="fromDateY"]');
  var fm = doc.querySelector('input[name="fromDateM"]');
  var fd = doc.querySelector('input[name="fromDateD"]');
  if (!fy || !fm || !fd) return 'WAIT';
  if (fy.getAttribute('data-rkt-pending') === '1') return 'WAIT';
  fy.value = '%s'; fm.value = '%s'; fd.value = '%s';
  var ty = doc.querySelector('input[name="toDateY"]');
  var tm = doc.querySelector('input[name="toDateM"]');
  var td = doc.querySelector('input[name="toDateD"]');
  if (ty) ty.value = ''; if (tm) tm.value = ''; if (td) td.value = '';
  if (typeof doc.defaultView.showPosition === 'function') {
    doc.defaultView.showPosition();
  } else {
    var btn = doc.getElementById('search_btn');
    if (btn) btn.click();
  }
  return 'OK';
})();
]], y, m, d)
    waitAndRun(jsAfterRadio, onDone)
  end)
end

------------------------------------------------------------
-- CSV保存ボタンをポーリングしてクリック
-- onclick="downloadPosition('URL'); return false" を直接呼ぶ（return false で
-- click() 経由だと動かないことがあるため）
------------------------------------------------------------
local function clickCsvButton(onDone)
  local js = [[
(function() {
  var frame = document.getElementById('mainFrame');
  if (!frame) return 'WAIT';
  var doc = frame.contentDocument;
  var bodyText = doc.body ? doc.body.innerText : '';
  if (bodyText.indexOf('該当する情報がありません') !== -1) return 'ERROR:該当データなし';
  var btn = doc.querySelector('input[type="image"][src*="btn_save"]');
  if (!btn) return 'WAIT';
  var onclickAttr = btn.getAttribute('onclick') || '';
  var match = onclickAttr.match(/downloadPosition\('([^']+)'\)/);
  if (match && doc.defaultView && typeof doc.defaultView.downloadPosition === 'function') {
    doc.defaultView.downloadPosition(match[1]);
  } else {
    btn.click();
  }
  return 'OK';
})();
]]
  waitAndRun(js, onDone)
end

------------------------------------------------------------
-- ダウンロードフォルダの中身をスナップショット/監視
-- （CSVの中身をHTTPレスポンスで返すために、ブラウザが保存したファイルを捕まえる）
------------------------------------------------------------
local function downloadsDir()
  return os.getenv("HOME") .. "/Downloads"
end

local function listDownloadFiles()
  local dir = downloadsDir()
  local set = {}
  for file in hs.fs.dir(dir) do
    if file ~= "." and file ~= ".." then
      set[file] = true
    end
  end
  return set, dir
end

-- before に無い、拡張子が .crdownload/.download でない新規ファイルが出てきて、
-- かつサイズが安定するまで待つ
local function waitForNewDownload(before, dir, timeoutSec, onDone)
  local elapsed = 0
  local interval = 0.3
  local candidate = nil
  local candidateSize = nil
  local timer
  timer = hs.timer.doEvery(interval, function()
    elapsed = elapsed + interval

    if not candidate then
      for file in hs.fs.dir(dir) do
        if file ~= "." and file ~= ".." and not before[file]
          and not file:match("%.crdownload$") and not file:match("%.download$") then
          candidate = file
        end
      end
    end

    if candidate then
      local path = dir .. "/" .. candidate
      local attr = hs.fs.attributes(path)
      local size = attr and attr.size or nil
      if size and size > 0 and size == candidateSize then
        timer:stop()
        onDone(true, path)
        return
      end
      candidateSize = size
    end

    if elapsed >= timeoutSec then
      timer:stop()
      onDone(false, "ERROR:ダウンロードしたファイルが見つかりません（タイムアウト）")
    end
  end)
end

------------------------------------------------------------
-- メイン処理（ホットキー用）
------------------------------------------------------------
local function run()
  if not focusRakutenTab(true) then
    return
  end

  hs.timer.doAfter(0.5, function()
    askDateRange(function(y, m, d)

      -- ===== 約定照会 =====
      showStatus("約定照会を取得中…", "info")
      clickTabLink("約定照会")

      searchYakujo(y, m, d, function(ok1, msg1)
        if not ok1 then
          showStatus("約定照会: 表示に失敗（" .. msg1:gsub("ERROR:", "") .. "）", "error")
          return
        end

        clickCsvButton(function(ok2, msg2)
          if not ok2 then
            local errMsg = msg2:gsub("ERROR:", "")
            if errMsg == "該当データなし" then
              showStatus("約定照会: 該当データなし", "warn")
            else
              showStatus("約定照会: CSV保存失敗（" .. errMsg .. "）", "error")
              return
            end
          end

          -- ===== 注文照会 =====
          hs.timer.doAfter(CONFIG.stepDelay, function()
            showStatus("注文照会を取得中…", "info")
            clickTabLink("注文照会")

            searchChumon(y, m, d, function(ok3, msg3)
              if not ok3 then
                showStatus("注文照会: 表示に失敗（" .. msg3:gsub("ERROR:", "") .. "）", "error")
                return
              end

              clickCsvButton(function(ok4, msg4)
                if not ok4 then
                  local errMsg = msg4:gsub("ERROR:", "")
                  if errMsg == "該当データなし" then
                    showStatus("注文照会: 該当データなし", "warn")
                  else
                    showStatus("注文照会: CSV保存失敗（" .. errMsg .. "）", "error")
                    return
                  end
                end

                hs.timer.doAfter(1.0, function()
                  showStatus("ダウンロード完了！", "success")
                end)
              end)
            end)
          end)
        end)
      end)
    end)
  end)
end

------------------------------------------------------------
-- ホットキー登録
------------------------------------------------------------
hs.hotkey.bind(CONFIG.hotkeyMods, CONFIG.hotkeyKey, run)

------------------------------------------------------------
-- HTTPブリッジ（fx-reviewアプリの「CSV取り込み」画面から呼ばれる）
--
-- POST /rakuten-import   body: {"date":"2026/11/01","kind":"execution"|"order"}
--                         -> {"ok":true,"jobId":"..."}  （202相当、即座に返す）
-- GET  /rakuten-import/status?job=...
--                         -> {"ok":true,"status":"running"}
--                         -> {"ok":true,"status":"done","name":"...","contentBase64":"..."}
--                         -> {"ok":true,"status":"error","message":"..."}
--
-- ダウンロード自体は秒単位で時間がかかるため、POSTはジョブを起動するだけで
-- 即座に返し、進捗はジョブIDをキーにしたテーブルにためて、statusのポーリングで渡す。
-- （hs.httpserverのコールバックは同期的に返す必要があり、ここで何秒もブロックすると
-- Hammerspoon全体が固まってしまうため）
------------------------------------------------------------
local jobs = {}
local jobSeq = 0

local function newJobId()
  jobSeq = jobSeq + 1
  return tostring(os.time()) .. "-" .. tostring(jobSeq)
end

local function anyJobRunning()
  for _, j in pairs(jobs) do
    if j.status == "running" then return true end
  end
  return false
end

local function finishJobError(jobId, message)
  jobs[jobId] = { status = "error", message = message }
end

local function runImportJob(jobId, kind, y, m, d)
  if not focusRakutenTab(false) then
    finishJobError(jobId, "楽天FX WebTraderのタブが見つかりません。Chromeで開いてログインしてから、もう一度試してください。")
    return
  end

  local tabLabel = (kind == "execution") and "約定照会" or "注文照会"
  local searchFn = (kind == "execution") and searchYakujo or searchChumon

  hs.timer.doAfter(0.3, function()
    clickTabLink(tabLabel)

    searchFn(y, m, d, function(ok1, msg1)
      if not ok1 then
        finishJobError(jobId, "表示に失敗しました（" .. msg1:gsub("ERROR:", "") .. "）")
        return
      end

      local before, dir = listDownloadFiles()

      clickCsvButton(function(ok2, msg2)
        if not ok2 then
          local errMsg = msg2:gsub("ERROR:", "")
          if errMsg == "該当データなし" then
            finishJobError(jobId, "該当データがありません")
          else
            finishJobError(jobId, "CSV保存に失敗しました（" .. errMsg .. "）")
          end
          return
        end

        waitForNewDownload(before, dir, CONFIG.downloadTimeout, function(ok3, pathOrMsg)
          if not ok3 then
            finishJobError(jobId, pathOrMsg:gsub("ERROR:", ""))
            return
          end

          local path = pathOrMsg
          local f = io.open(path, "rb")
          if not f then
            finishJobError(jobId, "ダウンロードしたファイルを読めませんでした")
            return
          end
          local data = f:read("a")
          f:close()

          local name = path:match("([^/]+)$") or "download.csv"
          jobs[jobId] = {
            status = "done",
            name = name,
            contentBase64 = hs.base64.encode(data),
          }

          -- 同じファイルを何度も拾わないよう、取り込み済みフォルダへ移しておく
          local archiveDir = dir .. "/rakuten-imported"
          os.execute(string.format('mkdir -p "%s"', archiveDir))
          os.rename(path, archiveDir .. "/" .. name)
        end)
      end)
    end)
  end)
end

local function corsHeaders(origin)
  if not CONFIG.allowedOrigins[origin] then return {} end
  return {
    ["Access-Control-Allow-Origin"] = origin,
    ["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS",
    ["Access-Control-Allow-Headers"] = "Content-Type",
    ["Vary"] = "Origin",
  }
end

-- Reload Config のたびにこのファイルは最初から再実行されるため、ローカル変数の
-- `bridge` は毎回新しく作られる。古いサーバーを明示的に stop() しないと、
-- 同じポートに複数のリスナーが残ったり、Luaのガベージコレクションのタイミング次第で
-- 一時的にポートが誰にも掴まれていない状態になったりして、ブリッジへの接続が
-- 不安定になる（「繋がったり繋がらなかったり」する）。再実行をまたいで古いサーバーを
-- 参照できるよう、グローバル変数に保持しておいて確実に止める。
if _G.__rakutenFxBridge then
  pcall(function() _G.__rakutenFxBridge:stop() end)
  _G.__rakutenFxBridge = nil
end

local bridge = hs.httpserver.new(false, false)
bridge:setPort(CONFIG.bridgePort)
bridge:setInterface("127.0.0.1")
bridge:setCallback(function(method, path, headers, body)
  local origin = headers["Origin"] or headers["origin"] or ""
  local allowed = CONFIG.allowedOrigins[origin] == true
  local cors = corsHeaders(origin)
  local basePath = path:match("^[^?]+") or path

  if method == "OPTIONS" then
    return "", 204, cors
  end

  if basePath == "/health" then
    return "OK", 200, cors
  end

  if not allowed then
    return hs.json.encode({ ok = false, message = "forbidden origin" }), 403, cors
  end

  if basePath == "/rakuten-import" and method == "POST" then
    local ok, parsed = pcall(hs.json.decode, body)
    if not ok or type(parsed) ~= "table" then
      return hs.json.encode({ ok = false, message = "リクエストを読めませんでした" }), 400, cors
    end

    local y, m, d = tostring(parsed.date or ""):match("(%d+)/(%d+)/(%d+)")
    if not (y and m and d) then
      return hs.json.encode({ ok = false, message = "date は YYYY/MM/DD 形式で指定してください" }), 400, cors
    end
    local kind = parsed.kind
    if kind ~= "execution" and kind ~= "order" then
      return hs.json.encode({ ok = false, message = "kind は execution か order です" }), 400, cors
    end
    if anyJobRunning() then
      return hs.json.encode({ ok = false, message = "ほかの取り込みが進行中です。少し待ってから試してください" }), 409, cors
    end

    local jobId = newJobId()
    jobs[jobId] = { status = "running" }
    runImportJob(jobId, kind, y, m, d)
    return hs.json.encode({ ok = true, jobId = jobId }), 200, cors
  end

  -- POST /focus-app: CSV自動取り込みが終わったあと、Chromeのタブ・ウィンドウを
  -- fx-reviewアプリ自身（リクエスト元のorigin）へ切り替える。見つからなくても
  -- フロント側の処理は続くので、ここでは成否をfocusedで返すだけでエラーにはしない
  if basePath == "/focus-app" and method == "POST" then
    local focused = focusAppTab(origin)
    return hs.json.encode({ ok = true, focused = focused }), 200, cors
  end

  if basePath == "/rakuten-import/status" and method == "GET" then
    local jobId = path:match("job=([^&]+)")
    local job = jobId and jobs[jobId]
    if not job then
      return hs.json.encode({ ok = false, message = "job not found" }), 404, cors
    end
    if job.status == "running" then
      return hs.json.encode({ ok = true, status = "running" }), 200, cors
    end
    local result
    if job.status == "error" then
      result = hs.json.encode({ ok = true, status = "error", message = job.message })
    else
      result = hs.json.encode({
        ok = true,
        status = "done",
        name = job.name,
        contentBase64 = job.contentBase64,
      })
    end
    jobs[jobId] = nil
    return result, 200, cors
  end

  return hs.json.encode({ ok = false, message = "not found" }), 404, cors
end)
bridge:start()
_G.__rakutenFxBridge = bridge

showStatus("楽天FX ダウンロードツール 読み込み完了", "info")
