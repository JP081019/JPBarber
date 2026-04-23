// ============================================
// JP Barber | JP Dev Soluções Digitais
// js/dashboard.js — painel da barbearia
// ============================================
// DEPENDE DE: supabase.js, auth.js,
//             barbershop.js, booking.js,
//             services.js
// ============================================

// ============================================
// 1. INICIALIZAR DASHBOARD
// Ponto de entrada — chamado quando a página carrega
// Verifica sessão, busca dados e renderiza tudo
// ============================================
async function initDashboard() {
  const user = await guardPagina();
  if (!user) return;

  const barbearia = await getBarbearia();

  if (!barbearia) {
    // Usuário logado mas sem barbearia cadastrada ainda
    document.getElementById('userName').textContent = user.email;
    showToast('⚠️ Nenhuma barbearia encontrada para este usuário.', 'erro');
    console.warn('Barbearia não encontrada para user_id:', user.id);
    return;
  }

  window.BARBEARIA = barbearia;

  const elNome = document.getElementById('userName');
  if (elNome) elNome.textContent = barbearia.owner_name;

  const elBarbearia = document.getElementById('barbershopName');
  if (elBarbearia) elBarbearia.textContent = barbearia.name;

  await renderEstatisticas();
  await renderAgendamentosHoje();
  await renderProximosAgendamentos();
  await renderAlertaPlano();

  console.log('✅ Dashboard carregado para:', barbearia.name);

  verificarRetornoPagamento();
  await verificarStatusPlano();
}

// ============================================
// 2. RENDERIZAR ESTATÍSTICAS
// Preenche os cards de totais no topo do painel
// ============================================
async function renderEstatisticas() {
  const barbearia = window.BARBEARIA;
  const metricas  = await getMetricas(barbearia.id);

  // Hoje
  const elHoje = document.getElementById('stat-hoje');
  if (elHoje) elHoje.textContent = metricas.agendamentosHoje;

  // Mês
  const elMes = document.getElementById('stat-mes');
  if (elMes) elMes.textContent = metricas.agendamentosMes;

  // Faturamento
  const elFat = document.getElementById('stat-faturamento');
  if (elFat) elFat.textContent = formatarPreco(metricas.faturamentoMes);

  // Limite do plano
  const limite = barbearia.plans?.max_appointments;
  const elLimite = document.getElementById('stat-limite');
  if (elLimite) {
    elLimite.textContent = limite
      ? `${barbearia.appointments_this_month} / ${limite}`
      : 'Ilimitado';
  }
}

// ============================================
// 3. RENDERIZAR AGENDAMENTOS DE HOJE
// Mostra a agenda do dia no painel
// ============================================
async function renderAgendamentosHoje() {
  const barbearia = window.BARBEARIA;
  const hoje      = new Date().toISOString().split('T')[0];

  const agendamentos = await getAgendamentos(barbearia.id, { data: hoje });

  const container = document.getElementById('agendamentosHoje');
  if (!container) return;

  if (!agendamentos.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <div class="empty-title">Nenhum agendamento hoje</div>
        <div class="empty-desc">Compartilhe seu link para receber agendamentos</div>
      </div>`;
    return;
  }

  container.innerHTML = agendamentos.map(a => `
    <div class="agenda-row" id="ag-${a.id}">
      <div class="agenda-time">${a.start_time.slice(0,5)}</div>
      <div class="agenda-info">
        <div class="agenda-client">${a.client_name}</div>
        <div class="agenda-service">${a.services?.name || '—'} · ${formatarDuracao(a.services?.duration_min || 0)}</div>
        <div class="agenda-phone">📱 ${a.client_phone}</div>
      </div>
      <div class="agenda-price">${formatarPreco(a.services?.price || 0)}</div>
      <div class="agenda-actions">
        ${a.status === 'confirmed' ? `
          <button onclick="marcarConcluido('${a.id}')" class="btn btn-sm btn-success">✅ Concluído</button>
          <button onclick="marcarFaltou('${a.id}')"    class="btn btn-sm btn-warning">⚠️ Faltou</button>
          <button onclick="cancelarAg('${a.id}')"      class="btn btn-sm btn-danger">✕ Cancelar</button>
        ` : `<span class="badge badge-${badgeStatus(a.status)}">${labelStatus(a.status)}</span>`}
      </div>
    </div>
  `).join('');
}

// ============================================
// 4. RENDERIZAR PRÓXIMOS AGENDAMENTOS
// Mostra os próximos 5 horários futuros
// ============================================
async function renderProximosAgendamentos() {
  const barbearia    = window.BARBEARIA;
  const metricas     = await getMetricas(barbearia.id);
  const proximos     = metricas.proximosHorarios;

  const container = document.getElementById('proximosAgendamentos');
  if (!container) return;

  if (!proximos.length) {
    container.innerHTML = `<p style="color:var(--gray-text);font-size:.88rem;">Nenhum agendamento futuro.</p>`;
    return;
  }

  container.innerHTML = proximos.map(a => `
    <div class="proximo-item">
      <div class="proximo-data">${formatarData(a.date)}</div>
      <div class="proximo-info">
        <strong>${a.start_time.slice(0,5)}</strong> · ${a.client_name}
        <span style="color:var(--gray-text);font-size:.8rem;"> · ${a.services?.name || '—'}</span>
      </div>
    </div>
  `).join('');
}

// ============================================
// 5. ALERTA DE LIMITE DO PLANO
// Avisa quando a barbearia está perto do limite
// ============================================
async function renderAlertaPlano() {
  const barbearia = window.BARBEARIA;
  const limite    = barbearia.plans?.max_appointments;

  if (!limite) return; // plano ilimitado, sem alerta

  const usado      = barbearia.appointments_this_month;
  const percentual = (usado / limite) * 100;

  const container = document.getElementById('alertaPlano');
  if (!container) return;

  if (percentual >= 90) {
    container.innerHTML = `
      <div class="alert alert-danger">
        🔴 Você usou <strong>${usado} de ${limite}</strong> agendamentos do seu plano este mês.
        <a href="../public/planos.html" style="font-weight:700;margin-left:8px;">Fazer upgrade →</a>
      </div>`;
  } else if (percentual >= 70) {
    container.innerHTML = `
      <div class="alert alert-warning">
        ⚠️ Você usou <strong>${usado} de ${limite}</strong> agendamentos do seu plano este mês.
      </div>`;
  }
}

// ============================================
// 6. AÇÕES RÁPIDAS DE AGENDAMENTO
// Chamadas pelos botões na listagem de hoje
// ============================================
async function marcarConcluido(agendamentoId) {
  const resultado = await atualizarStatusAgendamento(agendamentoId, 'completed');
  if (resultado.ok) {
    showToast('✅ Agendamento marcado como concluído!');
    await renderAgendamentosHoje();
    await renderEstatisticas();
  } else {
    showToast('❌ ' + resultado.message, 'erro');
  }
}

async function marcarFaltou(agendamentoId) {
  const resultado = await atualizarStatusAgendamento(agendamentoId, 'no_show');
  if (resultado.ok) {
    showToast('⚠️ Cliente marcado como faltou.');
    await renderAgendamentosHoje();
  } else {
    showToast('❌ ' + resultado.message, 'erro');
  }
}

async function cancelarAg(agendamentoId) {
  if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
  const resultado = await cancelarAgendamento(agendamentoId);
  if (resultado.ok) {
    showToast('🗑 Agendamento cancelado.');
    await renderAgendamentosHoje();
    await renderEstatisticas();
  } else {
    showToast('❌ ' + resultado.message, 'erro');
  }
}

// ============================================
// 7. INICIALIZAR SEÇÃO DE SERVIÇOS
// Carrega e renderiza os serviços no painel
// ============================================
async function initServicos() {
  const barbearia  = window.BARBEARIA;
  const servicos   = await getServicos(barbearia.id);

  const container = document.getElementById('servicosList');
  if (!container) return;

  if (!servicos.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✂️</div>
        <div class="empty-title">Nenhum serviço cadastrado</div>
        <div class="empty-desc">Adicione seu primeiro serviço abaixo</div>
      </div>`;
    return;
  }

  container.innerHTML = servicos.map(s => `
    <div class="servico-row" id="sv-${s.id}">
      <div class="servico-info">
        <div class="servico-name">${s.name}</div>
        <div class="servico-meta">${formatarDuracao(s.duration_min)} · ${formatarPreco(s.price)}</div>
      </div>
      <div class="servico-status">
        <span class="badge ${s.is_active ? 'badge-success' : 'badge-gray'}">
          ${s.is_active ? 'Ativo' : 'Inativo'}
        </span>
      </div>
      <div class="servico-actions">
        <button onclick="toggleSv('${s.id}', ${!s.is_active})" class="btn btn-sm btn-secondary">
          ${s.is_active ? '⏸ Desativar' : '▶️ Ativar'}
        </button>
        <button onclick="deletarSv('${s.id}')" class="btn btn-sm btn-danger">🗑</button>
      </div>
    </div>
  `).join('');
}

// ============================================
// 8. CRIAR NOVO SERVIÇO VIA FORMULÁRIO
// Chamado pelo botão "Salvar serviço" no painel
// ============================================
async function salvarNovoServico() {
  const barbearia = window.BARBEARIA;

  const dados = {
    name:         document.getElementById('sv-nome')?.value.trim(),
    duration_min: document.getElementById('sv-duracao')?.value,
    price:        document.getElementById('sv-preco')?.value
  };

  const resultado = await criarServico(barbearia.id, dados);

  if (!resultado.ok) {
    showToast('❌ ' + resultado.message, 'erro');
    return;
  }

  showToast('✅ Serviço cadastrado com sucesso!');

  // Limpar formulário
  ['sv-nome', 'sv-duracao', 'sv-preco'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  await initServicos();
}

// ============================================
// 9. TOGGLE E DELETE DE SERVIÇO
// ============================================
async function toggleSv(servicoId, ativo) {
  const resultado = await toggleServico(servicoId, ativo);
  if (resultado.ok) {
    showToast(ativo ? '▶️ Serviço ativado.' : '⏸ Serviço desativado.');
    await initServicos();
  }
}

async function deletarSv(servicoId) {
  if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
  const resultado = await deletarServico(servicoId);
  if (resultado.ok) {
    showToast('🗑 Serviço excluído.');
    await initServicos();
  }
}

// ============================================
// 10. SALVAR CONFIGURAÇÕES DA BARBEARIA
// Chamado pelo botão "Salvar" nas configurações
// ============================================
async function salvarConfiguracoes() {
  const dados = {
    name:        document.getElementById('cfg-nome')?.value.trim(),
    ownerName:   document.getElementById('cfg-barbeiro')?.value.trim(),
    whatsapp:    document.getElementById('cfg-whatsapp')?.value.trim(),
    description: document.getElementById('cfg-descricao')?.value.trim(),
    city:        document.getElementById('cfg-cidade')?.value.trim(),
    startHour:   parseInt(document.getElementById('cfg-inicio')?.value),
    endHour:     parseInt(document.getElementById('cfg-fim')?.value),
    intervalMin: parseInt(document.getElementById('cfg-intervalo')?.value),
    workDays:    getWorkDaysSelecionados()
  };

  const resultado = await atualizarBarbearia(dados);

  if (!resultado.ok) {
    showToast('❌ ' + resultado.message, 'erro');
    return;
  }

  showToast('✅ Configurações salvas com sucesso!');

  // Atualizar dados locais
  window.BARBEARIA = await getBarbearia();
}

// ============================================
// 11. PEGAR DIAS DA SEMANA SELECIONADOS
// Lê os checkboxes de dias de funcionamento
// ============================================
function getWorkDaysSelecionados() {
  const dias = [];
  document.querySelectorAll('input[name="workDay"]:checked').forEach(cb => {
    dias.push(parseInt(cb.value));
  });
  return dias.length ? dias : [1,2,3,4,5,6];
}

// ============================================
// 12. LOGOUT DO PAINEL
// ============================================
async function logoutDashboard() {
  await fazerLogout();
}

// ============================================
// 13. TOAST NOTIFICATION
// Exibe mensagem de feedback para o usuário
// ============================================
function showToast(mensagem, tipo = 'sucesso') {
  const old = document.querySelector('.toast-jpbarber');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-jpbarber';
  toast.textContent = mensagem;
  toast.style.cssText = `
    position:fixed;bottom:28px;right:28px;
    background:${tipo === 'erro' ? '#ef4444' : '#0f172a'};
    color:white;padding:14px 20px;border-radius:12px;
    font-size:.88rem;font-weight:500;z-index:9999;
    box-shadow:0 8px 30px rgba(0,0,0,.25);
    animation:toastIn .3s ease;max-width:320px;
  `;

  if (!document.getElementById('toastStyle')) {
    const s = document.createElement('style');
    s.id = 'toastStyle';
    s.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}';
    document.head.appendChild(s);
  }

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .4s';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ============================================
// 14. HELPERS DE STATUS
// Traduz status do banco para exibição visual
// ============================================
function labelStatus(status) {
  const labels = {
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    no_show:   'Faltou'
  };
  return labels[status] || status;
}

function badgeStatus(status) {
  const badges = {
    confirmed: 'blue',
    completed: 'success',
    cancelled: 'danger',
    no_show:   'warning'
  };
  return badges[status] || 'gray';
}