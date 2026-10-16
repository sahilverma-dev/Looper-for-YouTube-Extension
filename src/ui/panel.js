/*
 * Advanced loop panel — count, portion (with draggable range) and playlist
 * end behaviour. Rebuilt around an explicit `app` interface so it stays
 * testable and has no hidden globals.
 */

import { IDS, SESSION_KEYS, MAX_LOOP_COUNT, MAX_LOOP_MINUTES } from '../constants.js';
import { formatTime, parseTime } from '../util/time.js';

const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  if (props.className) node.className = props.className;
  for (const child of [].concat(children)) {
    if (child != null) node.appendChild(child);
  }
  return node;
};

export class LoopPanel {
  /**
   * @param {Object} app  the extension facade (session, settings, i18n,
   *                      controller, replaceUrlVar, checkAutoplay, …)
   */
  constructor(app) {
    this.app = app;
    this.root = null;
    this.slider = null;
    this.sliderBar = null;
    this.startInput = null;
    this.endInput = null;
  }

  // --- construction ---------------------------------------------------------

  build() {
    const { i18n } = this.app;
    const root = el('div', { id: IDS.panel, className: 'loop-panel item style-scope ytd-watch-metadata' });

    root.appendChild(this.#buildOptionsLink());
    root.appendChild(this.#buildInfo());
    root.appendChild(this.#buildCount());
    if (this.app.settings.debug) root.appendChild(this.#buildTimer());
    root.appendChild(this.#buildEndPanel());
    this.#buildPortion(root);
    root.appendChild(this.#buildTips());

    root.classList.add('hid');
    this.root = root;
    return root;
  }

  #buildOptionsLink() {
    const wrap = el('div', { className: 'loop-panel-optionslink-container' });
    if (this.app.optionPage && !this.app.inIncognito) {
      const link = el('a', { id: 'options-page-link', innerText: this.app.i18n.t('options') });
      link.addEventListener('click', () => window.open(this.app.optionPage));
      wrap.appendChild(link);
    }
    return wrap;
  }

  #buildInfo() {
    const info = el('div', { className: 'loop-panel-info-container' });
    const counter = el('span', { id: 'loop-counter' });
    const count = el('span', {}, [
      document.createTextNode(this.app.i18n.t('played_times')),
      counter,
      document.createTextNode(this.app.i18n.t('times_played')),
    ]);
    info.appendChild(count);
    if (this.app.settings.debug) {
      const time = el('span', { id: 'loop-timerTime' });
      info.appendChild(document.createTextNode(this.app.i18n.t('and')));
      info.appendChild(
        el('span', {}, [
          document.createTextNode(this.app.i18n.t('played_minutes')),
          time,
          document.createTextNode(this.app.i18n.t('minutes_played')),
        ]),
      );
    }
    return info;
  }

  #buildCount() {
    const { session, settings, i18n } = this.app;
    const wrap = el('div', { className: 'loop-panel-count-container' });

    const checkbox = el('tp-yt-paper-checkbox', { name: 'loop-count-enable', id: 'loop-count-checkbox' });
    const checkboxElement = el('span', { className: 'yt-uix-form-input-checkbox-element' });
    const label1 = el('label', { innerText: ' ' + i18n.t('loop_for_times') });
    const label2 = el('label', { innerText: i18n.t('times_loop') });
    label1.setAttribute('for', 'loop-count-checkbox');
    label2.setAttribute('for', 'loop-count-checkbox');

    const input = el('input', { type: 'text', id: 'loop-count', className: 'yt-uix-form-input-text', value: 10 });
    input.maxLength = 4;

    const commit = (value) => {
      let t = Math.round(Number(value));
      if (!Number.isFinite(t)) t = 1;
      t = Math.min(Math.max(t, 1), MAX_LOOP_COUNT);
      session.set(SESSION_KEYS.loopCount, t);
      input.value = t;
      if (this.app.isLooping()) this.app.replaceUrlVar('loop', t);
      this.app.checkAutoplay();
    };

    input.addEventListener('change', () => {
      commit(input.value);
      if (!session.getBool(SESSION_KEYS.loopInCount)) checkbox.click();
    });
    input.addEventListener('keydown', (e) => {
      if (e.keyCode !== 38 && e.keyCode !== 40) return;
      const delta = e.keyCode === 38 ? 1 : -1;
      commit(Number(input.value) + delta);
    });
    input.addEventListener('wheel', (e) => {
      if (input !== document.activeElement) return;
      e.preventDefault();
      commit(Number(input.value) - Math.sign(e.deltaY));
    });
    input.addEventListener('click', () => {
      if (input === document.activeElement) input.select();
    });

    checkbox.addEventListener('click', () => {
      if (checkbox.checked) {
        session.setBool(SESSION_KEYS.loopInCount, true);
        this.app.replaceUrlVar('loop', session.getNumber(SESSION_KEYS.loopCount));
      } else {
        session.setBool(SESSION_KEYS.loopInCount, false);
        this.app.replaceUrlVar('loop', this.app.isLooping() ? 0 : null);
      }
      this.app.checkAutoplay();
    });

    const group = el('span', {}, [checkbox, checkboxElement]);
    wrap.append(group, label1, input, label2);
    return wrap;
  }

  #buildTimer() {
    const { session, i18n } = this.app;
    const wrap = el('div', { className: 'loop-panel-timer-container' });
    const checkbox = el('tp-yt-paper-checkbox', {
      name: 'loop-timer-enable',
      id: 'loop-timer-checkbox',
      className: 'yt-uix-form-input-checkbox',
    });
    const element = el('span', { className: 'yt-uix-form-input-checkbox-element' });
    const label1 = el('label', { innerText: ' ' + i18n.t('loop_for_minutes') });
    const label2 = el('label', { innerText: i18n.t('minutes_loop') });
    label1.setAttribute('for', 'loop-timer-checkbox');
    label2.setAttribute('for', 'loop-timer-checkbox');

    const input = el('input', { type: 'text', id: 'loop-timer', className: 'yt-uix-form-input-text', value: 10 });
    input.maxLength = 4;

    const commit = (value) => {
      let t = Math.round(Number(value));
      if (!Number.isFinite(t)) t = 1;
      t = Math.min(Math.max(t, 1), MAX_LOOP_MINUTES);
      session.set(SESSION_KEYS.loopTimer, t);
      input.value = t;
      if (this.app.isLooping()) this.app.replaceUrlVar('timer', t);
      this.app.checkAutoplay();
    };
    input.addEventListener('change', () => {
      commit(input.value);
      if (!session.getBool(SESSION_KEYS.loopInTimer)) checkbox.click();
    });
    input.addEventListener('keydown', (e) => {
      if (e.keyCode !== 38 && e.keyCode !== 40) return;
      commit(Number(input.value) + (e.keyCode === 38 ? 1 : -1));
    });
    checkbox.addEventListener('click', () => {
      if (checkbox.checked) {
        session.setBool(SESSION_KEYS.loopInTimer, true);
        this.app.replaceUrlVar('timer', session.getNumber(SESSION_KEYS.loopTimer));
      } else {
        session.setBool(SESSION_KEYS.loopInTimer, false);
        this.app.replaceUrlVar('timer', null);
      }
      this.app.checkAutoplay();
    });

    wrap.append(el('span', {}, [checkbox, element]), label1, input, label2);
    return wrap;
  }

  #buildEndPanel() {
    const { session, i18n } = this.app;
    const wrap = el('div', { id: 'loop-panel-end-container', className: 'loop-panel-end-container' });
    const group = el('span', { id: 'loop-count-end', className: 'yt-uix-button-group' });
    group.setAttribute('data-button-toggle-group', 'required');

    const stopBtn = el('button', {
      id: 'loop-playlist-end-stop',
      className:
        'ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono ' +
        'ytSpecButtonShapeNextSizeM ytSpecButtonShapeNextEnableBackdropFilterExperiment start',
    });
    const playBtn = el('button', {
      id: 'loop-playlist-end-play',
      className:
        'ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono ' +
        'ytSpecButtonShapeNextSizeM ytSpecButtonShapeNextEnableBackdropFilterExperiment end',
    });
    stopBtn.appendChild(el('div', { className: 'ytSpecButtonShapeNextButtonTextContent', innerText: i18n.t('stop_video') }));
    playBtn.appendChild(el('div', { className: 'ytSpecButtonShapeNextButtonTextContent', innerText: i18n.t('continue_to_play_playlist') }));

    const select = (continuePlaylist) => {
      session.setBool(SESSION_KEYS.playlistEndPlay, continuePlaylist);
      stopBtn.classList.toggle('active', !continuePlaylist);
      playBtn.classList.toggle('active', continuePlaylist);
      if (continuePlaylist) this.app.controller.rememberPlaylist();
      else this.app.controller.forgetPlaylist();
    };
    stopBtn.addEventListener('click', () => this.app.hasPlaylist() && select(false));
    playBtn.addEventListener('click', () => this.app.hasPlaylist() && select(true));

    group.append(stopBtn, playBtn);
    wrap.appendChild(group);
    return wrap;
  }

  #buildPortion(root) {
    const { session, i18n } = this.app;
    const wrap = el('div', { id: 'loop-portion-container', className: 'loop-panel-portion-container' });
    const checkbox = el('tp-yt-paper-checkbox', {
      className: 'loop-portion-checkbox',
      id: 'loop-portion-checkbox',
      name: 'loop-portion-enable',
    });
    const checkboxElement = el('span', { className: 'yt-uix-form-input-checkbox-element' });

    const mkLabel = (text) => {
      const l = el('label', { innerText: text });
      l.setAttribute('for', 'loop-portion-checkbox');
      return l;
    };

    this.startInput = el('input', { type: 'text', id: 'loop-start-time-0', className: 'yt-uix-form-input-text', value: '0' });
    this.endInput = el('input', { type: 'text', id: 'loop-end-time-0', className: 'yt-uix-form-input-text', value: '0' });
    this.startInput.title = this.endInput.title = i18n.t('double_click_to_get_current_time');

    wrap.append(
      el('span', {}, [checkbox, checkboxElement]),
      mkLabel(' ' + i18n.t('loop_in_portion_start')),
      mkLabel(i18n.t('from')),
      this.startInput,
      mkLabel(i18n.t('to')),
      this.endInput,
      mkLabel(i18n.t('loop_in_portion_end')),
    );

    // Slider
    const slider = el('div', { id: 'loop-slider-0', className: 'loop-slider' });
    const padding = el('div', { id: 'loop-slider-padding-0', className: 'loop-slider-padding' });
    padding.title = i18n.t('double_click_to_start_loop_in_portion');
    const startPoint = el('div', { className: 'loop-slider-pointer slider-start' });
    const endPoint = el('div', { className: 'loop-slider-pointer slider-end' });
    const mkTooltip = (cls, side) => {
      const tip = el('div', { className: `loop-slider-tooltip html5-progress-tooltip ${cls} ${side}` });
      tip.title = i18n.t('double_click_to_get_current_time');
      tip.appendChild(el('div', { className: 'loop-slider-arrow' }));
      tip.appendChild(
        el('input', {
          type: 'text',
          id: `loop-slider-${cls === 'start' ? 'start' : 'end'}-time-0`,
          className: 'html5-progress-tooltip-timestamp loop-slider-timestamp',
          value: '00:00',
          disabled: true,
        }),
      );
      return tip;
    };
    const tipStart = mkTooltip('start', 'slider-start');
    const tipEnd = mkTooltip('end', 'slider-end');
    padding.append(tipStart, startPoint, tipEnd, endPoint);
    slider.appendChild(padding);
    const sliderContainer = el('div', { id: 'loop-slider-container', className: 'loop-panel-slider-container' }, [slider]);

    this.slider = slider;
    this.sliderBar = padding;

    root.append(wrap, sliderContainer);

    // --- portion events ---
    const setStart = (value) => {
      this.app.setPortion('start', value);
      this.sliderDisplay();
    };
    const setEnd = (value) => {
      this.app.setPortion('end', value);
      this.sliderDisplay();
    };

    this.startInput.addEventListener('change', () => {
      const duration = this.app.duration();
      const t = parseTime(this.startInput.value);
      if (t < 0 || t >= duration) {
        this.startInput.value = formatTime(this.app.portion().start);
        return;
      }
      setStart(t);
      if (!session.getBool(SESSION_KEYS.loopInPortion)) checkbox.click();
    });
    this.endInput.addEventListener('change', () => {
      const duration = this.app.duration();
      let t = parseTime(this.endInput.value);
      if (t > duration) t = duration;
      if (t > this.app.portion().start) setEnd(t);
      if (!session.getBool(SESSION_KEYS.loopInPortion)) checkbox.click();
    });
    this.startInput.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const t = Math.floor(this.app.currentTime());
      if (t < this.app.portion().end) setStart(t);
    });
    this.endInput.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const t = Math.floor(this.app.currentTime());
      if (t > this.app.portion().start) setEnd(t);
    });

    const togglePortion = (enable) => {
      session.setBool(SESSION_KEYS.loopInPortion, enable);
      if (enable) {
        this.app.replaceUrlVar('start', formatTime(this.app.portion().start));
        this.app.replaceUrlVar('end', formatTime(this.app.portion().end));
      } else {
        this.app.replaceUrlVar('start', null);
        this.app.replaceUrlVar('end', null);
      }
      this.sliderDisplay();
    };

    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePortion(checkbox.checked);
    });
    slider.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      togglePortion(!session.getBool(SESSION_KEYS.loopInPortion));
    });

    this.#bindSliderDrag(startPoint, 'start');
    this.#bindSliderDrag(endPoint, 'end');
    this.#bindSliderDrag(tipStart, 'start');
    this.#bindSliderDrag(tipEnd, 'end');
  }

  #bindSliderDrag(handle, which) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const move = (ev) => {
        const rect = this.slider.getBoundingClientRect();
        if (!rect.width) return;
        let ratio = (ev.clientX - rect.left) / rect.width;
        ratio = Math.min(Math.max(ratio, 0), 1);
        const duration = this.app.duration();
        const value = Math.round(ratio * duration);
        if (which === 'start') {
          if (value < this.app.portion().end) this.app.setPortion('start', value);
        } else if (value > this.app.portion().start) {
          this.app.setPortion('end', value);
        }
        this.sliderDisplay();
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (this.app.session.getBool(SESSION_KEYS.loopInPortion)) {
          this.app.replaceUrlVar('start', formatTime(this.app.portion().start));
          this.app.replaceUrlVar('end', formatTime(this.app.portion().end));
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  #buildTips() {
    const tips = el('div', { id: 'loop-panel-tips-container' });
    tips.style.textAlign = 'center';
    if (this.app.optionPage && !this.app.inIncognito && !this.app.settings.hideInfo) {
      const space = el('div');
      space.style.height = '12px';
      tips.appendChild(space);
      const content = el('div');
      content.style.lineHeight = '16px';
      const link = el('a', { innerText: '** ' + this.app.i18n.t('information') });
      link.href = this.app.optionPage;
      link.target = '_blank';
      link.style.color = '#A9382E';
      const hide = el('a', { innerText: '(' + this.app.i18n.t('hide_info') + ')' });
      hide.style.color = '#999';
      hide.addEventListener('click', () => {
        this.app.settings.hideInfo = true;
        tips.style.display = 'none';
      });
      content.append(link, document.createTextNode('  '), hide);
      tips.appendChild(content);
    }
    return tips;
  }

  // --- runtime updates ------------------------------------------------------

  /** Keep the slider and inputs in sync with the current range. */
  sliderDisplay() {
    if (!this.slider || !this.sliderBar) return;
    const duration = this.app.duration() || 1;
    const { start, end } = this.app.portion();
    this.sliderBar.style.marginLeft = ((start / duration) * 100).toFixed(4) + '%';
    this.sliderBar.style.marginRight = ((1 - end / duration) * 100).toFixed(4) + '%';
    this.sliderBar.style.background = this.app.session.getBool(SESSION_KEYS.loopInPortion) ? '#cc181e' : '#757575';

    const checkbox = document.getElementById('loop-portion-checkbox');
    if (checkbox) checkbox.checked = this.app.session.getBool(SESSION_KEYS.loopInPortion);
    if (this.startInput) this.startInput.value = formatTime(start);
    if (this.endInput) this.endInput.value = formatTime(end);
    const sliderStart = document.getElementById('loop-slider-start-time-0');
    const sliderEnd = document.getElementById('loop-slider-end-time-0');
    if (sliderStart) sliderStart.value = formatTime(start);
    if (sliderEnd) sliderEnd.value = formatTime(end);
  }

  /** Full refresh, called on every loop tick / option change. */
  update() {
    if (!this.root) return;
    const { session } = this.app;

    const counter = document.getElementById('loop-counter');
    if (counter) counter.innerText = session.getNumber(SESSION_KEYS.loopCounter);
    const timerTime = document.getElementById('loop-timerTime');
    if (timerTime) timerTime.innerText = session.getNumber(SESSION_KEYS.loopTime);

    const countCheckbox = document.getElementById('loop-count-checkbox');
    if (countCheckbox) countCheckbox.checked = session.getBool(SESSION_KEYS.loopInCount);
    const countInput = document.getElementById('loop-count');
    if (countInput) countInput.value = session.getNumber(SESSION_KEYS.loopCount);

    const timerCheckbox = document.getElementById('loop-timer-checkbox');
    if (timerCheckbox) timerCheckbox.checked = session.getBool(SESSION_KEYS.loopInTimer);

    if (!this.app.hasPlaylist()) {
      const endPanel = document.getElementById('loop-panel-end-container');
      if (endPanel) endPanel.style.display = 'none';
    }
    this.sliderDisplay();
  }

  get visible() {
    return !!this.root && !this.root.classList.contains('hid');
  }

  show() {
    if (this.root) this.root.classList.remove('hid');
  }

  hide() {
    if (this.root) this.root.classList.add('hid');
  }
}
