Router.register('correcao', async () => {
  return `
    <div class="header-prof">
      <h1>Corrigir Provas</h1>
      <p>Gerencie as entregas e realize a correção das avaliações.</p>
    </div>
    
    <hr class="divisor">
    
    <div class="dashboard-grid" style="display: grid; grid-template-columns: 1fr; gap: 25px;">
      
      <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; text-align: center;">
        <div style="background: #f7fafc; color: #a0aec0; width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; border: 2px dashed #cbd5e0;">
          <i class="fa-solid fa-person-digging" style="font-size: 2.5rem;"></i>
        </div>
        
        <h2 style="color: #2d3748; margin-bottom: 12px;">Página em Desenvolvimento</h2>
        <p style="color: #718096; max-width: 450px; line-height: 1.6; font-size: 1.1rem;">
          Esta funcionalidade está sendo preparada para melhorar o seu fluxo de correções. 
          Em breve, o módulo de gestão de notas estará disponível.
        </p>
      </div>

    </div>
  `;
});