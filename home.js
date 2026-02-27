window.Router.register('home', async () => {
  // IMPORTAÇÕES DENTRO DO ESCOPO PARA NÃO ATRAPALHAR A ROTA
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
  const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
  const { getFirestore, doc, getDoc, collection, query, where, onSnapshot, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  // CONFIGURAÇÃO PRIVADA DA ROTA
  const firebaseConfig = {
    apiKey: "AIzaSyDhbzne_klt9ba1B_I04JXykvpslX2aD0k",
    authDomain: "plata4form.firebaseapp.com",
    projectId: "plata4form",
    storageBucket: "plata4form.firebasestorage.app",
    messagingSenderId: "833502821958",
    appId: "1:833502821958:web:2d8899b12ca4bd97b01447"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Controle de estado persistente para os alertas
  if (window.msgCountHome === undefined) window.msgCountHome = null;
  if (window.countEscrita === undefined) window.countEscrita = null;
  if (window.countOral === undefined) window.countOral = null;
  if (window.countGramatica === undefined) window.countGramatica = null;
  if (window.countAuditiva === undefined) window.countAuditiva = null;
  if (window.countSolicitacoes === undefined) window.countSolicitacoes = null;
  if (window.countForum === undefined) window.countForum = null;

  const buscarDadosHome = async () => {
    try {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const elTituloNome = document.getElementById('titulo-nome-usuario');
          const docRef = doc(db, "usuarios", user.uid);
          const docSnap = await getDoc(docRef);
          
          if (elTituloNome) {
            const nomeCompleto = docSnap.exists() ? docSnap.data().nome : (user.displayName || 'Usuário');
            const partesNome = nomeCompleto.trim().split(/\s+/);
            const nomeExibicao = partesNome.length > 1 
              ? `${partesNome[0]} ${partesNome[1]}` 
              : partesNome[0];
            elTituloNome.innerText = `Olá, ${nomeExibicao}!`;
          }

          // --- FUNÇÃO DE PERSISTÊNCIA (PISCAR ATÉ CLICAR) ---
          const verificarAlertaPersistent = (cardId, totalAtual) => {
            const storageKey = `visto_prof_${cardId}_${user.uid}`;
            const ultimoVisto = parseInt(localStorage.getItem(storageKey) || "0");
            const cardEl = document.getElementById(cardId);
            
            if (cardEl) {
              if (totalAtual > ultimoVisto) {
                cardEl.classList.add('blink-verde-ativo');
              } else {
                cardEl.classList.remove('blink-verde-ativo');
              }
            }
          };

          // --- LÓGICA DO PRÓXIMO EVENTO EM TEMPO REAL ---
          const monitorarProximoEvento = () => {
            const containerEvento = document.getElementById('nome-prox-evento');
            const containerData = document.getElementById('data-prox-evento');
            if (!containerEvento) return;

            const qEventos = query(
              collection(db, "eventos"),
              where("professorResponsavelId", "==", user.uid)
            );

            onSnapshot(qEventos, (snap) => {
              const hoje = new Date().setHours(0, 0, 0, 0);
              const proximos = snap.docs
                .map(doc => doc.data())
                .filter(e => new Date(e.data + 'T00:00:00') >= hoje)
                .sort((a, b) => new Date(a.data + 'T00:00:00') - new Date(b.data + 'T00:00:00'));

              if (proximos.length > 0) {
                const prox = proximos[0];
                const [ano, mes, dia] = prox.data.split('-');
                
                // Exibe o título curto/resumo primeiro
                containerEvento.innerText = prox.titulo;
                containerData.innerText = `${dia}/${mes}/${ano}`;

                // Se houver título completo no Storage, faz o download
                if (prox.tituloUrl) {
                  fetch(prox.tituloUrl)
                    .then(r => r.text())
                    .then(textoCompleto => {
                      containerEvento.innerText = textoCompleto;
                    })
                    .catch(err => console.error("Erro ao baixar título do evento:", err));
                }
              } else {
                containerEvento.innerText = "Nenhum evento";
                containerData.innerText = "Agende no calendário";
              }
            });
          };
          monitorarProximoEvento();


          const monitorarAlunosAtivos = () => {
            const turmasQ = query(collection(db, "turmas"), where("professorResponsavelId", "==", user.uid));
            
            onSnapshot(turmasQ, (turmasSnap) => {
              const senhasProfessor = turmasSnap.docs.map(d => 
                (d.data().senha || "").toString().trim().toUpperCase()
              ).filter(s => s !== "");

              const elAlunos = document.getElementById('contagem-alunos');

              if (senhasProfessor.length === 0) {
                if (elAlunos) elAlunos.innerText = "0";
                return;
              }

              // Monitora usuários aprovados e filtra localmente pelas turmas do professor
              const qAprovados = query(
                collection(db, "usuarios"),
                where("status", "==", "aprovado"),
                where("perfil", "==", "Aluno")
              );

              onSnapshot(qAprovados, (snap) => {
                const listaFiltrada = snap.docs.filter(docSnap => {
                  const aluno = docSnap.data();
                  const codAcesso = (aluno.codigoAcesso || aluno.turma || "").toString().trim().toUpperCase();
                  return senhasProfessor.includes(codAcesso);
                });

                if (elAlunos) elAlunos.innerText = listaFiltrada.length;
              });
            });
          };

          // --- MONITORAMENTO EM TEMPO REAL ---
          const monitorarContagem = (colecao, elementoId, queryConstraints = []) => {
            const q = query(collection(db, colecao), ...queryConstraints);
            onSnapshot(q, (snap) => {
              const el = document.getElementById(elementoId);
              if (el) el.innerText = snap.size;
            });
          };

          const monitorarSolicitacoes = () => {
            const turmasQ = query(collection(db, "turmas"), where("professorResponsavelId", "==", user.uid));
            
            onSnapshot(turmasQ, (turmasSnap) => {
              const turmasData = turmasSnap.docs.map(d => ({
                senha: (d.data().senha || "").toString().trim().toUpperCase(),
                id: d.id
              })).filter(t => t.senha !== "");

              const elSoli = document.getElementById('contagem-solicitacoes');

              if (turmasData.length === 0) {
                if (elSoli) elSoli.innerText = "0";
                verificarAlertaPersistent('card-solicitacoes', 0);
                return;
              }

              const senhasProfessor = turmasData.map(t => t.senha);

              // Monitora TODOS os usuários pendentes e filtra localmente para garantir o tempo real
              const qPendentes = query(
                collection(db, "usuarios"),
                where("status", "==", "pendente")
              );

              onSnapshot(qPendentes, (snap) => {
                const listaFiltrada = snap.docs.filter(docSnap => {
                  const aluno = docSnap.data();
                  const codAcesso = (aluno.codigoAcesso || aluno.turma || "").toString().trim().toUpperCase();
                  return senhasProfessor.includes(codAcesso);
                });

                const total = listaFiltrada.length;
                if (elSoli) elSoli.innerText = total;
                window.countSolicitacoes = total;
                verificarAlertaPersistent('card-solicitacoes', total);
              });
            });
          };

          monitorarContagem("turmas", "contagem-turmas", [where("professorResponsavelId", "==", user.uid)]);
          monitorarContagem("atividades_enviadas", "contagem-provas", [where("professorId", "==", user.uid)]);
          monitorarSolicitacoes(); 
          monitorarAlunosAtivos();

          const monitorarGramaticasRecebidas = () => {
            const el = document.getElementById('contagem-gramatica');
            // Buscamos as turmas do professor para saber quais "semestres" monitorar
            const qTurmas = query(collection(db, "turmas"), where("professorResponsavelId", "==", user.uid));

            onSnapshot(qTurmas, (snapTurmas) => {
              // Pegamos o campo 'semestre' das turmas do professor (ex: "1º Semestre")
              const meusSemestres = snapTurmas.docs.map(d => d.data().semestre).filter(s => s);
              
              if (meusSemestres.length === 0) {
                if (el) el.innerText = "0";
                window.countGramatica = 0;
                return;
              }

              const qRespostas = query(
                collection(db, "respostas_alunos"), 
                where("tipo", "==", "gramatica"),
                where("semestre", "in", meusSemestres)
              );

              onSnapshot(qRespostas, (snapRes) => {
                const card = document.getElementById('card-gramatica');
                const total = snapRes.size;

                if (window.countGramatica !== null && total > window.countGramatica) {
                  if (card) {
                    card.classList.remove('blink-verde-ativo');
                    void card.offsetWidth;
                    card.classList.add('blink-verde-ativo');
                  }
                }

                if (el) el.innerText = total;
                window.countGramatica = total;
                verificarAlertaPersistent('card-gramatica', total);
              });
            });
          };
          monitorarGramaticasRecebidas();

          const monitorarAuditivasRecebidas = () => {
            const el = document.getElementById('contagem-auditiva');
            if (el) el.innerText = "0"; // Garante o zero inicial no lugar das reticências

            const qTurmas = query(collection(db, "turmas"), where("professorResponsavelId", "==", user.uid));
            
            onSnapshot(qTurmas, (snapTurmas) => {
              const minhasTurmas = snapTurmas.docs.map(d => d.data().senha).filter(s => s);
              
              if (minhasTurmas.length === 0) {
                if (el) el.innerText = "0";
                window.countAuditiva = 0;
                return;
              }

              const qRespostas = query(
                collection(db, "respostas_alunos"), 
                where("tipo", "==", "auditiva"),
                where("turma", "in", minhasTurmas)
              );

              onSnapshot(qRespostas, (snapRes) => {
                const card = document.getElementById('card-auditiva');
                const total = snapRes.size;

                // Verifica se aumentou para disparar o pisca verde
                if (window.countAuditiva !== null && total > window.countAuditiva) {
                  if (card) {
                    card.classList.remove('blink-verde-ativo');
                    void card.offsetWidth; // Força reflow para reiniciar animação
                    card.classList.add('blink-verde-ativo');
                  }
                }

                if (el) el.innerText = total;
                window.countAuditiva = total;
                verificarAlertaPersistent('card-auditiva', total);
              });
            });
          };
          monitorarAuditivasRecebidas();
          
          const monitorarComentariosForumPrivado = () => {
            const qTopicos = query(collection(db, "forum_topicos"), where("autorId", "==", user.uid));
            onSnapshot(qTopicos, (snapTopicos) => {
              const idsTopicosProfessor = snapTopicos.docs.map(d => d.id);
              const el = document.getElementById('contagem-forum');
              if (idsTopicosProfessor.length === 0) {
                if (el) el.innerText = "0";
                window.countForum = 0;
                verificarAlertaPersistent('card-forum', 0);
                return;
              }
              const qComentarios = query(collection(db, "forum_comentarios"));
              onSnapshot(qComentarios, (snapCom) => {
                const total = snapCom.docs.filter(d => idsTopicosProfessor.includes(d.data().topicoId)).length;
                if (el) el.innerText = total;
                window.countForum = total;
                verificarAlertaPersistent('card-forum', total);
              });
            });
          };
          monitorarComentariosForumPrivado();

          const monitorarEscritasRecebidas = () => {
            const q = query(collection(db, "respostas_alunos"), where("professorResponsavelId", "==", user.uid), where("tipo", "==", "escrita"), where("status", "==", "pendente"));
            onSnapshot(q, (snap) => {
              const el = document.getElementById('contagem-escrita');
              const total = snap.size;
              if (el) el.innerText = total;
              window.countEscrita = total;
              verificarAlertaPersistent('card-escrita', total);
            });
          };
          monitorarEscritasRecebidas();

          const monitorarOraisRecebidas = () => {
            const q = query(collection(db, "respostas_alunos"), where("professorId", "==", user.uid), where("tipo", "==", "oral"));
            onSnapshot(q, (snap) => {
              const el = document.getElementById('contagem-oral');
              const total = snap.size;
              if (el) el.innerText = total;
              window.countOral = total;
              verificarAlertaPersistent('card-oral', total);
            });
          };
          monitorarOraisRecebidas();

          const containerPaiMsg = document.getElementById('wrapper-mensagens');
          if (containerPaiMsg) {
            containerPaiMsg.style.display = snapMsg.empty ? 'none' : 'block';
            renderizarMensagensHome(snapMsg);
          }
        }
      });
    } catch (erro) { console.error("Erro no Firestore:", erro); }
  };

  window.acessarAtividade = (cardId, rota) => {
    const user = auth.currentUser;
    if (user) {
      const contagemElemento = document.querySelector(`#${cardId} strong`);
      const valorAtual = contagemElemento ? contagemElemento.innerText : "0";
      localStorage.setItem(`visto_prof_${cardId}_${user.uid}`, valorAtual);
    }
    const card = document.getElementById(cardId);
    if (card) card.classList.remove('blink-verde-ativo');
    
    if (cardId === 'card-alunos-ativos') {
      localStorage.setItem('aba_inicial_alunos', 'ativos');
    } else if (cardId === 'card-solicitacoes') {
      localStorage.setItem('aba_inicial_alunos', 'solicitacoes');
    } else if (cardId === 'card-forum') {
      setTimeout(() => {
        if (typeof window.mudarAbaForum === 'function') {
          window.mudarAbaForum('mural');
        }
      }, 300);
    }
    
    window.location.hash = rota;

   if (rota === '#auditivaprofessorclm' || rota === '#gramaticaprofessorclm' || rota === '#oralprofessorclm' || rota === '#escritaprofessorclm' || rota === '#turmas' || rota === '#mensagens') {
      setTimeout(() => {
        if (rota === '#auditivaprofessorclm' && typeof window.switchMainTabAud === 'function') window.switchMainTabAud('recebidas');
        if (rota === '#gramaticaprofessorclm' && typeof window.switchMainTabGram === 'function') window.switchMainTabGram('recebidas');
        if (rota === '#oralprofessorclm' && typeof window.switchMainTabOral === 'function') window.switchMainTabOral('recebidas');
        if (rota === '#escritaprofessorclm' && typeof window.switchMainTabEscrita === 'function') window.switchMainTabEscrita('recebidas');
        if (rota === '#turmas' && typeof window.switchTab === 'function') window.switchTab('lista');
        if (rota === '#mensagens') {
          const filtro = (cardId === 'card-msg-enviadas') ? 'enviadas' : 'recebidas';
          localStorage.setItem('filtro_inicial_mensagens', filtro);
          if (typeof window.alternarAbasMensagens === 'function') {
            window.alternarAbasMensagens(filtro);
          }
        }
      }, 300);
    }
  };

  const renderizarMensagensHome = (snap) => {
    const container = document.getElementById('lista-mensagens-home');
    if (!container) return;
    container.innerHTML = snap.docs.slice(0, 2).map(doc => {
      const m = doc.data();
      return `<div class="item-acao"><div><strong>${m.assunto || 'Mensagem'}</strong><br><small>${m.remetente || 'Aluno'}</small></div><button class="btn-acao btn-read" onclick="window.location.hash='#mensagens'">Ler</button></div>`;
    }).join('');
  };

  setTimeout(() => { buscarDadosHome(); }, 100);

  return `
    <style>
      .header-prof { width: 100%; margin-bottom: 25px; }
      .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; width: 100%; }
      .stat-card { 
        background: #fff; padding: 20px; border-radius: 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); 
        display: flex; flex-direction: column; height: 140px; width: 100%; max-width: 280px; 
        box-sizing: border-box; border-top: 6px solid #003058; transition: 0.3s; position: relative; overflow: hidden; 
      }
      .stat-card.clickable { cursor: pointer; }
      .stat-card.clickable:hover { transform: translateY(-3px); }
      .blink-verde-ativo { animation: pulse-green 1s infinite !important; border-top-color: #22c55e !important; box-shadow: 0 0 15px rgba(34, 197, 94, 0.4) !important; }
      @keyframes pulse-green { 0% { background: #ffffff; } 50% { background: #dcfce7; } 100% { background: #ffffff; } }
      .stat-card span { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      .stat-card strong { font-size: 1.8rem; color: #003058; margin-top: 5px; font-weight: 800; }
      .stat-card .event-date { font-size: 0.85rem; color: #004b87; font-weight: 600; margin-top: 5px; }
      .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
      .card-dash { background: #fff; padding: 20px; border-radius: 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
      .card-dash h3 { color: #003058; font-size: 0.95rem; margin-bottom: 15px; border-bottom: 2px solid #f4f7f6; padding-bottom: 8px; text-transform: uppercase; font-weight: 800; margin-top:0; }
      .item-acao { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
      .btn-acao { border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.7rem; font-weight: 700; }
      .btn-read { background: #e0f2fe; color: #0369a1; }
      @media (max-width: 1024px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr; } .stat-card { max-width: 100%; } }
    </style>

    <div class="header-prof">
      <h1 id="titulo-nome-usuario" style="text-transform: uppercase; font-weight: 800; color: #003058; margin:0;">CARREGANDO...</h1>
      <p style="color: #64748b; font-weight: 500; font-size: 1.1rem; margin: 5px 0;">Bom trabalho hoje!</p>
    </div>

    <hr style="border:0; border-top:2px solid #f1f5f9; margin: 20px 0 30px 0;">

   <div class="stats-grid">
      <div class="stat-card clickable" id="card-solicitacoes" onclick="window.acessarAtividade('card-solicitacoes', '#alunos')">
        <span>Convites Pendentes</span>
        <strong id="contagem-solicitacoes">...</strong>
      </div>
      <div class="stat-card clickable" id="card-alunos-ativos" onclick="window.acessarAtividade('card-alunos-ativos', '#alunos')">
        <span>Alunos Ativos</span>
        <strong id="contagem-alunos">...</strong>
      </div>
      <div class="stat-card clickable" id="card-turmas" onclick="window.acessarAtividade('card-turmas', '#turmas')">
        <span>Total de Turmas</span>
        <strong id="contagem-turmas">...</strong>
      </div>
      <div class="stat-card clickable" onclick="window.location.hash='#calendario'">
        <span>Próximo Evento</span>
       <strong id="nome-prox-evento" style="font-size: 0.9rem; margin-top: 5px; display: block; line-height: 1.2; word-wrap: break-word; white-space: normal;">...</strong>
        <div id="data-prox-evento" class="event-date">...</div>
      </div>
    <div class="stat-card clickable" id="card-escrita" onclick="window.acessarAtividade('card-escrita', '#escritaprofessorclm')">
        <span>Escritas recebidas</span>
        <strong id="contagem-escrita">0</strong>
      </div>
      <div class="stat-card clickable" id="card-oral" onclick="window.acessarAtividade('card-oral', '#oralprofessorclm')">
        <span>Orais recebidas</span>
        <strong id="contagem-oral">0</strong>
      </div>
      <div class="stat-card clickable" id="card-gramatica" onclick="window.acessarAtividade('card-gramatica', '#gramaticaprofessorclm')">
        <span>Gramáticas recebidas</span>
        <strong id="contagem-gramatica">0</strong>
      </div>
      <div class="stat-card clickable" id="card-auditiva" onclick="window.acessarAtividade('card-auditiva', '#auditivaprofessorclm')">
        <span>Auditivas recebidas</span>
        <strong id="contagem-auditiva">0</strong>
      </div>
      <div class="stat-card clickable" id="card-forum" onclick="window.acessarAtividade('card-forum', '#forumprofessorclm')">
        <span>Fórum</span>
        <strong id="contagem-forum">0</strong>
      </div>

    <div class="dashboard-grid">
      <div class="card-dash" id="wrapper-mensagens" style="display:none;">
        <h3><i class="fa-solid fa-bullhorn"></i> Avisos Recentes</h3>
        <div id="lista-mensagens-home"></div>
      </div>
    </div>
  `;
});