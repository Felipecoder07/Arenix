require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Trust proxy é necessário se a API estiver atrás de um Load Balancer (Render, Heroku, etc.)
// Isso garante que o express-rate-limit bloqueie o IP real (RNF-009)
app.set('trust proxy', 1);

// Servir arquivos estáticos do frontend (Landing Page, Login, Dashboard)
app.use(express.static(path.join(__dirname, '../../frontend')));

// Rotas API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/reservas', require('./routes/reservasRoutes'));
app.use('/api/quadras', require('./routes/quadrasRoutes'));
app.use('/api/pagamentos', require('./routes/pagamentosRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/clientes', require('./routes/clientesRoutes'));
app.use('/api/saas', require('./routes/saasRoutes'));
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CourtManager API rodando com sucesso.' });
});

module.exports = app;
