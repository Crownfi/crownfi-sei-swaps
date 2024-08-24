type Timeouts = {
  [key: string]: NodeJS.Timeout
}

export class DebouncedCallbacks {
  private _timeouts: Timeouts;

  constructor() {
    this._timeouts = {};
  }

  get timeouts() {
    return this._timeouts;
  }

  debounce<T extends unknown[]>(func: (...args: T) => void, delay = 500) {
    return (...args: T) => {
      if (this._timeouts[func.toString()]) 
        clearTimeout(this._timeouts[func.toString()]);

      this._timeouts[func.toString()] = setTimeout(() => {
        func.call(null, ...args);
      }, delay);
    };
}
}