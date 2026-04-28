const cityInput      = document.getElementById('cityInput');
const searchBtn      = document.getElementById('searchBtn');
const navCity        = document.getElementById('navCity');
const weatherIcon    = document.getElementById('weatherIcon');
const tempDisplay    = document.getElementById('tempDisplay');
const weatherDesc    = document.getElementById('weatherDesc');
const feelsLike      = document.getElementById('feelsLike');
const dateBar        = document.getElementById('dateBar');
const hourlyScroll   = document.getElementById('hourlyScroll');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorToast     = document.getElementById('errorToast');

const THEMES = {
  Clear:        { icon: '☀️'  },
  Clouds:       { icon: '⛅'  },
  Rain:         { icon: '🌧️'  },
  Drizzle:      { icon: '🌦️'  },
  Snow:         { icon: '❄️'  },
  Thunderstorm: { icon: '⛈️'  },
  Mist:         { icon: '🌫️'  },
  Fog:          { icon: '🌫️'  },
  Haze:         { icon: '🌫️'  },
};

const DAY_NAMES = ['周日','周一','周二','周三','周四','周五','周六'];

const BG_MAP = {
  'Clear-day':    'bg-clear-day',
  'Clear-night':  'bg-clear-night',
  'Clouds-day':   'bg-clouds-day',
  'Clouds-night': 'bg-clouds-night',
  'Rain':         'bg-rain',
  'Drizzle':      'bg-rain',
  'Snow':         'bg-snow',
  'Thunderstorm': 'bg-thunder',
  'Mist':         'bg-mist',
  'Fog':          'bg-mist',
  'Haze':         'bg-mist',
};

const ALL_BG = ['bg-clear-day','bg-clear-night','bg-clouds-day','bg-clouds-night',
                'bg-rain','bg-snow','bg-thunder','bg-mist'];

let currentUnit    = 'C';
let rawWeatherData  = null;
let rawForecastData = null;
let selectedDate   = null;
let chartInstance  = null;
let errorTimer     = null;

/* ── Helpers ── */

function toDisplay(c) {
  return currentUnit === 'C' ? Math.round(c) : Math.round(c * 9 / 5 + 32);
}

function unitLabel() { return currentUnit === 'C' ? '°C' : '°F'; }

function calcDewPoint(tempC, rh) {
  return Math.round(tempC - ((100 - rh) / 5));
}

function isDay(dt, sunrise, sunset) { return dt >= sunrise && dt <= sunset; }

function toLocalDateStr(unixSec, tzOffsetSec) {
  return new Date((unixSec + tzOffsetSec) * 1000).toISOString().slice(0, 10);
}

function toLocalHour(unixSec, tzOffsetSec) {
  return new Date((unixSec + tzOffsetSec) * 1000).getUTCHours();
}

/* ── Background ── */

function applyBackground(condition, dt, sunrise, sunset) {
  const timeKey = isDay(dt, sunrise, sunset) ? 'day' : 'night';
  const bg = BG_MAP[`${condition}-${timeKey}`] ?? BG_MAP[condition] ?? 'bg-clear-day';
  document.body.classList.remove(...ALL_BG);
  document.body.classList.add(bg);
}

/* ── Render Functions ── */

function renderNavCity(data) {
  navCity.textContent = `${data.name}, ${data.sys.country}`;
}

function renderCurrentCard(data) {
  const cond = data.weather[0].main;
  weatherIcon.textContent = THEMES[cond]?.icon ?? '🌡️';
  tempDisplay.textContent = `${toDisplay(data.main.temp)}${unitLabel()}`;
  weatherDesc.textContent = data.weather[0].description;
  feelsLike.textContent   = `体感温度 ${toDisplay(data.main.feels_like)}${unitLabel()}`;
}

function renderStats(data) {
  const vis = data.visibility != null
    ? (data.visibility >= 1000
        ? `${(data.visibility / 1000).toFixed(1)} km`
        : `${data.visibility} m`)
    : '—';
  const dewC = calcDewPoint(data.main.temp, data.main.humidity);

  document.getElementById('statWind').textContent       = `${data.wind.speed} m/s`;
  document.getElementById('statHumidity').textContent   = `${data.main.humidity}%`;
  document.getElementById('statVisibility').textContent = vis;
  document.getElementById('statPressure').textContent   = `${data.main.pressure} hPa`;
  document.getElementById('statUV').textContent         = '—';
  document.getElementById('statDew').textContent        = `${toDisplay(dewC)}${unitLabel()}`;
}

/* ── Forecast / Date Bar ── */

function buildForecast(data) {
  const tz = data.city.timezone;
  const todayStr = toLocalDateStr(Math.floor(Date.now() / 1000), tz);
  const groups = {};
  for (const item of data.list) {
    const d = toLocalDateStr(item.dt, tz);
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
  }
  return Object.entries(groups).slice(0, 5).map(([date, items]) => {
    const noon = items.reduce((best, item) => {
      const hB = toLocalHour(best.dt, tz);
      const hI = toLocalHour(item.dt, tz);
      return Math.abs(hI - 12) < Math.abs(hB - 12) ? item : best;
    });
    return {
      date,
      isToday: date === todayStr,
      icon: THEMES[noon.weather[0].main]?.icon ?? '🌡️',
    };
  });
}

function renderDateBar(forecastData) {
  const days = buildForecast(forecastData);
  dateBar.innerHTML = days.map(day => {
    const d        = new Date(day.date + 'T12:00:00Z');
    const dayLabel = day.isToday ? '今天' : DAY_NAMES[d.getUTCDay()];
    const datePart = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    return `<div class="date-item${day.isToday ? ' active' : ''}" data-date="${day.date}">
      <span class="date-item-day">${dayLabel}</span>
      <span class="date-item-date">${datePart}</span>
    </div>`;
  }).join('');

  dateBar.querySelectorAll('.date-item').forEach(el => {
    el.addEventListener('click', () => {
      dateBar.querySelectorAll('.date-item').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      selectedDate = el.dataset.date;
      renderHourlyView(selectedDate);
    });
  });
}

/* ── Hourly Data ── */

function getHourlyForDate(list, dateStr, tz) {
  return list.filter(item => toLocalDateStr(item.dt, tz) === dateStr);
}

function renderChart(hourlyItems, tz) {
  const canvas = document.getElementById('hourlyChart');
  if (!canvas) return;
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (!hourlyItems.length) return;

  const labels = hourlyItems.map(item =>
    `${String(toLocalHour(item.dt, tz)).padStart(2, '0')}:00`
  );
  const temps  = hourlyItems.map(item => toDisplay(item.main.temp));
  const precip = hourlyItems.map(item =>
    (item.rain?.['3h'] ?? item.snow?.['3h'] ?? 0)
  );

  chartInstance = new Chart(canvas, {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: '温度',
          data: temps,
          borderColor: 'rgba(255, 200, 80, 0.9)',
          backgroundColor: 'rgba(255, 200, 80, 0.10)',
          fill: true,
          tension: 0.4,
          yAxisID: 'yTemp',
          pointBackgroundColor: 'rgba(255, 200, 80, 1)',
          pointRadius: 4,
          borderWidth: 2,
        },
        {
          type: 'bar',
          label: '降水(mm)',
          data: precip,
          backgroundColor: 'rgba(100, 160, 255, 0.45)',
          borderColor: 'rgba(100, 160, 255, 0.75)',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'yRain',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.65)',
          titleColor: 'rgba(255,255,255,0.9)',
          bodyColor: 'rgba(255,255,255,0.75)',
          callbacks: {
            label: ctx => ctx.dataset.label === '温度'
              ? ` ${ctx.parsed.y}${unitLabel()}`
              : ` ${ctx.parsed.y} mm`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.60)', font: { size: 11 } },
          grid:  { color: 'rgba(255,255,255,0.07)' },
        },
        yTemp: {
          position: 'left',
          ticks: {
            color: 'rgba(255,200,80,0.80)',
            font:  { size: 11 },
            callback: v => `${v}${unitLabel()}`,
          },
          grid: { color: 'rgba(255,255,255,0.08)' },
        },
        yRain: {
          position: 'right',
          min: 0,
          ticks: {
            color: 'rgba(100,160,255,0.70)',
            font:  { size: 11 },
            callback: v => `${v}mm`,
          },
          grid: { display: false },
        },
      },
    },
  });
}

function renderHourlyCards(hourlyItems, tz) {
  hourlyScroll.innerHTML = hourlyItems.map(item => {
    const h    = toLocalHour(item.dt, tz);
    const time = `${String(h).padStart(2, '0')}:00`;
    const icon = THEMES[item.weather[0].main]?.icon ?? '🌡️';
    return `<div class="hourly-item">
      <span class="hourly-time">${time}</span>
      <span class="hourly-icon">${icon}</span>
      <span class="hourly-temp">${toDisplay(item.main.temp)}${unitLabel()}</span>
    </div>`;
  }).join('');
}

function renderHourlyView(dateStr) {
  if (!rawForecastData) return;
  const tz    = rawForecastData.city.timezone;
  const hours = getHourlyForDate(rawForecastData.list, dateStr, tz);
  renderChart(hours, tz);
  renderHourlyCards(hours, tz);
}

/* ── Loading / Error ── */

function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

function showError(msg) {
  clearTimeout(errorTimer);
  errorToast.textContent = msg;
  errorToast.classList.remove('hidden');
  errorTimer = setTimeout(() => errorToast.classList.add('hidden'), 4000);
}

/* ── Unit Toggle ── */

function toggleUnit(unit) {
  currentUnit = unit;
  document.getElementById('unitC').classList.toggle('active', unit === 'C');
  document.getElementById('unitF').classList.toggle('active', unit === 'F');
  if (rawWeatherData) {
    renderCurrentCard(rawWeatherData);
    renderStats(rawWeatherData);
  }
  if (rawForecastData && selectedDate) {
    renderHourlyView(selectedDate);
  }
}

/* ── Search ── */

async function searchWeather(defaultCity) {
  const city = defaultCity ?? cityInput.value.trim();
  if (!city) return;

  showLoading();

  const q   = encodeURIComponent(city);
  const key = '7cd841604f9df7e5325161bbcdf8bffb';
  const wUrl = `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${key}&units=metric&lang=zh_cn`;
  const fUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${q}&appid=${key}&units=metric&lang=zh_cn`;

  try {
    const [wRes, fRes] = await Promise.all([fetch(wUrl), fetch(fUrl)]);

    if (wRes.status === 404) { hideLoading(); showError('找不到该城市，请检查拼写'); return; }
    if (wRes.status === 401) { hideLoading(); showError('API Key 无效'); return; }
    if (!wRes.ok)            { hideLoading(); showError('请求失败，请稍后重试'); return; }

    rawWeatherData  = await wRes.json();
    rawForecastData = fRes.ok ? await fRes.json() : null;

    const tz = rawForecastData?.city.timezone ?? rawWeatherData.timezone ?? 0;
    selectedDate = toLocalDateStr(Math.floor(Date.now() / 1000), tz);

    applyBackground(
      rawWeatherData.weather[0].main,
      rawWeatherData.dt,
      rawWeatherData.sys.sunrise,
      rawWeatherData.sys.sunset
    );
    renderNavCity(rawWeatherData);
    renderCurrentCard(rawWeatherData);
    renderStats(rawWeatherData);

    if (rawForecastData) {
      renderDateBar(rawForecastData);
      renderHourlyView(selectedDate);
    }

    hideLoading();
  } catch {
    hideLoading();
    showError('网络错误，请检查连接后重试');
  }
}

searchBtn.addEventListener('click', searchWeather);
cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchWeather(); });

searchWeather('Beijing');
