// ============================================
// JP Barber | JP Dev Soluções Digitais
// js/auth.js — cadastro, login, logout e guard
// ============================================
// DEPENDE DE: supabase.js (carregado antes)
// ============================================

// ============================================
// 1. CADASTRO
// Cria o usuário no Supabase Auth +
// salva os dados da barbearia na tabela barbershops
// ============================================
async function cadastrarBarbearia(dados) {
  // dados = { email, password, name, slug, ownerName, whatsapp, planId }

  // Passo 1: criar usuário no Supabase Auth
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email: dados.email,
    password: dados.password
  });

  if (authError) {
    console.error('Erro no cadastro:', authError.message);
    return { ok: false, message: traduzirErro(authError.message) };
  }

  const userId = authData.user.id;

  // Passo 2: salvar dados da barbearia no banco
  const { error: dbError } = await supabaseClient
    .from('barbershops')
    .insert({
      user_id:    userId,
      plan_id:    dados.planId,
      name:       dados.name,
      slug:       dados.slug,
      owner_name: dados.ownerName,
      whatsapp:   dados.whatsapp
    });

  if (dbError) {
    console.error('Erro ao salvar barbearia:', dbError.message);
    return { ok: false, message: 'Conta criada, mas erro ao salvar dados. Contate o suporte.' };
  }

  console.log('✅ Barbearia cadastrada com sucesso!');
  return { ok: true };
}

// ============================================
// 2. LOGIN
// Autentica o usuário e redireciona para o painel
// ============================================
async function fazerLogin(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('Erro no login:', error.message);
    return { ok: false, message: traduzirErro(error.message) };
  }

  console.log('✅ Login realizado:', data.user.email);
  return { ok: true, user: data.user };
}

// ============================================
// 3. LOGOUT
// Encerra a sessão e redireciona para login
// ============================================
async function fazerLogout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error('Erro no logout:', error.message);
    return;
  }

  console.log('✅ Logout realizado.');
  window.location.href = '/public/login.html';
}

// ============================================
// 4. BUSCAR SESSÃO ATUAL
// Retorna o usuário logado ou null
// ============================================
async function getSessao() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.user : null;
}

// ============================================
// 5. BUSCAR DADOS DA BARBEARIA LOGADA
// Retorna os dados da tabela barbershops
// do usuário atualmente logado
// ============================================
async function getBarbearia() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  
  if (!sessionData.session) return null;

  const userId = sessionData.session.user.id;

  const { data, error } = await supabaseClient
    .from('barbershops')
    .select('*, plans(name, slug, has_whatsapp, has_multi_barber, has_reports)')
    .eq('user_id', userId)
    .maybeSingle(); // ← maybeSingle em vez de single (não quebra se não achar)

  if (error) {
    console.error('Erro ao buscar barbearia:', error.message);
    return null;
  }

  return data;
}

// ============================================
// 6. GUARD — proteção de páginas do painel
// Coloque no topo de cada página do /admin
// Se não estiver logado, redireciona para login
// ============================================
async function guardPagina() {
  const user = await getSessao();

  if (!user) {
    console.warn('Acesso negado — redirecionando para login.');
    window.location.href = '/public/login.html';
    return null;
  }

  return user;
}

// ============================================
// 7. GUARD SUPER ADMIN
// Só permite acesso se for o seu email de admin
// ============================================
async function guardSuperAdmin() {
  const user = await getSessao();
  const SUPER_ADMIN_EMAIL = 'joao081019pedrodasilv@gmail.com';

  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    console.warn('Acesso negado — não é super admin.');
    window.location.href = '/public/login.html';
    return null;
  }

  return user;
}

// ============================================
// 8. TRADUZIR ERROS DO SUPABASE
// O Supabase retorna erros em inglês.
// Esta função traduz os mais comuns.
// ============================================
function traduzirErro(msg) {
  const erros = {
    'Invalid login credentials':       'Email ou senha incorretos.',
    'Email not confirmed':             'Confirme seu email antes de entrar.',
    'User already registered':         'Este email já está cadastrado.',
    'Password should be at least 6':   'A senha deve ter pelo menos 6 caracteres.',
    'Unable to validate email':        'Email inválido.',
    'Email rate limit exceeded':       'Muitas tentativas. Aguarde alguns minutos.'
  };

  for (var chave in erros) {
    if (msg.includes(chave)) return erros[chave];
  }

  return 'Erro inesperado. Tente novamente.';
}