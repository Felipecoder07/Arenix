/**
 * Utilitário unificado de data e hora com suporte a fuso horário local (padrão America/Sao_Paulo).
 * Garante precisão de fuso horário em qualquer servidor local ou nuvem (AWS, Docker, Vercel, Railway).
 */

const getTodayString = (timeZone = process.env.APP_TIMEZONE || 'America/Sao_Paulo') => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date()); // Retorna "YYYY-MM-DD"
};

const getLocalTimeString = (timeZone = process.env.APP_TIMEZONE || 'America/Sao_Paulo') => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(new Date()); // Retorna "HH:MM"
};

module.exports = {
  getTodayString,
  getLocalTimeString
};
