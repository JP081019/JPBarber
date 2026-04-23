// ============================================
// JP Barber | JP Dev Soluções Digitais
// js/services.js — gerenciamento de serviços
// ============================================
// DEPENDE DE: supabase.js, auth.js
// ============================================

// ============================================
// 1. LISTAR SERVIÇOS DA BARBEARIA LOGADA
// Usado no painel admin para gerenciar serviços
// ============================================
async function getServicos(barbershopId) {
  const { data, error } = await supabaseClient
    .from('services')
    .select('*')
    .eq('barbershop_id', barbershopId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar serviços:', error.message);
    return [];
  }

  return data;
}

// ============================================
// 2. LISTAR SERVIÇOS ATIVOS (PÁGINA PÚBLICA)
// Usado na página de agendamento do cliente
// Só retorna serviços ativos
// ============================================
async function getServicosPublico(barbershopId) {
  const { data, error } = await supabaseClient
    .from('services')
    .select('id, name, duration_min, price')
    .eq('barbershop_id', barbershopId)
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error) {
    console.error('Erro ao buscar serviços públicos:', error.message);
    return [];
  }

  return data;
}

// ============================================
// 3. CRIAR SERVIÇO
// Usado no painel para adicionar novo serviço
// ============================================
async function criarServico(barbershopId, dados) {
  // dados = { name, duration_min, price }

  if (!dados.name || !dados.duration_min || !dados.price) {
    return { ok: false, message: 'Preencha todos os campos do serviço.' };
  }

  if (dados.price <= 0) {
    return { ok: false, message: 'O preço deve ser maior que zero.' };
  }

  if (dados.duration_min <= 0) {
    return { ok: false, message: 'A duração deve ser maior que zero.' };
  }

  const { data, error } = await supabaseClient
    .from('services')
    .insert({
      barbershop_id: barbershopId,
      name:          dados.name,
      duration_min:  parseInt(dados.duration_min),
      price:         parseFloat(dados.price)
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar serviço:', error.message);
    return { ok: false, message: 'Erro ao salvar serviço. Tente novamente.' };
  }

  console.log('✅ Serviço criado:', data.name);
  return { ok: true, servico: data };
}

// ============================================
// 4. ATUALIZAR SERVIÇO
// Usado no painel para editar um serviço existente
// ============================================
async function atualizarServico(servicoId, dados) {
  // dados = { name, duration_min, price, is_active }

  const { data, error } = await supabaseClient
    .from('services')
    .update({
      name:         dados.name,
      duration_min: parseInt(dados.duration_min),
      price:        parseFloat(dados.price),
      is_active:    dados.is_active
    })
    .eq('id', servicoId)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar serviço:', error.message);
    return { ok: false, message: 'Erro ao atualizar serviço.' };
  }

  console.log('✅ Serviço atualizado:', data.name);
  return { ok: true, servico: data };
}

// ============================================
// 5. DELETAR SERVIÇO
// Usado no painel para remover um serviço
// ============================================
async function deletarServico(servicoId) {
  const { error } = await supabaseClient
    .from('services')
    .delete()
    .eq('id', servicoId);

  if (error) {
    console.error('Erro ao deletar serviço:', error.message);
    return { ok: false, message: 'Erro ao deletar serviço.' };
  }

  console.log('✅ Serviço deletado.');
  return { ok: true };
}

// ============================================
// 6. ATIVAR / DESATIVAR SERVIÇO
// Alternativa ao deletar — só esconde o serviço
// O histórico de agendamentos fica preservado
// ============================================
async function toggleServico(servicoId, ativo) {
  const { error } = await supabaseClient
    .from('services')
    .update({ is_active: ativo })
    .eq('id', servicoId);

  if (error) {
    console.error('Erro ao alterar status do serviço:', error.message);
    return { ok: false, message: 'Erro ao alterar status.' };
  }

  console.log('✅ Serviço', ativo ? 'ativado' : 'desativado');
  return { ok: true };
}

// ============================================
// 7. BUSCAR SERVIÇO POR ID
// Usado para preencher formulário de edição
// ============================================
async function getServicoPorId(servicoId) {
  const { data, error } = await supabaseClient
    .from('services')
    .select('*')
    .eq('id', servicoId)
    .single();

  if (error) {
    console.error('Serviço não encontrado:', error.message);
    return null;
  }

  return data;
}

// ============================================
// 8. FORMATAR PREÇO
// Exibe o preço no formato brasileiro
// Ex: 35.5 → "R$ 35,50"
// ============================================
function formatarPreco(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
}

// ============================================
// 9. FORMATAR DURAÇÃO
// Exibe a duração de forma legível
// Ex: 90 → "1h 30min" | 30 → "30min"
// ============================================
function formatarDuracao(minutos) {
  if (minutos < 60) return `${minutos}min`;
  const h   = Math.floor(minutos / 60);
  const min = minutos % 60;
  return min > 0 ? `${h}h ${min}min` : `${h}h`;
}