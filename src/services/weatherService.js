const axios = require("axios");
const logger = require("../utils/logger");

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || null;

async function getWeather(city) {
  try {
    if (WEATHER_API_KEY) {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`;
      const resp = await axios.get(url, { timeout: 10000 });
      const d = resp.data;
      return {
        city: d.name,
        country: d.sys.country,
        temp: d.main.temp,
        feelsLike: d.main.feels_like,
        description: d.weather[0].description,
        humidity: d.main.humidity,
        wind: d.wind.speed,
        icon: d.weather[0].icon,
      };
    }
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    const resp = await axios.get(url, { timeout: 10000 });
    const d = resp.data;
    const curr = d.current_condition[0];
    return {
      city: d.nearest_area[0].areaName[0].value,
      country: d.nearest_area[0].country[0].value,
      temp: parseFloat(curr.temp_C),
      feelsLike: parseFloat(curr.FeelsLikeC),
      description: curr.weatherDesc[0].value,
      humidity: parseInt(curr.humidity, 10),
      wind: parseFloat(curr.windspeedKmph),
      icon: null,
    };
  } catch (err) {
    logger.error(`Weather API error for "${city}": ${err.message}`);
    return null;
  }
}

function formatWeather(w) {
  return (
    `🌤 *Weather in ${w.city}, ${w.country}*\n` +
    `🌡 Temperature: ${w.temp}°C (feels like ${w.feelsLike}°C)\n` +
    `☁ ${w.description}\n` +
    `💧 Humidity: ${w.humidity}%\n` +
    `💨 Wind: ${w.wind} km/h`
  );
}

module.exports = { getWeather, formatWeather };
