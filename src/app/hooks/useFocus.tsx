import { useCallback, MutableRefObject } from "react";
export function useFocus(ref: MutableRefObject<HTMLElement | null>) {
  const setFocus = useCallback(() => {
    if (ref.current) {
      ref.current.focus();
    }
  }, [ref]);
  return setFocus;
}
