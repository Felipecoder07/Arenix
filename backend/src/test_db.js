const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, '../data/courtmanager.sqlite'));
db.all("SELECT id, data_reserva, hora_inicio, hora_fim, status, quadra_id FROM Reservas", (err, rows) => {
  if (err) console.error(err);
  console.log(JSON.stringify(rows, null, 2));
});
