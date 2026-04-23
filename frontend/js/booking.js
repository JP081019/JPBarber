// ============================================
// JP Barber | JP Dev Soluções Digitais
// js/booking.js — lógica de agendamento
// ============================================
// DEPENDE DE: supabase.js, barbershop.js
// ============================================

// ============================================
// 1. GERAR SLOTS DO DIA
// Calcula todos os horários possíveis com base
// nas configurações da barbearia e duração do serviço
// Ex: 09:00, 09:30, 10:00...
// ============================================
function gerarSlots(startHour, endHour, intervalMin, duracaoServico) {
  const slots = [];
  let atual = startHour * 60; // converter para minutos
  const fim = endHour * 60;

  while (atual + duracaoServico <= fim) {
    const hh = String(Math.floor(atual / 60)).padStart(2, '0');
    const mm = String(atual % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    atual += intervalMin;
  }

  return slots;
}

// ============================================
// 2. BUSCAR HORÁRIOS OCUPADOS DE UM DIA
// Retorna os horários já agendados + bloqueados
// para uma barbearia em uma data específica
// ============================================
async function getHorariosOcupados(barbershopId, data) {
  // Buscar agendamentos confirmados do dia
  const { data: agendamentos } = await supabaseClient
    .from('appointments')
    .select('start_time, end_time')
    .eq('barbershop_id', barbershopId)
    .eq('date', data)
    .in('status', ['confirmed']);

  // Buscar horários bloqueados do dia
  const { data: bloqueios } = await supabaseClient
    .from('blocked_slots')
    .select('start_time, end_time')
    .eq('barbershop_id', barbershopId)
    .eq('date', data);

  // Juntar os dois em uma lista só
  const ocupados = [
    ...(agendamentos || []),
    ...(bloqueios    || [])
  ];

  return ocupados;
}

// ============================================
// 3. VERIFICAR SE UM SLOT ESTÁ DISPONÍVEL
// Checa se o horário desejado conflita com
// algum agendamento ou bloqueio existente
// ============================================
function slotDisponivel(slotInicio, duracaoMin, ocupados) {
  // Converter HH:MM para minutos
  function toMin(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  const inicio = toMin(slotInicio);
  const fim    = inicio + duracaoMin;

  for (const ocupado of ocupados) {
    const ocInicio = toMin(ocupado.start_time.slice(0, 5));
    const ocFim    = toMin(ocupado.end_time.slice(0, 5));

    // Conflito: os períodos se sobrepõem
    if (inicio < ocFim && fim > ocInicio) {
      return false;
    }
  }

  return true;
}

// ============================================
// 4. BUSCAR SLOTS DISPONÍVEIS DO DIA
// Combina tudo: gera slots, remove ocupados
// Retorna lista pronta para exibir ao cliente
// ============================================
async function getSlotsDisponiveis(barbershopId, data, servico) {
  // Buscar configurações da barbearia
  const { data: barbearia } = await supabaseClient
    .from('barbershops')
    .select('start_hour, end_hour, interval_min, work_days')
    .eq('id', barbershopId)
    .single();

  if (!barbearia) return [];

  // Verificar se a barbearia funciona nesse dia da semana
  const diaSemana = new Date(data + 'T12:00:00').getDay();
  if (!barbearia.work_days.includes(diaSemana)) return [];

  // Gerar todos os slots possíveis
  const todosSlots = gerarSlots(
    barbearia.start_hour,
    barbearia.end_hour,
    barbearia.interval_min,
    servico.duration_min
  );

  // Buscar ocupados
  const ocupados = await getHorariosOcupados(barbershopId, data);

  // Filtrar apenas os disponíveis
  const disponiveis = todosSlots.filter(slot =>
    slotDisponivel(slot, servico.duration_min, ocupados)
  );

  return disponiveis;
}

// ============================================
// 5. CALCULAR HORÁRIO DE FIM
// Ex: início 09:00 + 45min = 09:45
// ============================================
function calcularHorarioFim(startTime, duracaoMin) {
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + duracaoMin;
  const hFim = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mFim = String(totalMin % 60).padStart(2, '0');
  return `${hFim}:${mFim}`;
}

// ============================================
// 6. CRIAR AGENDAMENTO
// Salva o agendamento no banco após todas as
// verificações de conflito e limite de plano
// ============================================
async function criarAgendamento(dados) {
  // dados = {
  //   barbershopId, serviceId, serviceDuration,
  //   clientName, clientPhone, clientEmail,
  //   date, startTime
  // }

  // Passo 1: verificar limite do plano
  const limite = await verificarLimitePlano(dados.barbershopId);
  if (!limite.ok) {
    return { ok: false, message: limite.message };
  }

  // Passo 2: verificar conflito em tempo real
  // (proteção extra — o cliente pode ter ficado muito tempo na tela)
  const ocupados = await getHorariosOcupados(dados.barbershopId, dados.date);
  const disponivel = slotDisponivel(dados.startTime, dados.serviceDuration, ocupados);

  if (!disponivel) {
    return {
      ok: false,
      message: 'Este horário acabou de ser reservado. Por favor, escolha outro.'
    };
  }

  // Passo 3: calcular horário de fim
  const endTime = calcularHorarioFim(dados.startTime, dados.serviceDuration);

  // Passo 4: salvar no banco
  const { data, error } = await supabaseClient
    .from('appointments')
    .insert({
      barbershop_id: dados.barbershopId,
      service_id:    dados.serviceId,
      client_name:   dados.clientName,
      client_phone:  dados.clientPhone,
      client_email:  dados.clientEmail || null,
      date:          dados.date,
      start_time:    dados.startTime,
      end_time:      endTime,
      status:        'confirmed'
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar agendamento:', error.message);
    return { ok: false, message: 'Erro ao confirmar agendamento. Tente novamente.' };
  }

  // Passo 5: incrementar contador do plano
  await incrementarAgendamentos(dados.barbershopId);

  console.log('✅ Agendamento criado:', data.id);
  return { ok: true, agendamento: data };
}

// ============================================
// 7. LISTAR AGENDAMENTOS DA BARBEARIA
// Usado no painel admin para ver a agenda
// ============================================
async function getAgendamentos(barbershopId, filtros = {}) {
  // filtros = { data, status }

  let query = supabaseClient
    .from('appointments')
    .select('*, services(name, price, duration_min)')
    .eq('barbershop_id', barbershopId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (filtros.data) {
    query = query.eq('date', filtros.data);
  }

  if (filtros.status) {
    query = query.eq('status', filtros.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar agendamentos:', error.message);
    return [];
  }

  return data;
}

// ============================================
// 8. ATUALIZAR STATUS DO AGENDAMENTO
// Usado no painel para marcar como:
// completed, cancelled, no_show
// ============================================
async function atualizarStatusAgendamento(agendamentoId, status) {
  const statusValidos = ['confirmed', 'completed', 'cancelled', 'no_show'];

  if (!statusValidos.includes(status)) {
    return { ok: false, message: 'Status inválido.' };
  }

  const { error } = await supabaseClient
    .from('appointments')
    .update({ status })
    .eq('id', agendamentoId);

  if (error) {
    console.error('Erro ao atualizar status:', error.message);
    return { ok: false, message: 'Erro ao atualizar agendamento.' };
  }

  console.log('✅ Status atualizado para:', status);
  return { ok: true };
}

// ============================================
// 9. CANCELAR AGENDAMENTO
// Atalho para atualizarStatusAgendamento
// ============================================
async function cancelarAgendamento(agendamentoId) {
  return await atualizarStatusAgendamento(agendamentoId, 'cancelled');
}

// ============================================
// 10. FORMATAR DATA
// Ex: "2026-04-17" → "Quinta, 17 de Abril de 2026"
// ============================================
function formatarData(dataStr) {
  const dias   = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const meses  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const dt = new Date(dataStr + 'T12:00:00');
  return `${dias[dt.getDay()]}, ${dt.getDate()} de ${meses[dt.getMonth()]} de ${dt.getFullYear()}`;
}

// ============================================
// 11. VERIFICAR SE DATA É VÁLIDA PARA AGENDAR
// Não permite datas passadas
// ============================================
function dataValida(dataStr) {
  const hoje     = new Date();
  hoje.setHours(0, 0, 0, 0);
  const escolhida = new Date(dataStr + 'T12:00:00');
  return escolhida >= hoje;
}