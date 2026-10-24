//+------------------------------------------------------------------+
//| FxReviewExport.mq5                                               |
//| チャート上の「CSV書き出し」ボタンを押すと、1分足を CSV に書き出す EA   |
//| （fx-review の「ローソク足を更新」ボタンが、この CSV を読む）          |
//| 出力: Common\Files\fx-review\<銘柄>_M1.csv                          |
//| 形式: サーバー時刻のepoch秒,open,high,low,close（確定した足のみ）    |
//+------------------------------------------------------------------+
#property strict
#property version "2.00"

input string InpSymbol   = "USDJPY";                 // 書き出す銘柄（ブローカーの表記に合わせる）
input int    InpDays     = 60;                       // 何日分を書き出すか
input string InpFileName = "fx-review\\USDJPY_M1.csv";

const string BTN_NAME = "FxReviewExportButton";

int OnInit()
{
   SymbolSelect(InpSymbol, true);
   ObjectCreate(0, BTN_NAME, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, BTN_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, BTN_NAME, OBJPROP_XDISTANCE, 10);
   ObjectSetInteger(0, BTN_NAME, OBJPROP_YDISTANCE, 30);
   ObjectSetInteger(0, BTN_NAME, OBJPROP_XSIZE, 130);
   ObjectSetInteger(0, BTN_NAME, OBJPROP_YSIZE, 28);
   ObjectSetString(0, BTN_NAME, OBJPROP_TEXT, "CSV書き出し");
   ObjectSetInteger(0, BTN_NAME, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, BTN_NAME, OBJPROP_BGCOLOR, clrDodgerBlue);
   ObjectSetInteger(0, BTN_NAME, OBJPROP_STATE, false);
   ChartRedraw();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   ObjectDelete(0, BTN_NAME);
   Comment("");
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == BTN_NAME)
   {
      Comment("FxReviewExport: 書き出し中...");
      int n = ExportCandles();
      if(n > 0)
         Comment("FxReviewExport: ", n, "本を書き出しました（", TimeToString(TimeLocal(), TIME_MINUTES), "）");
      else
         Comment("FxReviewExport: 書き出せませんでした。「エキスパート」タブを確認してください");
      // ボタンを押した状態のままにしない
      ObjectSetInteger(0, BTN_NAME, OBJPROP_STATE, false);
      ChartRedraw();
   }
}

// 書き出した本数を返す（失敗時は 0）
int ExportCandles()
{
   MqlRates rates[];
   datetime to   = TimeCurrent();
   datetime from = to - (datetime)(InpDays * 86400);
   int n = CopyRates(InpSymbol, PERIOD_M1, from, to, rates);
   if(n <= 1)
   {
      Print("FxReviewExport: 1分足を取得できません（", InpSymbol, "）error=", GetLastError());
      return 0;
   }
   int digits = (int)SymbolInfoInteger(InpSymbol, SYMBOL_DIGITS);
   string tmp = InpFileName + ".tmp";
   int h = FileOpen(tmp, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(h == INVALID_HANDLE)
   {
      Print("FxReviewExport: ファイルを開けません error=", GetLastError());
      return 0;
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
   {
      Print("FxReviewExport: ファイルの差し替えに失敗 error=", GetLastError());
      return 0;
   }
   return n - 1;
}
