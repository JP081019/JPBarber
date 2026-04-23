// ============================================
// JP Barber | JP Dev Soluções Digitais
// agendamento.html — script inline
// Conectado ao Supabase via booking.js
// ============================================

// ============================================
// STATE — guarda tudo que o cliente escolheu
// ============================================
var state = {
  barbearia:  null,   // dados da barbearia
  servicos:   [],     // lista de serviços
  servico:    null,   // serviço escolhido
  date:       null,   // data escolhida (YYYY-MM-DD)
  time:       null,   // horário escolhido (HH:MM)
  slots:      [],     // slots disponíveis do dia
  calYear:    new Date().getFullYear(),
  calMonth:   new Date().getMonth()
};

// ============================================
// 1. INICIALIZAR PÁGINA
// Pega o slug da URL e carrega os dados
// Ex: /barbearia/barbearia-do-ze → slug = "barbearia-do-ze"
// ============================================
async function initAgendamento() {

  // ✅ Pega o slug da URL (query param)
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    mostrarErroFatal('Link inválido. Verifique o endereço.');
    return;
  }

  // 🔎 Buscar dados da barbearia
  const barbearia = await getBarbeariaBySlug(slug);

  if (!barbearia) {
    mostrarErroFatal('Barbearia não encontrada. Verifique o link.');
    return;
  }

  state.barbearia = barbearia;

  // 🧠 Preencher header
  document.getElementById('pageBarberName').textContent = barbearia.name;
  document.getElementById('pageBarberTagline').textContent =
    barbearia.description || 'Agende seu horário online';

  document.title = 'Agendar — ' + barbearia.name + ' | JP Barber';

  // 📋 Buscar serviços
  const servicos = await getServicosPublico(barbearia.id);

  if (!servicos.length) {
    mostrarErroFatal('Esta barbearia ainda não tem serviços cadastrados.');
    return;
  }

  state.servicos = servicos;

  // 🎯 Renderização
  renderServicos();
  renderCalendario();
  setStep(1);

  console.log('✅ Página carregada para:', barbearia.name);
}

// ============================================
// 2. RENDERIZAR SERVIÇOS
// ============================================
function renderServicos() {
  var list = document.getElementById('servicesList');

  list.innerHTML = state.servicos.map(function(s) {
    return '<label class="service-option" data-id="' + s.id + '">' +
      '<input type="radio" name="service" value="' + s.id + '">' +
      '<div class="service-radio"></div>' +
      '<div class="service-info">' +
        '<div class="service-name">' + s.name + '</div>' +
        '<div class="service-duration">⏱ ' + formatarDuracao(s.duration_min) + '</div>' +
      '</div>' +
      '<div class="service-price">' + formatarPreco(s.price) + '</div>' +
    '</label>';
  }).join('');

  // Atualizar contador
  document.getElementById('serviceCount').textContent = state.servicos.length + ' serviços';

  // Eventos de clique
  list.querySelectorAll('.service-option').forEach(function(opt) {
    opt.addEventListener('click', function() {
      list.querySelectorAll('.service-option').forEach(function(o) {
        o.classList.remove('selected');
      });
      this.classList.add('selected');

      var id = this.dataset.id;
      state.servico = state.servicos.find(function(s) { return s.id === id; });

      // Limpar seleção de horário ao trocar serviço
      state.time = null;
      if (state.date) renderSlots();
    });
  });
}

// ============================================
// 3. RENDERIZAR CALENDÁRIO
// ============================================
function renderCalendario() {
  var meses    = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var workDays = state.barbearia.work_days || [1,2,3,4,5,6];

  document.getElementById('calTitle').textContent =
    meses[state.calMonth] + ' ' + state.calYear;

  var grid     = document.getElementById('calGrid');
  var weekdays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  var html     = weekdays.map(function(d) {
    return '<div class="cal-weekday">' + d + '</div>';
  }).join('');

  var firstDay     = new Date(state.calYear, state.calMonth, 1).getDay();
  var daysInMonth  = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  var hoje         = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Células vazias antes do dia 1
  for (var i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (var d = 1; d <= daysInMonth; d++) {
    var dt         = new Date(state.calYear, state.calMonth, d);
    var isPast     = dt < hoje;
    var isWork     = workDays.includes(dt.getDay());
    var isToday    = dt.toDateString() === hoje.toDateString();
    var key        = state.calYear + '-' +
                     String(state.calMonth + 1).padStart(2,'0') + '-' +
                     String(d).padStart(2,'0');
    var isSelected = state.date === key;

    var cls = 'cal-day';
    if (isPast || !isWork) cls += ' disabled';
    if (isToday)           cls += ' today';
    if (isSelected)        cls += ' selected';
    if (!isPast && isWork) cls += ' has-slots';

    html += '<div class="' + cls + '" data-key="' + key + '">' + d + '</div>';
  }

  grid.innerHTML = html;

  // Eventos de clique nos dias
  grid.querySelectorAll('.cal-day:not(.disabled):not(.empty)').forEach(function(el) {
    el.addEventListener('click', async function() {
      grid.querySelectorAll('.cal-day').forEach(function(c) {
        c.classList.remove('selected');
      });
      this.classList.add('selected');
      state.date = this.dataset.key;
      state.time = null;
      await renderSlots();
    });
  });
}

// ============================================
// 4. RENDERIZAR SLOTS DISPONÍVEIS
// Busca do banco em tempo real
// ============================================
async function renderSlots() {
  if (!state.date) return;

  var slotsCard = document.getElementById('slotsCard');
  var slotsGrid = document.getElementById('slotsGrid');

  slotsCard.style.display = 'block';
  slotsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--gray-text);font-size:.88rem;">⏳ Verificando horários...</div>';

  // Se não selecionou serviço ainda, usa intervalo padrão
  var servico = state.servico || { duration_min: state.barbearia.interval_min };

  // Buscar slots disponíveis do banco
  var disponiveis = await getSlotsDisponiveis(
    state.barbearia.id,
    state.date,
    servico
  );

  state.slots = disponiveis;

  // Gerar todos os slots para mostrar ocupados também
  var todos = gerarSlots(
    state.barbearia.start_hour,
    state.barbearia.end_hour,
    state.barbearia.interval_min,
    servico.duration_min
  );

  document.getElementById('slotsCount').textContent =
    disponiveis.length + ' disponíveis';

  if (!todos.length) {
    slotsGrid.innerHTML = '<div class="slots-empty" style="grid-column:1/-1;">Nenhum horário disponível para esta data.</div>';
    return;
  }

  slotsGrid.innerHTML = todos.map(function(slot) {
    var disponivel = disponiveis.includes(slot);
    var selecionado = state.time === slot;
    var cls = 'slot-btn' + (!disponivel ? ' occupied' : '') + (selecionado ? ' selected' : '');
    return '<button class="' + cls + '" data-time="' + slot + '"' +
      (!disponivel ? ' disabled' : '') + '>' + slot + '</button>';
  }).join('');

  // Eventos de clique nos slots
  slotsGrid.querySelectorAll('.slot-btn:not(.occupied)').forEach(function(btn) {
    btn.addEventListener('click', function() {
      slotsGrid.querySelectorAll('.slot-btn').forEach(function(b) {
        b.classList.remove('selected');
      });
      this.classList.add('selected');
      state.time = this.dataset.time;
    });
  });
}

// ============================================
// 5. CONTROLE DE STEPS
// ============================================
function setStep(n) {
  [1,2,3,4].forEach(function(i) {
    var el = document.getElementById('step' + i);
    if (el) el.style.display = (i === n) ? 'block' : 'none';
  });

  // Atualizar barra de progresso
  for (var i = 1; i <= 4; i++) {
    var sc = document.getElementById('sc' + i);
    var sl = document.getElementById('sl' + i);
    if (!sc || !sl) continue;

    sc.classList.remove('active', 'done');
    sl.classList.remove('active');

    if (i < n)  { sc.classList.add('done'); sc.textContent = '✓'; }
    if (i === n) { sc.classList.add('active'); sl.classList.add('active'); }
    if (i > 1)  {
      var line = document.getElementById('sline' + (i - 1));
      if (line) line.classList.toggle('done', i <= n);
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// 6. PREENCHER RESUMO DO AGENDAMENTO
// ============================================
function preencherResumo() {
  var partes = state.date.split('-');
  var dataFormatada = formatarData(state.date);

  document.getElementById('sum-service').textContent  = state.servico.name;
  document.getElementById('sum-date').textContent     = dataFormatada;
  document.getElementById('sum-time').textContent     = state.time;
  document.getElementById('sum-duration').textContent = formatarDuracao(state.servico.duration_min);
  document.getElementById('sum-price').textContent    = formatarPreco(state.servico.price);
}

// ============================================
// 7. CONFIRMAR AGENDAMENTO
// ============================================
async function confirmarAgendamento() {
  var nome  = document.getElementById('clientName').value.trim();
  var phone = document.getElementById('clientPhone').value.trim();
  var email = document.getElementById('clientEmail').value.trim();

  if (!nome || !phone) {
    alert('Por favor, preencha seu nome e WhatsApp.');
    return;
  }

  var btn = document.getElementById('confirmBtn');
  btn.disabled    = true;
  btn.textContent = 'Confirmando...';

  var resultado = await criarAgendamento({
    barbershopId:    state.barbearia.id,
    serviceId:       state.servico.id,
    serviceDuration: state.servico.duration_min,
    clientName:      nome,
    clientPhone:     phone,
    clientEmail:     email || null,
    date:            state.date,
    startTime:       state.time
  });

  if (!resultado.ok) {
    alert(resultado.message);
    btn.disabled    = false;
    btn.textContent = '✅ Confirmar agendamento';
    return;
  }

  // Preencher tela de sucesso
  document.getElementById('conf-barber').textContent   = state.barbearia.name;
  document.getElementById('conf-service').textContent  = state.servico.name;
  document.getElementById('conf-datetime').textContent = formatarData(state.date) + ' às ' + state.time;
  document.getElementById('conf-duration').textContent = formatarDuracao(state.servico.duration_min);
  document.getElementById('conf-price').textContent    = formatarPreco(state.servico.price);
  document.getElementById('conf-name').textContent     = nome;

  // Montar link do WhatsApp
  var msg = encodeURIComponent(
    '✅ *Agendamento confirmado!*\n\n' +
    '✂️ *Barbearia:* ' + state.barbearia.name + '\n' +
    '📋 *Serviço:* ' + state.servico.name + '\n' +
    '📅 *Data:* ' + formatarData(state.date) + '\n' +
    '⏰ *Horário:* ' + state.time + '\n' +
    '💰 *Valor:* ' + formatarPreco(state.servico.price) + '\n\n' +
    'Nos vemos em breve! 👋'
  );
  document.getElementById('whatsappBtn').href =
    'https://wa.me/' + state.barbearia.whatsapp + '?text=' + msg;

  setStep(4);
}

// ============================================
// 8. ERRO FATAL — página não pode carregar
// ============================================
function mostrarErroFatal(mensagem) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
      background:var(--gray-light);font-family:'DM Sans',sans-serif;padding:24px;">
      <div style="text-align:center;max-width:400px;">
        <div style="font-size:4rem;margin-bottom:16px;">😕</div>
        <h2 style="font-family:'Sora',sans-serif;margin-bottom:8px;">Página não encontrada</h2>
        <p style="color:#64748b;margin-bottom:24px;">${mensagem}</p>
        <a href="../index.html"
          style="background:#2563eb;color:white;padding:12px 24px;border-radius:10px;
          text-decoration:none;font-weight:600;font-size:.9rem;">
          Voltar ao início
        </a>
      </div>
    </div>`;
}

// ============================================
// 9. EVENTOS DOS BOTÕES DE NAVEGAÇÃO
// ============================================

// Step 1 → 2
document.getElementById('nextToStep2').addEventListener('click', function() {
  if (!state.servico) {
    alert('Por favor, escolha um serviço.');
    return;
  }
  setStep(2);
});

// Step 2 → 3
document.getElementById('nextToStep3').addEventListener('click', function() {
  if (!state.date) { alert('Por favor, escolha uma data.'); return; }
  if (!state.time) { alert('Por favor, escolha um horário.'); return; }
  preencherResumo();
  setStep(3);
});

// Voltar 2 → 1
document.getElementById('backToStep1').addEventListener('click', function() {
  setStep(1);
});

// Voltar 3 → 2
document.getElementById('backToStep2').addEventListener('click', function() {
  setStep(2);
});

// Confirmar agendamento
document.getElementById('confirmBtn').addEventListener('click', confirmarAgendamento);

// Navegação do calendário
document.getElementById('prevMonth').addEventListener('click', function() {
  state.calMonth--;
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  renderCalendario();
});
document.getElementById('nextMonth').addEventListener('click', function() {
  state.calMonth++;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  renderCalendario();
});

// ============================================
// 10. INICIALIZAR
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  initAgendamento();
});