/**
 * A value, if it arrives in time; otherwise null.
 *
 * For parts of a page that are welcome when they are quick and are better
 * left out than let arrive late: a line that lands after the page is already
 * on screen pushes everything under it down, just as a shopper reaches for a
 * button.
 *
 * It never rejects (a failed promise is "not in time"), and the timer does
 * not keep the server process alive.
 */
export function withinDeadline<T>(value: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    // Node's timers can be told not to hold the process open; a browser's cannot.
    if (typeof timer === "object" && timer !== null && "unref" in timer) timer.unref();
    value.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
