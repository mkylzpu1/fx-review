//+------------------------------------------------------------------+
//| FxReviewExport.mq5                                               |
//| 1分足を一定間隔で CSV に書き出す EA（fx-review の candles:sync 用）  |
//| 出力: Common\Files\fx-review\<銘柄>_M1.csv                          |
//| 形式: サーバー時刻のepoch秒,open,high,low,close（確定した足のみ）    |
//+------------------------------------------------------------------+
#property strict
#property version "1.00"

input string InpSymbol      = "USDJPY";           // 書き出す銘柄（ブローカーの表記に合わせる）
input int    InpDays        = 30;                 // 何日分を書き出すか
input int    InpIntervalMin = 5;                  // 書き出し間隔（分）
input string InpFileName    = "fx-review\\USDJPY_M1.csv";

int OnInit()
{
   SymbolSelect(InpSymbol, true);
   EventSetTimer(InpIntervalMin * 60);
   ExportCandles();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTimer() { ExportCandles(); }

void ExportCandles()
{
   MqlRates rates[];
   datetime to   = TimeCurrent();
   datetime from = to - (datetime)(InpDays * 86400);
   int n = CopyRates(InpSymbol, PERIOD_M1, from, to, rates);
   if(n <= 1)
   {
      Print("FxReviewExport: 1分足を取得できません（", InpSymbol, "）error=", GetLastError());
      return;
   }
   int digits = (int)SymbolInfoInteger(InpSymbol, SYMBOL_DIGITS);
   string tmp = InpFileName + ".tmp";
   int h = FileOpen(tmp, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(h == INVALID_HANDLE)
   {
      Print("FxReviewExport: ファイルを開けません error=", GetLastError());
      return;
   }
   // 最後の1本は形成中なので除く
   for(int i = 0; i < n - 1; i++)
   {
      FileWriteString(h, StringFormat("%I64d,%s,%s,%s,%s\n",
         (long)rates[i].time,
         DoubleToString(rates[i].open, digits),
         DoubleToString(rates[i].high, digits),
         DoubleToString(rates[i].low, digits),
         DoubleToString(rates[i].close, digits)));
   }
   FileClose(h);
   // 書き込み途中のファイルを読まれないよう、完成後に差し替える
   if(!FileMove(tmp, FILE_COMMON, InpFileName, FILE_COMMON | FILE_REWRITE))
      Print("FxReviewExport: ファイルの差し替えに失敗 error=", GetLastError());
}
