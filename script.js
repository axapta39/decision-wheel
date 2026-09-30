'use strict';

const MAX_OPTIONS = 20;
const STORAGE_KEY = 'decision-wheel-options';
const SPIN_DURATION_MS = 3500;
const RADIUS = 96;
const COLORS = [
  '#e76f51', '#2a9d8f', '#e9c46a', '#8e6bbf',
  '#f4a261', '#3a86c8', '#6aa84f', '#d1497b',
];

const form = document.getElementById('add-form');
const input = document.getElementById('option-input');
const addButton = document.getElementById('add-button');
const hint = document.getElementById('hint');
const list = document.getElementById('option-list');
const wheel = document.getElementById('wheel');
const spinButton = document.getElementById('spin-button');
const result = document.getElementById('result');

const SVG_NS = 'http://www.w3.org/2000/svg';

let options = loadOptions();
let rotation = 0;
let isSpinning = false;

// ---------- Сохранение в браузере ----------

function loadOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      return saved.filter((item) => typeof item === 'string').slice(0, MAX_OPTIONS);
    }
  } catch (error) {
    // Хранилище недоступно или данные испорчены — начинаем с пустого списка
  }
  return [];
}

function saveOptions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch (error) {
    // Не получилось сохранить — сайт продолжит работать без запоминания
  }
}

// ---------- Цвета секторов ----------

// Соседние секторы не должны совпадать по цвету, включая последний и первый
function colorFor(index, total) {
  const color = index % COLORS.length;
  if (total > 1 && index === total - 1 && color === 0) {
    return COLORS[1];
  }
  return COLORS[color];
}

// ---------- Отрисовка ----------

function render() {
  renderList();
  renderWheel();
  updateControls();
}

function renderList() {
  list.textContent = '';
  options.forEach((text, index) => {
    const item = document.createElement('li');
    item.className = 'option-item';

    const color = document.createElement('span');
    color.className = 'option-color';
    color.style.background = colorFor(index, options.length);

    const label = document.createElement('span');
    label.className = 'option-text';
    label.textContent = text;

    const remove = document.createElement('button');
    remove.className = 'remove-button';
    remove.type = 'button';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', 'Удалить «' + text + '»');
    remove.addEventListener('click', () => removeOption(index));

    item.append(color, label, remove);
    list.append(item);
  });
}

function svgElement(name, attributes) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

// Точка на окружности; угол считается по часовой стрелке от верха
function pointAt(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return [radius * Math.sin(rad), -radius * Math.cos(rad)];
}

// Подпись должна уместиться между центральным кружком и краем колеса
function shorten(text, fontSize) {
  const maxChars = Math.floor((RADIUS - 22) / (fontSize * 0.62));
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

function fontSizeFor(total) {
  if (total <= 6) return 11;
  if (total <= 10) return 9;
  if (total <= 15) return 7.5;
  return 6.5;
}

function renderWheel() {
  wheel.textContent = '';
  const total = options.length;

  if (total === 0) {
    wheel.append(svgElement('circle', { r: RADIUS, fill: '#e4e1da' }));
    const empty = svgElement('text', {
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': 10,
      fill: '#6b6b6b',
    });
    empty.textContent = 'Добавьте варианты';
    wheel.append(empty);
    return;
  }

  const sector = 360 / total;
  const fontSize = fontSizeFor(total);

  options.forEach((text, index) => {
    const color = colorFor(index, total);
    const start = index * sector;
    const end = start + sector;

    if (total === 1) {
      wheel.append(svgElement('circle', { r: RADIUS, fill: color }));
    } else {
      const [x1, y1] = pointAt(start, RADIUS);
      const [x2, y2] = pointAt(end, RADIUS);
      const largeArc = sector > 180 ? 1 : 0;
      wheel.append(svgElement('path', {
        d: `M0 0 L${x1} ${y1} A${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        fill: color,
        stroke: '#ffffff',
        'stroke-width': 1,
      }));
    }

    // Подпись идёт от центра к краю по середине сектора
    const middle = start + sector / 2;
    const label = svgElement('text', {
      x: RADIUS - 8,
      y: 0,
      'text-anchor': 'end',
      'dominant-baseline': 'middle',
      'font-size': fontSize,
      'font-weight': 600,
      fill: '#ffffff',
      transform: `rotate(${middle - 90})`,
    });
    label.textContent = shorten(text, fontSize);
    wheel.append(label);
  });

  wheel.append(svgElement('circle', { r: RADIUS, fill: 'none', stroke: '#333333', 'stroke-width': 2 }));
  wheel.append(svgElement('circle', { r: 7, fill: '#333333' }));
}

function updateControls() {
  const isFull = options.length >= MAX_OPTIONS;

  input.disabled = isSpinning || isFull;
  addButton.disabled = isSpinning || isFull;
  spinButton.disabled = isSpinning || options.length < 2;
  list.querySelectorAll('.remove-button').forEach((button) => {
    button.disabled = isSpinning;
  });

  if (isFull) {
    hint.textContent = 'Больше ' + MAX_OPTIONS + ' вариантов добавить нельзя';
  } else if (options.length < 2) {
    hint.textContent = 'Добавьте хотя бы два варианта, чтобы крутить колесо';
  } else {
    hint.textContent = '';
  }
}

// ---------- Действия ----------

function addOption(text) {
  const value = text.trim();
  if (!value || options.length >= MAX_OPTIONS || isSpinning) return;
  options.push(value);
  saveOptions();
  result.textContent = '';
  render();
}

function removeOption(index) {
  if (isSpinning) return;
  options.splice(index, 1);
  saveOptions();
  result.textContent = '';
  render();
}

function randomIndex(max) {
  if (window.crypto && window.crypto.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function spin() {
  if (isSpinning || options.length < 2) return;

  const total = options.length;
  const sector = 360 / total;
  const winner = randomIndex(total);

  // Случайная точка внутри сектора победителя, не у самой границы
  const target = winner * sector + sector * (0.15 + Math.random() * 0.7);

  // Колесо повернётся так, чтобы эта точка оказалась под стрелкой сверху,
  // плюс 5–6 полных оборотов для эффектности
  const turns = 5 + randomIndex(2);
  const current = rotation % 360;
  let delta = (360 - target - current) % 360;
  if (delta < 0) delta += 360;
  rotation += turns * 360 + delta;

  isSpinning = true;
  result.textContent = '';
  updateControls();

  wheel.classList.add('is-spinning');
  wheel.style.transform = `rotate(${rotation}deg)`;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    wheel.removeEventListener('transitionend', finish);

    // Убираем лишние обороты без анимации, чтобы число не росло бесконечно
    wheel.classList.remove('is-spinning');
    rotation %= 360;
    wheel.style.transform = `rotate(${rotation}deg)`;

    isSpinning = false;
    showResult(options[winner]);
    updateControls();
  };

  wheel.addEventListener('transitionend', finish);
  // Запасной вариант, если браузер не сообщит об окончании анимации
  setTimeout(finish, SPIN_DURATION_MS + 500);
}

function showResult(text) {
  result.textContent = '';
  const label = document.createElement('div');
  label.className = 'result-label';
  label.textContent = 'Выпало:';
  const value = document.createElement('div');
  value.className = 'result-value';
  value.textContent = text;
  result.append(label, value);
}

// ---------- Обработчики ----------

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addOption(input.value);
  input.value = '';
  input.focus();
});

spinButton.addEventListener('click', spin);

render();
