export interface CampaignRuntimeControl {
  cancelled: boolean;
  paused: boolean;
  wakeWait?: () => void;
}

export async function waitForCampaignRuntime(
  state: CampaignRuntimeControl,
  milliseconds: number,
): Promise<boolean> {
  if (state.cancelled || state.paused) {
    return false;
  }

  const duration = Math.max(0, milliseconds);

  if (duration === 0) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    let finished = false;

    const finish = (): void => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timer);

      if (state.wakeWait === finish) {
        state.wakeWait = undefined;
      }

      resolve(
        !state.cancelled &&
        !state.paused,
      );
    };

    const timer = setTimeout(
      finish,
      duration,
    );

    state.wakeWait = finish;

    if (state.cancelled || state.paused) {
      finish();
    }
  });
}

export function wakeCampaignRuntime(
  state: CampaignRuntimeControl,
): void {
  const wake = state.wakeWait;
  state.wakeWait = undefined;
  wake?.();
}
