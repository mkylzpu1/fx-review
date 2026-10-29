import "@testing-library/jest-dom";

/**
 * Node 24 の Request は、jsdom の AbortSignal を「AbortSignal ではない」として拒否する
 * （Node 22 までは通っていた）。React Router は画面遷移のたびに signal 付きの Request を作るため、
 * テスト（jsdom）では遷移が静かに失敗してしまう。
 * テストでは中断（abort）の挙動を使わないので、signal だけ外して Request を作る。
 * アプリ本体（ブラウザ）には影響しない。
 */
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.signal) {
      const { signal: _signal, ...rest } = init;
      void _signal;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
} as typeof Request;
