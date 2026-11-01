import { ErrorUtils } from 'react-native';

type GlobalHandler = (error: Error, isFatal?: boolean) => void;

/**
 * 本番で未処理 JS 例外が RCTFatal → SIGABRT になるのを緩和する。
 * 開発時は従来どおり。
 */
export function installJsErrorGuard(): void {
  const utils = ErrorUtils as {
    getGlobalHandler?: () => GlobalHandler | undefined;
    setGlobalHandler?: (handler: GlobalHandler) => void;
  };
  if (
    typeof utils?.getGlobalHandler !== 'function' ||
    typeof utils?.setGlobalHandler !== 'function'
  ) {
    return;
  }
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    try {
      console.error('[jsErrorGuard]', isFatal ? 'fatal' : 'nonfatal', error);
    } catch {
      // ignore
    }
    if (__DEV__) {
      previous?.(error, isFatal);
      return;
    }
    if (!isFatal) {
      previous?.(error, false);
    }
  });
}
