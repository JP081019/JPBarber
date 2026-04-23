// ============================================
// JP Barber | JP Dev Soluções Digitais
// js/payment.js — integração Mercado Pago
// ============================================
// DEPENDE DE: supabase.js, auth.js
// ============================================

const EDGE_FUNCTION_URL = 'https://mjjwimqjrsqtogdmyxow.supabase.co/functions/v1/create-preference';

// ============================================
// 1. INICIAR PAGAMENTO
// Chama a Edge Function e redireciona para o MP
// ============================================
async function iniciarPagamento(planSlug) {
  const user      = await getSessao();
  const barbearia = await getBarbearia();

  if (!user || !barbearia) {
    alert('Você precisa estar logado para assinar um plano.');
    window.location.href = '../public/login.html';
    return;
  }

  // Mostrar loading
  const btn = document.getElementById('btn-' + planSlug);
  if (btn) {
    btn.disabled     = true;
    btn.textContent  = '⏳ Aguarde...';
  }

  try {
    // Chamar Edge Function
    const response = await fetch(EDGE_FUNCTION_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${(await supabaseClient.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        planSlug:       planSlug,
        barbershopId:   barbearia.id,
        barbershopEmail: user.email
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Erro ao criar preferência.');
    }

    // Redirecionar para o Mercado Pago
    console.log('✅ Preferência criada. Redirecionando para pagamento...');
    window.location.href = data.initPoint;

  } catch (err) {
    console.error('Erro no pagamento:', err.message);
    alert('Erro ao iniciar pagamento. Tente novamente.');

    if (btn) {
      btn.disabled    = false;
      btn.textContent = 'Assinar plano';
    }
  }
}

// ============================================
// 2. VERIFICAR RETORNO DO PAGAMENTO
// Chamada quando o usuário volta do MP
// Lê os parâmetros da URL e exibe feedback
// ============================================
function verificarRetornoPagamento() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('payment');

  if (!status) return;

  // Limpar parâmetros da URL sem recarregar a página
  window.history.replaceState({}, document.title, window.location.pathname);

  if (status === 'success') {
    mostrarAlertaPagamento(
      'success',
      '🎉 Pagamento aprovado! Seu plano já está ativo.'
    );
    // Recarregar dados da barbearia para refletir novo plano
    setTimeout(async function() {
      window.BARBEARIA = await getBarbearia();
      await renderEstatisticas();
      await renderAlertaPlano();
    }, 1500);
  }

  if (status === 'failure') {
    mostrarAlertaPagamento(
      'danger',
      '❌ Pagamento não aprovado. Tente novamente ou use outro método.'
    );
  }

  if (status === 'pending') {
    mostrarAlertaPagamento(
      'warning',
      '⏳ Pagamento em análise. Assim que aprovado, seu plano será ativado automaticamente.'
    );
  }
}

// ============================================
// 3. MOSTRAR ALERTA DE PAGAMENTO
// ============================================
function mostrarAlertaPagamento(tipo, mensagem) {
  const container = document.getElementById('alertaPlano');
  if (!container) return;

  container.innerHTML = `
    <div class="alert alert-${tipo}" style="margin-bottom:20px;">
      ${mensagem}
    </div>`;

  // Remover após 8 segundos
  setTimeout(function() {
    container.innerHTML = '';
  }, 8000);
}

// ============================================
// 4. VERIFICAR STATUS DO PLANO
// Verifica se o plano está ativo ou vencido
// Exibe alerta no dashboard se vencido
// ============================================
async function verificarStatusPlano() {
  const barbearia = window.BARBEARIA;
  if (!barbearia) return;

  const expiracao = barbearia.plan_expires_at;

  // Se não tem data de expiração, plano não foi ativado ainda
  if (!expiracao) {
    mostrarAlertaPagamento(
      'warning',
      '⚠️ Você ainda não tem um plano ativo. <a href="../public/planos.html" style="font-weight:700;">Escolher plano →</a>'
    );
    return;
  }

  const agora    = new Date();
  const vencimento = new Date(expiracao);
  const diasRestantes = Math.ceil((vencimento - agora) / (1000 * 60 * 60 * 24));

  if (diasRestantes <= 0) {
    mostrarAlertaPagamento(
      'danger',
      '🔴 Seu plano venceu. Renove agora para continuar recebendo agendamentos. <a href="../public/planos.html" style="font-weight:700;">Renovar →</a>'
    );
    return;
  }

  if (diasRestantes <= 5) {
    mostrarAlertaPagamento(
      'warning',
      `⚠️ Seu plano vence em <strong>${diasRestantes} dias</strong>. <a href="../public/planos.html" style="font-weight:700;">Renovar agora →</a>`
    );
  }
}

// ============================================
// 5. FORMATAR PLANO ATUAL
// Exibe informações do plano no dashboard
// ============================================
function formatarPlanoAtual(barbearia) {
  if (!barbearia.plans) return 'Sem plano ativo';

  const nome       = barbearia.plans.name;
  const expiracao  = barbearia.plan_expires_at;

  if (!expiracao) return nome + ' (pendente)';

  const vencimento    = new Date(expiracao);
  const diasRestantes = Math.ceil((vencimento - new Date()) / (1000 * 60 * 60 * 24));

  if (diasRestantes <= 0) return nome + ' (vencido)';

  return nome + ' · ' + diasRestantes + ' dias restantes';
}