const logger = require('../utils/safeLogger').forModule('authController');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

const { issueSession, logout: endSession } = require('../services/sessionService');
const { passwordError, frontendUrl } = require('../utils/security');
const { createChallenge, resetWithChallenge } = require('../services/recoveryService');
const login = async (req,res) => {
  try {
    await require('../config/securitySchema').ensureSecuritySchema(db);
    const {email,senha}=req.body;
    if(typeof email!=='string'||typeof senha!=='string'||email.length>254||Buffer.byteLength(senha,'utf8')>72) return res.status(400).json({error:'Credenciais invalidas.'});
    const user=await db.getAsync('SELECT u.id, u.nome, u.email, u.senha_hash, u.perfil, u.ativo, u.activation_pending, u.tenant_id, u.two_factor_secret, a.nome AS arena_nome, a.slug AS arena_slug, a.status AS arena_status FROM Usuarios u LEFT JOIN Arenas a ON a.id=u.tenant_id WHERE LOWER(u.email)=?',[email.trim().toLowerCase()]);
    if(!user||!await bcrypt.compare(senha,user.senha_hash)) return res.status(401).json({error:'E-mail ou senha invalidos.'});
    if(user.ativo!==1||user.activation_pending||user.arena_status===-1) return res.status(403).json({error:'Conta indisponivel.'});
    if(user.perfil==='Cliente'&&user.tenant_id) await require('../services/clientAccessService').membership(user,user.tenant_id,true);
    await issueSession(user,req,res);
    logAuditEvent(user.id,'Login', 'Sessao iniciada',req.ip);
    res.json({usuario:{id:user.id,nome:user.nome,email:user.email,perfil:user.perfil,tenant_id:user.tenant_id,arena_nome:user.arena_nome,arena_slug:user.arena_slug,arena_status:user.arena_status}});
  } catch(e){ res.status(e.status||500).json({error: require('../utils/security').publicError(e, 'Erro ao iniciar sessao.')}); }
};
const logout=async(req,res)=>{ await endSession(req,res); res.json({message:'Sessao encerrada.'}); };

async function resolvePlanoId(planoReq) {
  if (!planoReq) return 1;
  const parsedId = Number.parseInt(planoReq, 10);
  if (!Number.isNaN(parsedId)) {
    const planoRow = await db.getAsync('SELECT id FROM PlanosSaaS WHERE id = ?', [parsedId]);
    if (planoRow) return planoRow.id;
  }
  if (typeof planoReq === 'string') {
    let searchName = planoReq.toLowerCase();
    if (searchName === 'starter') searchName = 'basic';
    const planoRow = await db.getAsync('SELECT id FROM PlanosSaaS WHERE LOWER(nome) = ?', [searchName]);
    if (planoRow) return planoRow.id;
  }
  return 1;
}

async function handleRegisterCliente({nome,email,senha_hash,res}) {
  const result=await db.runAsync("INSERT INTO Usuarios(nome,email,senha_hash,perfil) VALUES(?,?,?,'Cliente')",[nome,email.trim().toLowerCase(),senha_hash]);
  res.status(201).json({message:'Cadastro realizado.',id:result.lastID});
}

async function handleRegisterAdministrador({ req, res, nome, email, senha_hash, arena_nome, telefone, arena_cidade, ip }) {
  const cadastro = await require('../services/arenaRegistrationService').cadastrarArena({
    nome: arena_nome || 'Arena de ' + nome, adminNome: nome, email, senhaHash: senha_hash,
    telefone, endereco: arena_cidade, planoId: await resolvePlanoId(req.body.plano || req.body.plano_id)
  });
  logAuditEvent(cadastro.usuarioId, 'Cadastro Administrador', 'Arena ID: ' + cadastro.tenantId, ip);
  res.status(201).json({ message: 'Cadastro de arena realizado com sucesso!' });
}

const register = async (req, res) => {
  const { nome, email, senha, perfil, arena_nome, telefone, arena_cidade } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.ip;

  if (!nome || !email || !senha || !perfil) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  if (perfil !== 'Cliente' && perfil !== 'Administrador') {
    return res.status(400).json({ error: 'Perfil inválido para cadastro.' });
  }

  if (passwordError(senha)) return res.status(400).json({error:passwordError(senha)});
  try {
    const senha_hash = await bcrypt.hash(senha, 12);

    if (perfil === 'Cliente') {
      return await handleRegisterCliente({ nome, email, senha_hash, perfil, ip, res });
    }
    return await handleRegisterAdministrador({ req, res, nome, email, senha_hash, perfil, arena_nome, telefone, arena_cidade, ip });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: require('../utils/security').publicError(error) });
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'E-mail ja cadastrado.' });
    res.status(500).json({ error: 'Erro interno durante o cadastro.' });
  }
};

const forgotPassword=async(req,res)=>{
  try {
    await require('../config/securitySchema').ensureSecuritySchema(db);
    const email=typeof req.body.email==='string'?req.body.email.trim().toLowerCase():'';
    if(!email||email.length>254) return res.status(400).json({error:'E-mail invalido.'});
    const user=await db.getAsync('SELECT id,email,perfil,activation_pending FROM Usuarios WHERE LOWER(email)=?',[email]);
    if(user){
      const code=await createChallenge(user.id,user.activation_pending ? 'activation' : 'password');
      const link=frontendUrl()+'/redefinir-senha?token='+encodeURIComponent(code)+(user.perfil==='SuperAdmin'?'&master=1':'');
      void require('../services/emailService').sendEmail(user.email,'Recuperacao de senha','Acesse para redefinir sua senha: '+link).catch(() => logger.error('Falha de entrega de recuperação.'));
    }
    res.json({message:'Se o e-mail estiver cadastrado, enviamos as instrucoes de recuperacao.'});
  }catch(e){res.status(e.status||500).json({error:'Nao foi possivel processar a recuperacao.'});}
};
const resetPassword=async(req,res)=>{
  try{
    await require('../config/securitySchema').ensureSecuritySchema(db);
    const token = req.body.token;
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(400).json({error:'Token invalido ou expirado.'});
    const challenge = await db.getAsync("SELECT usuario_id,purpose FROM RecoveryChallenges WHERE token_hash=? AND used=0 AND attempts<5 AND expires>? AND purpose IN ('password','activation')", [require('../utils/security').hash(token), Date.now()]);
    await resetWithChallenge(challenge?.usuario_id ?? -1,challenge?.purpose || 'password',token,req.body.novaSenha);
    res.json({message:'Senha redefinida. Faca login novamente.'});
  }catch(e){res.status(e.status||500).json({error: require('../utils/security').publicError(e, 'Erro ao redefinir senha.')});}
};

module.exports = { login, logout, register, forgotPassword, resetPassword };
