const db = require('./src/config/database');
setTimeout(async () => {
  const arenas = await db.allAsync(`
    SELECT id, nome, 
      CASE WHEN gateway_access_token IS NOT NULL AND gateway_access_token != '' 
        THEN substr(gateway_access_token, 1, 25) || '...' 
        ELSE 'SEM TOKEN' 
      END as token_preview
    FROM Arenas
  `);
  console.log(JSON.stringify(arenas, null, 2));
  process.exit(0);
}, 600);
