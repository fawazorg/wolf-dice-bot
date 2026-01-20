/**
 * Timer abstraction for game phase timeouts
 * Provides a platform-agnostic interface for timer management
 */
class Timer {
  /** @type {string|null} Timer ID */
  #id;

  /** @type {number|null} Duration in milliseconds */
  #duration;

  /** @type {Function|null} Callback function */
  #callback;

  /** @type {any} Timer handle (platform-specific) */
  #handle;

  /** @type {boolean} Whether timer is active */
  #active;

  /** @type {number|null} Start timestamp */
  #startedAt;

  /** @type {number|null} End timestamp */
  #endsAt;

  /**
   * @param {string} id - Unique timer identifier
   */
  constructor(id) {
    this.#id = id;
    this.#duration = null;
    this.#callback = null;
    this.#handle = null;
    this.#active = false;
    this.#startedAt = null;
    this.#endsAt = null;
  }

  /** @returns {string} Timer ID */
  get id() {
    return this.#id;
  }

  /** @returns {boolean} Whether timer is currently active */
  get active() {
    return this.#active;
  }

  /** @returns {number|null} Duration in milliseconds */
  get duration() {
    return this.#duration;
  }

  /** @returns {number|null} Remaining time in milliseconds */
  get remaining() {
    if (!this.#active || !this.#endsAt) {
      return null;
    }
    return Math.max(0, this.#endsAt - Date.now());
  }

  /** @returns {number|null} Elapsed time in milliseconds */
  get elapsed() {
    if (!this.#active || !this.#startedAt) {
      return null;
    }
    return Date.now() - this.#startedAt;
  }

  /**
   * Start the timer
   * @param {Function} callback - Function to call when timer expires
   * @param {number} duration - Duration in milliseconds
   * @param {Function} scheduler - Function to schedule timer (default: setTimeout)
   * @returns {Timer} This instance for chaining
   */
  start(callback, duration, scheduler = setTimeout) {
    this.stop();

    this.#callback = callback;
    this.#duration = duration;
    this.#startedAt = Date.now();
    this.#endsAt = this.#startedAt + duration;
    this.#active = true;

    this.#handle = scheduler(() => {
      this.#active = false;
      if (this.#callback) {
        this.#callback();
      }
    }, duration);

    return this;
  }

  /**
   * Stop the timer
   * @param {Function} clearer - Function to clear timer (default: clearTimeout)
   * @returns {Timer} This instance for chaining
   */
  stop(clearer = clearTimeout) {
    if (this.#handle !== null) {
      clearer(this.#handle);
      this.#handle = null;
    }

    this.#active = false;
    return this;
  }

  /**
   * Reset and restart the timer with same callback and duration
   * @param {Function} scheduler - Function to schedule timer
   * @param {Function} clearer - Function to clear timer
   * @returns {Timer} This instance for chaining
   */
  restart(scheduler = setTimeout, _clearer = clearTimeout) {
    if (this.#callback === null || this.#duration === null) {
      throw new Error('Cannot restart timer: no callback or duration set');
    }

    return this.start(this.#callback, this.#duration, scheduler);
  }

  /**
   * Create a snapshot of timer state
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.#id,
      active: this.#active,
      duration: this.#duration,
      remaining: this.remaining,
      elapsed: this.elapsed
    };
  }
}

export default Timer;
