type Timeouts = {
  [key: string]: NodeJS.Timeout | null
}

export class DebouncedCallbacks {
  private _timeouts: Timeouts;

  constructor() {
    this._timeouts = {};
  }

  get timeouts() {
    return this._timeouts;
  }
  // TODO: refactor method to execute the function instead of returning a new one
  debounce<T extends unknown[]>(func: (...args: T) => void, delay = 500) {
    return (...args: T) => {
      if (this._timeouts[func.toString()]) 
        clearTimeout(this._timeouts[func.toString()]!);

      this._timeouts[func.toString()] = setTimeout(() => {
        func.call(null, ...args);
        this._timeouts[func.toString()] = null;
      }, delay);
    };
}
}