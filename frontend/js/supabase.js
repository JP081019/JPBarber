// ============================================
// JP Barber | JP Dev Soluções Digitais
// js/supabase.js — conexão com o Supabase
// ============================================

// ---- CONFIGURAÇÃO ----
const SUPABASE_URL = 'https://mjjwimqjrsqtogdmyxow.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qandpbXFqcnNxdG9nZG15eG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTg3MDMsImV4cCI6MjA5MTY3NDcwM30.tTLnYQrFrnmpGn63Qt8uGYNltv30n1cO3gDauJdmvH8';

// ---- CLIENTE SUPABASE ----
// Usamos o nome 'supabaseClient' para não conflitar
// com a variável global 'supabase' que o SDK já cria.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- TESTE DE CONEXÃO ----
// Confirma que o banco está acessível.
// Pode remover em produção.
(async function testarConexao() {
  const { data, error } = await supabaseClient.from('plans').select('name');
  if (error) {
    console.error('❌ Erro na conexão com Supabase:', error.message);
  } else {
    console.log('✅ Supabase conectado! Planos:', data.map(p => p.name));
  }
})();