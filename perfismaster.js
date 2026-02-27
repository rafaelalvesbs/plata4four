window.Router.register('perfismaster', async () => {
  const db = window.db;
  const { collection, query, where, getDocs, updateDoc, doc, deleteDoc } = window.fsMethods;

  let paginaAtual = 1;
  const itensPorPagina = 7;
  let totalSolicitacoesMaster = [];

  // --- RENDERIZAÇÃO DA LISTA ---
  window.renderizarPaginaPerfis = () => {
    const container = document.getElementById('lista-solicitacoes-master');
    if (!container) return;

    // Se não houver convites aceitos (com nome preenchido), fica em branco
    if (totalSolicitacoesMaster.length === 0) {
      container.innerHTML = "";
      return;
    }

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensExibidos = totalSolicitacoesMaster.slice(inicio, fim);
    const totalPaginas = Math.ceil(totalSolicitacoesMaster.length / itensPorPagina);

    let html = `<div class="lista-vertical">`;
    
    itensExibidos.forEach(user => {
      html += `
        <div class="card-item-horizontal" style="border-left: 5px solid #003058; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
          <div class="info-linha" style="display: flex; align-items: center; flex: 1; gap: 20px; overflow: hidden;">
            
            <div style="flex: 2; display: flex; align-items: center; gap: 10px; overflow: hidden;">
              <strong style="color: #1e293b; font-size: 0.85rem; white-space: nowrap; text-overflow: ellipsis; min-width: fit-content;">
                ${(() => {
                  const partes = (user.nome || "").trim().split(/\s+/);
                  return partes.length > 1 ? `${partes[0]} ${partes[1]}` : partes[0];
                })()}
              </strong>
              <span style="font-size: 0.75rem; color: #64748b; white-space: nowrap; text-overflow: ellipsis;">• ${user.email}</span>
            </div>

            <div style="flex: 0.8; color: #004b87; font-weight: 600; font-size: 0.85rem; text-align: center;">
               ${user.perfil}
            </div>

            <div style="flex: 1; color: #94a3b8; font-size: 0.75rem; text-align: right; white-space: nowrap;">
              <i class="fa-regular fa-calendar"></i> ${user.dataF}
            </div>

          </div>

          <div class="card-acoes" style="display: flex; align-items: center; gap: 15px; margin-left: 20px;">
            <button class="btn-aprovar-blue" onclick="window.aprovarPerfilMaster('${user.id}')" style="white-space: nowrap; background: #003058; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.75rem;">Aprovar</button>
            <button class="btn-excluir-icon" onclick="window.excluirRegistroMaster('${user.id}')" style="font-size: 1.2rem; background: none; color: #dc2626; border: none; cursor: pointer; opacity: 0.6;"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>`;
    });
    html += `</div>`;

    if (totalPaginas > 1) {
      html += `
        <div style="display:flex; justify-content:center; align-items:center; gap:15px; margin-top:20px; padding:10px;">
          <button onclick="window.mudarPaginaMasterPerfis(-1)" ${paginaAtual === 1 ? 'disabled style="opacity:0.3"' : 'style="cursor:pointer; background:none; border:none; color:#003058; font-size:1.2rem;"'}><i class="fa-solid fa-chevron-left"></i></button>
          <span style="font-weight:800; color:#003058; font-size:0.9rem;">${paginaAtual} / ${totalPaginas}</span>
          <button onclick="window.mudarPaginaMasterPerfis(1)" ${paginaAtual === totalPaginas ? 'disabled style="opacity:0.3"' : 'style="cursor:pointer; background:none; border:none; color:#003058; font-size:1.2rem;"'}><i class="fa-solid fa-chevron-right"></i></button>
        </div>`;
    }
    container.innerHTML = html;
  };

  window.carregarSolicitacoesMaster = async () => {
    const container = document.getElementById('lista-solicitacoes-master');
    if (!container) return;
    
    try {
      // Busca usuários pendentes dos perfis master
      const q = query(
        collection(db, "usuarios"), 
        where("status", "==", "pendente"), 
        where("perfil", "in", ["Diretor", "Coordenador", "Professor"])
      );
      
      const snap = await getDocs(q);

      // LÓGICA DO CONVITE: Só mostra se o campo 'nome' não estiver vazio
      // Isso ignora os códigos recém-gerados que ainda não foram preenchidos
     const convitesAceitos = snap.docs
        .map(docSnap => {
          const dados = docSnap.data();
          const dataObj = dados.dataCriacao && dados.dataCriacao.seconds ? new Date(dados.dataCriacao.seconds * 1000) : new Date();
          const usuario = { id: docSnap.id, ...dados, dataF: dataObj.toLocaleDateString('pt-BR') };

          // Se houver nome longo no Storage, baixa e atualiza a lista dinamicamente
          if (dados.nomeCompletoUrl) {
            fetch(dados.nomeCompletoUrl)
              .then(r => r.text())
              .then(nomeLongo => {
                const alvo = totalSolicitacoesMaster.find(u => u.id === usuario.id);
                if (alvo) {
                  alvo.nome = nomeLongo;
                  window.renderizarPaginaPerfis();
                }
              })
              .catch(err => console.error("Erro ao baixar nome longo:", err));
          }
          return usuario;
        })
        .filter(u => u.nome && u.nome.trim() !== "");

      totalSolicitacoesMaster = convitesAceitos;
      window.renderizarPaginaPerfis();
    } catch (e) { 
      console.error("Erro ao carregar convites:", e);
    }
  };

  window.mudarPaginaMasterPerfis = (dir) => { 
    paginaAtual += dir; 
    window.renderizarPaginaPerfis(); 
  };

  window.aprovarPerfilMaster = (id) => {
    const modal = document.getElementById('modalAprovarMaster');
    const btnConfirmar = document.getElementById('btnConfirmarAprovarMaster');
    modal.style.display = 'flex';

    btnConfirmar.onclick = async () => {
      try {
        const userRef = doc(db, "usuarios", id);
        await updateDoc(userRef, {
          status: 'aprovado',
          dataAprovacao: new Date()
        });
        document.getElementById('modalAprovarMaster').style.display = 'none';
        window.carregarSolicitacoesMaster();
      } catch (e) {
        alert("Erro ao aprovar.");
      }
    };
  };

  window.excluirRegistroMaster = async (id) => {
    if(confirm("Deseja recusar esta solicitação?")) {
        await deleteDoc(doc(db, "usuarios", id));
        window.carregarSolicitacoesMaster();
    }
  };

  setTimeout(() => window.carregarSolicitacoesMaster(), 50);

  return `
    <style>
      .lista-vertical { display: flex; flex-direction: column; gap: 8px; padding: 10px; }
      .card-item-horizontal { box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: 0.2s; }
      .btn-excluir-icon:hover { opacity: 1 !important; }
      .modal-overlay-master { position:fixed; inset:0; background:rgba(15, 23, 42, 0.7); z-index:10002; display:none; align-items:center; justify-content:center; backdrop-filter: blur(6px); }
      .modal-box-master { background:white; width:90%; max-width:380px; padding:32px; border-radius:28px; text-align:center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); }
    </style>

    <div class="header-prof">
      <h1>Solicitações de Acesso</h1>
      <p style="color: #64748b;">Aprove novos perfis administrativos que utilizaram um código de convite.</p>
    </div>
    <hr class="divisor" style="margin: 15px 0;">

    <div id="lista-solicitacoes-master"></div>

    <div id="modalAprovarMaster" class="modal-overlay-master">
      <div class="modal-box-master">
        <div style="background:#f0f7ff; width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin: 0 auto 20px; border: 1px solid #003058;">
          <i class="fa-solid fa-user-shield" style="color:#003058; font-size:1.6rem;"></i>
        </div>
        <h3 style="color:#0f172a; margin-bottom:10px; font-size:1.3rem; font-weight:800;">Liberar Acesso?</h3>
        <p style="color:#64748b; font-size:0.95rem; line-height:1.6; margin-bottom:28px;">O usuário terá permissões administrativas no sistema.</p>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <button id="btnConfirmarAprovarMaster" style="width:100%; padding:15px; border-radius:16px; border:none; background:#003058; color:white; font-weight:700; cursor:pointer;">Confirmar e Liberar</button>
          <button onclick="document.getElementById('modalAprovarMaster').style.display='none'" style="width:100%; padding:14px; border-radius:16px; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-weight:600; cursor:pointer;">Agora não</button>
        </div>
      </div>
    </div>
  `;
});