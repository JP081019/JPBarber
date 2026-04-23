// ============================================
// JP Barber | JP Dev Soluções Digitais
// js/barbershop.js — dados da barbearia
// ============================================
// DEPENDE DE: supabase.js, auth.js
// ============================================

// ============================================
// 1. BUSCAR BARBEARIA PELO SLUG
// Usado na página pública de agendamento
// Ex: jpbarber.com/barbearia-do-ze
// ============================================
async function getBarbeariaBySlug(slug) {
  const { data, error } = await supabaseClient
    .from('barbershops')
    .select('*, plans(name, slug)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Barbearia não encontrada:', error.message);
    return null;
  }

  return data;
}

// ============================================
// 2. ATUALIZAR DADOS DA BARBEARIA
// Usado na página de configurações do painel
// ============================================
async function atualizarBarbearia(dados) {
  const user = await getSessao();
  if (!user) return { ok: false, message: 'Não autorizado.' };

  const { error } = await supabaseClient
    .from('barbershops')
    .update({
      name:         dados.name,
      owner_name:   dados.ownerName,
      whatsapp:     dados.whatsapp,
      description:  dados.description,
      address:      dados.address,
      city:         dados.city,
      work_days:    dados.workDays,
      start_hour:   dados.startHour,
      end_hour:     dados.endHour,
      interval_min: dados.intervalMin
    })
    .eq('user_id', user.id);

  if (error) {
    console.error('Erro ao atualizar barbearia:', error.message);
    return { ok: false, message: 'Erro ao salvar. Tente novamente.' };
  }

  console.log('✅ Barbearia atualizada!');
  return { ok: true };
}

// ============================================
// 3. VERIFICAR SE SLUG ESTÁ DISPONÍVEL
// Usado no cadastro para garantir URL única
// ============================================
async function slugDisponivel(slug) {
  const { data, error } = await supabaseClient
    .from('barbershops')
    .select('id')
    .eq('slug', slug)
    .single();

  // Se não encontrou (error = 'PGRST116'), o slug está livre
  if (error && error.code === 'PGRST116') return true;

  // Se encontrou, está ocupado
  return false;
}

// ============================================
// 4. VERIFICAR LIMITE DO PLANO
// Verifica se a barbearia pode receber mais agendamentos
// Usado antes de confirmar um novo agendamento
// ============================================
async function verificarLimitePlano(barbershopId) {
  // Buscar dados da barbearia com o plano
  const { data, error } = await supabaseClient
    .from('barbershops')
    .select('appointments_this_month, plans(max_appointments, name)')
    .eq('id', barbershopId)
    .single();

  if (error) return { ok: false, message: 'Erro ao verificar plano.' };

  const limite = data.plans.max_appointments;

  // Se limite é NULL, é ilimitado (plano Pró ou Premium)
  if (limite === null) return { ok: true };

  // Se atingiu o limite, bloquear
  if (data.appointments_this_month >= limite) {
    return {
      ok: false,
      message: `Esta barbearia atingiu o limite de ${limite} agendamentos do plano ${data.plans.name} este mês.`
    };
  }

  return { ok: true, restantes: limite - data.appointments_this_month };
}

// ============================================
// 5. INCREMENTAR CONTADOR DE AGENDAMENTOS
// Chamado sempre que um novo agendamento é confirmado
// ============================================
async function incrementarAgendamentos(barbershopId) {
  const { error } = await supabaseClient.rpc('incrementar_agendamentos', {
    p_barbershop_id: barbershopId
  });

  if (error) {
    console.error('Erro ao incrementar agendamentos:', error.message);
  }
}

// ============================================
// 6. BUSCAR MÉTRICAS DO DASHBOARD
// Retorna totais para exibir no painel da barbearia
// ============================================
async function getMetricas(barbershopId) {
  const hoje = new Date().toISOString().split('T')[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0];

  // Agendamentos de hoje
  const { data: hoje_data } = await supabaseClient
    .from('appointments')
    .select('id, status')
    .eq('barbershop_id', barbershopId)
    .eq('date', hoje);

  // Agendamentos do mês
  const { data: mes_data } = await supabaseClient
    .from('appointments')
    .select('id, status, services(price)')
    .eq('barbershop_id', barbershopId)
    .gte('date', inicioMes);

  // Próximos agendamentos (hoje em diante)
  const { data: proximos } = await supabaseClient
    .from('appointments')
    .select('id, client_name, date, start_time, services(name)')
    .eq('barbershop_id', barbershopId)
    .eq('status', 'confirmed')
    .gte('date', hoje)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(5);

  // Calcular faturamento estimado do mês
  const faturamento = (mes_data || [])
    .filter(a => a.status === 'completed')
    .reduce((total, a) => total + (a.services?.price || 0), 0);

  return {
    agendamentosHoje:  (hoje_data  || []).length,
    agendamentosMes:   (mes_data   || []).length,
    faturamentoMes:    faturamento,
    proximosHorarios:  proximos || []
  };
}