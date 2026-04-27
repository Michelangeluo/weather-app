const cityInput      = document.getElementById('cityInput');
const searchBtn      = document.getElementById('searchBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMsg       = document.getElementById('errorMsg');
const resultSection  = document.getElementById('resultSection');
const cityName       = document.getElementById('cityName');
const weatherIcon    = document.getElementById('weatherIcon');
const tempDisplay    = document.getElementById('tempDisplay');
const weatherDesc    = document.getElementById('weatherDesc');
const humidity       = document.getElementById('humidity');
const windSpeed      = document.getElementById('windSpeed');

const THEMES = {
  Clear:        { cls: 'theme-clear',   icon: '☀️'  },
  Clouds:       { cls: 'theme-clouds',  icon: '⛅'  },
  Rain:         { cls: 'theme-rain',    icon: '🌧️'  },
  Drizzle:      { cls: 'theme-rain',    icon: '🌧️'  },
  Snow:         { cls: 'theme-snow',    icon: '❄️'  },
  Thunderstorm: { cls: 'theme-thunder', icon: '⛈️'  },
};

const weatherCard = document.querySelector('.weather-card');

function applyWeatherTheme(condition) {
  weatherCard.classList.remove('theme-clear', 'theme-clouds', 'theme-rain', 'theme-snow', 'theme-thunder');
  const theme = THEMES[condition];
  if (theme) {
    weatherCard.classList.add(theme.cls);
    weatherIcon.textContent = theme.icon;
  } else {
    weatherIcon.textContent = '🌡️';
  }
}

function showLoading() {
  loadingSpinner.classList.remove('hidden');
  errorMsg.classList.add('hidden');
  resultSection.classList.add('hidden');
}

function showError(msg) {
  loadingSpinner.classList.add('hidden');
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function showResult(data) {
  loadingSpinner.classList.add('hidden');
  cityName.textContent    = `${data.name}, ${data.sys.country}`;
  tempDisplay.textContent = `${Math.round(data.main.temp)}°C`;
  weatherDesc.textContent = data.weather[0].description;
  humidity.textContent    = `${data.main.humidity}%`;
  windSpeed.textContent   = `${data.wind.speed} m/s`;
  applyWeatherTheme(data.weather[0].main);
  resultSection.classList.remove('hidden');
}

async function searchWeather() {
  const city = cityInput.value.trim();
  if (!city) return;

  showLoading();

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${CONFIG.API_KEY}&units=metric&lang=zh_cn`;
    const res  = await fetch(url);

    if (res.status === 404) {
      showError('找不到该城市，请检查拼写');
      return;
    }
    if (res.status === 401) {
      showError('API Key 无效，请检查 config.js');
      return;
    }
    if (!res.ok) {
      showError('请求失败，请稍后重试');
      return;
    }

    showResult(await res.json());
  } catch {
    showError('网络错误，请检查连接后重试');
  }
}

searchBtn.addEventListener('click', searchWeather);
cityInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') searchWeather();
});
