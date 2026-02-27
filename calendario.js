window.Router.register('calendario', async () => {
    let dataAtual = new Date();
    let paginaEvento = 0;
    const ITENS_POR_PAGINA = 4;
    const azulPadrao = "#003058";
    let eventosCache = [];

    // --- LÓGICA DE SALVAMENTO ---
    window.confirmarSalvamentoCal = async (data, idEdicao) => {
        const input = document.getElementById('input-titulo-cal');
        const errorDiv = document.getElementById('error-msg-cal');
        const titulo = input ? input.value.trim() : "";
        
        if (errorDiv) errorDiv.innerText = "";

        if (!titulo) {
            if (errorDiv) errorDiv.innerText = "⚠️ Digite um título para o evento.";
            input.style.borderColor = "#ef4444";
            return;
        }

        const btnConfirmar = document.querySelector("#modal-agendar-cal button[onclick*='confirmarSalvamentoCal']");
        const originalText = btnConfirmar ? btnConfirmar.innerText : "Confirmar";

        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerText = "Salvando...";
            btnConfirmar.style.opacity = "0.7";
            btnConfirmar.style.cursor = "not-allowed";
        }

        try {
            const sucesso = await salvarEvento(data, titulo, idEdicao);
            
            if (sucesso) {
                const modal = document.getElementById('modal-agendar-cal');
                if (modal) modal.remove();
            } else {
                throw new Error("Erro na resposta do servidor");
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            
            if (errorDiv) {
                errorDiv.innerText = !navigator.onLine 
                    ? "🌐 Sem conexão com a internet." 
                    : "❌ Erro ao conectar ao banco de dados.";
            }

            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerText = originalText;
                btnConfirmar.style.opacity = "1";
                btnConfirmar.style.cursor = "pointer";
            }
        }
    };

    const buscarEventosFirebase = async () => {
        const auth = window.authMethods.getAuth();
        const user = auth.currentUser;

        if (!window.db || !user) {
            setTimeout(buscarEventosFirebase, 1000);
            return;
        }
        
        const { collection, getDocs, query, where } = window.fsMethods;
        
        try {
            const colRef = collection(window.db, "eventos");
            const q = query(
                colRef, 
                where("professorResponsavelId", "==", user.uid)
            );
            
            const snapshot = await getDocs(q);
            
            eventosCache = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => a.data.localeCompare(b.data));
            
            atualizarCalendarioCompleto();
        } catch (error) {
            console.error("Erro ao buscar eventos:", error);
            atualizarCalendarioCompleto();
        }
    };

    const salvarEvento = async (data, titulo, idEdicao = null) => {
        const auth = window.authMethods.getAuth();
        const user = auth.currentUser;

        if (!window.db || !user) return false;
        const { collection, addDoc, doc, updateDoc, serverTimestamp } = window.fsMethods;
        const { getStorage, ref, uploadBytes, getDownloadURL } = window.storageMethods;
        
        try {
            const storage = getStorage();
            const blob = new Blob([titulo], { type: 'text/plain' });
            const caminho = `calendario_eventos/${user.uid}_${Date.now()}.txt`;
            const storageRef = ref(storage, caminho);
            
            await uploadBytes(storageRef, blob);
            const urlTitulo = await getDownloadURL(storageRef);

            const colRef = collection(window.db, "eventos");
            const payload = {
                titulo: titulo.substring(0, 100), // Resumo para exibição rápida
                tituloUrl: urlTitulo,
                tituloPath: caminho,
                data: data,
                professorResponsavelId: user.uid,
                atualizadoEm: serverTimestamp()
            };

            if (idEdicao && idEdicao !== 'null') {
                const docRef = doc(window.db, "eventos", idEdicao);
                await updateDoc(docRef, payload);
            } else {
                payload.criadoEm = serverTimestamp();
                await addDoc(colRef, payload);
            }
            
            await buscarEventosFirebase();
            return true;
        } catch (error) {
            console.error("Erro ao salvar no Storage/Firestore:", error);
            return false;
        }
    };

    window.executarExclusaoCal = async (id) => {
        if (!window.db || !window.usuarioLogado) return;
        const { doc, deleteDoc } = window.fsMethods;
        
        const btnExcluir = document.querySelector("#modal-confirm-cal button[onclick*='executarExclusaoCal']");
        
        if (btnExcluir) {
            btnExcluir.disabled = true;
            btnExcluir.innerText = "Excluindo...";
            btnExcluir.style.opacity = "0.7";
            btnExcluir.style.cursor = "not-allowed";
        }

        try {
            const docRef = doc(window.db, "eventos", id);
            await deleteDoc(docRef);
            
            // Aplica o efeito visual no item da lista antes de atualizar tudo
            const itemLista = document.getElementById(`titulo-ev-${id}`)?.closest('div[style*="border-left"]');
            if (itemLista) {
                itemLista.classList.add('fade-out-cal');
            }

            // Pequeno delay para a animação de fade-out completar antes de sumir com o modal e atualizar
            setTimeout(async () => {
                document.getElementById('modal-confirm-cal')?.remove();
                await buscarEventosFirebase();
            }, 400);

        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir o evento.");
            if (btnExcluir) {
                btnExcluir.disabled = false;
                btnExcluir.innerText = "Sim, Remover";
                btnExcluir.style.opacity = "1";
                btnExcluir.style.cursor = "pointer";
            }
        }
    };

    // --- MODAIS ---
    window.abrirAgendador = (dataSugestao = '', idEdicao = null) => {
        const data = dataSugestao || new Date().toISOString().split('T')[0];
        let tituloAtual = "";
        const idLimpo = (idEdicao && idEdicao !== 'null' && idEdicao !== 'undefined') ? idEdicao : null;

        if (idLimpo) {
            const ev = eventosCache.find(e => e.id === idLimpo);
            if (ev) tituloAtual = ev.titulo;
        }

        const modalAddHTML = `
          <div id="modal-agendar-cal" onclick="if(event.target === this) this.remove()" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,48,88,0.4); display:flex; justify-content:center; align-items:center; z-index:10000; padding:20px; backdrop-filter: blur(6px); animation: fadeInCal 0.2s ease; cursor:pointer;">
            <div style="background:white; padding:30px; border-radius:20px; max-width:400px; width:100%; box-shadow:0 20px 40px rgba(0,0,0,0.2); transform: scale(0.9); animation: scaleUpCal 0.2s forwards; cursor:default;">
              <div style="background:#e0f2fe; color:#0077cc; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px auto; font-size:1.5rem;">
                <i class="fa-solid fa-calendar-plus"></i>
              </div>
              <h3 style="color:${azulPadrao}; margin:0 0 10px 0; font-size:1.2rem; font-weight:800; text-align:center;">${idLimpo ? 'Editar Evento' : 'Novo Evento'}</h3>
              <p style="color:#64748b; font-size:0.9rem; text-align:center; margin-bottom:20px;">Para o dia: ${data.split('-').reverse().join('/')}</p>
              <input type="text" id="input-titulo-cal" value="${tituloAtual}" placeholder="Ex: Aula de conversação..." autocomplete="off" style="width:100%; padding:14px; border-radius:12px; border:2px solid #e2e8f0; margin-bottom:10px; outline:none; font-family:inherit; font-size:1rem; box-sizing:border-box;">
              <div id="error-msg-cal" style="color: #ef4444; font-size: 0.8rem; text-align: center; margin-bottom: 15px; min-height: 1.2rem; font-weight: 600;"></div>
              <div style="display:flex; gap:12px;">
                <button onclick="document.getElementById('modal-agendar-cal').remove()" style="flex:1; padding:12px; background:#f1f5f9; color:#64748b; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Cancelar</button>
                <button onclick="window.confirmarSalvamentoCal('${data}', '${idLimpo}')" style="flex:1; padding:12px; background:${azulPadrao}; color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700; box-shadow:0 4px 12px rgba(0,48,88,0.2);">Confirmar</button>
              </div>
            </div>
          </div>
          <style>
            #input-titulo-cal:focus { border-color: #004aad; }
            @keyframes fadeInCal { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleUpCal { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          </style>`;
        document.body.insertAdjacentHTML('beforeend', modalAddHTML);
        
        const input = document.getElementById('input-titulo-cal');
        const modal = document.getElementById('modal-agendar-cal');

        // Atalhos de teclado
        const tratarTeclado = (e) => {
            if (e.key === 'Enter') {
                window.confirmarSalvamentoCal(data, idLimpo);
            }
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', tratarTeclado);
            }
        };

        document.addEventListener('keydown', tratarTeclado);
        
        // Remove o event listener quando o modal é fechado de outras formas (clique ou cancelar)
        const observer = new MutationObserver(() => {
            if (!document.getElementById('modal-agendar-cal')) {
                document.removeEventListener('keydown', tratarTeclado);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });

        setTimeout(() => input.focus(), 100);
    };

    window.excluirEvento = (id) => {
        const modalConfirmHTML = `
          <div id="modal-confirm-cal" onclick="if(event.target === this) this.remove()" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,48,88,0.4); display:flex; justify-content:center; align-items:center; z-index:10000; padding:20px; backdrop-filter: blur(6px); animation: fadeInCal 0.2s ease; cursor:pointer;">
            <div style="background:white; padding:30px; border-radius:20px; max-width:400px; width:100%; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.2); transform: scale(0.9); animation: scaleUpCal 0.2s forwards;">
              <div style="background:#fee2e2; color:#ef4444; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px auto; font-size:1.5rem;">
                <i class="fa-solid fa-calendar-xmark"></i>
              </div>
              <h3 style="color:${azulPadrao}; margin:0 0 10px 0; font-size:1.2rem; font-weight:800;">Remover Evento?</h3>
              <p style="color:#64748b; font-size:0.9rem; line-height:1.5; margin-bottom:25px;">Esta ação não pode ser desfeita.</p>
              <div style="display:flex; gap:12px;">
                <button onclick="document.getElementById('modal-confirm-cal').remove()" style="flex:1; padding:12px; background:#f1f5f9; color:#64748b; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Cancelar</button>
                <button onclick="window.executarExclusaoCal('${id}')" style="flex:1; padding:12px; background:#ef4444; color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700; box-shadow:0 4px 12px rgba(239,68,68,0.2);">Sim, Remover</button>
              </div>
            </div>
          </div>`;
        document.body.insertAdjacentHTML('beforeend', modalConfirmHTML);

        const modalConfirm = document.getElementById('modal-confirm-cal');
        const fecharNoEsc = (e) => {
            if (e.key === 'Escape') {
                modalConfirm.remove();
                document.removeEventListener('keydown', fecharNoEsc);
            }
        };
        document.addEventListener('keydown', fecharNoEsc);

        const observerConfirm = new MutationObserver(() => {
            if (!document.getElementById('modal-confirm-cal')) {
                document.removeEventListener('keydown', fecharNoEsc);
                observerConfirm.disconnect();
            }
        });
        observerConfirm.observe(document.body, { childList: true });
    };

    // --- NAVEGAÇÃO ---
    window.navegarMes = (direcao) => {
        dataAtual.setMonth(dataAtual.getMonth() + direcao);
        atualizarCalendarioCompleto();
    };

    window.mudarPaginaEvento = (direcao) => {
        paginaEvento += direcao;
        renderizarListaEventos();
    };

    // --- RENDERIZAÇÃO ---
    const renderizarListaEventos = () => {
        const container = document.getElementById('lista-eventos-dinamica');
        const paginacao = document.getElementById('paginacao-eventos');
        const indicador = document.getElementById('indicador-paginas');
        if (!container) return;

        const hoje = new Date().setHours(0,0,0,0);
        const futuros = eventosCache
            .filter(e => new Date(e.data + 'T00:00:00') >= hoje)
            .sort((a, b) => new Date(a.data + 'T00:00:00') - new Date(b.data + 'T00:00:00'));
        
        const totalPaginas = Math.ceil(futuros.length / ITENS_POR_PAGINA);
        if (paginaEvento >= totalPaginas && totalPaginas > 0) paginaEvento = totalPaginas - 1;
        if (paginaEvento < 0) paginaEvento = 0;

        if (paginacao) paginacao.style.display = futuros.length > ITENS_POR_PAGINA ? 'flex' : 'none';
        if (indicador) indicador.innerText = `${paginaEvento + 1} / ${totalPaginas || 1}`;
        
        const exibidos = futuros.slice(paginaEvento * ITENS_POR_PAGINA, (paginaEvento * ITENS_POR_PAGINA) + ITENS_POR_PAGINA);
        
        if (exibidos.length === 0) {
            container.innerHTML = '<p style="font-size:0.8rem; color:#64748b; text-align:center; padding: 20px;">Nenhum evento agendado.</p>';
            return;
        }
        
        container.innerHTML = '';
        for (const ev of exibidos) {
            const [ano, mes, dia] = ev.data.split('-');
            const d = new Date(ano, mes - 1, dia);
            const mesNome = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            
const item = document.createElement('div');
            item.className = "fade-in-smooth";
            item.style = "border-left: 4px solid #004aad; padding: 12px; background: #f8fafc; border-radius: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.02);";
            
            item.innerHTML = `
                <div>
                    <p id="titulo-ev-${ev.id}" style="font-weight: 700; font-size: 0.85rem; color: #003058; margin:0;">${ev.titulo}</p>
                    <p style="font-size: 0.7rem; color: #64748b; margin:0; text-transform: uppercase; font-weight:600;">${dia} ${mesNome}</p>
                </div>
                <div style="display: flex; gap: 12px;">
                    <i class="fa-solid fa-pen" onclick="window.abrirAgendador('${ev.data}', '${ev.id}')" style="cursor:pointer; color: #94a3b8; font-size:0.85rem;"></i>
                    <i class="fa-solid fa-trash" onclick="window.excluirEvento('${ev.id}')" style="cursor:pointer; color: #ef4444; font-size:0.85rem;"></i>
                </div>`;
            
            container.appendChild(item);

            // Se houver URL no Storage, baixa o texto real para substituir o resumo
            if (ev.tituloUrl) {
                fetch(ev.tituloUrl).then(r => r.text()).then(t => {
                    const p = document.getElementById(`titulo-ev-${ev.id}`);
                    if (p) p.innerText = t;
                }).catch(err => console.error("Erro ao baixar título longo"));
            }
        }
    };

    const renderizarDias = () => {
        const elGrid = document.getElementById('corpo-calendario');
        if (!elGrid) return;
        const ano = dataAtual.getFullYear();
        const mes = dataAtual.getMonth();
        const primeiroDiaMes = new Date(ano, mes, 1).getDay();
        const diasNoMes = new Date(ano, mes + 1, 0).getDate();
        const hoje = new Date().setHours(0,0,0,0);
        
        let html = '<tr>';
        for (let i = 0; i < primeiroDiaMes; i++) html += '<td></td>';
        for (let dia = 1; dia <= diasNoMes; dia++) {
            if ((primeiroDiaMes + dia - 1) % 7 === 0 && dia > 1) html += '</tr><tr>';
            const dataISO = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            const dataComp = new Date(ano, mes, dia).getTime();
            const temEvento = eventosCache.some(e => e.data === dataISO);
            const isToday = dataComp === hoje;
            const isPast = dataComp < hoje;
            html += `
                <td onclick="${isPast ? '' : `window.abrirAgendador('${dataISO}')`}" 
                    class="fade-in-smooth"
                    style="padding: 15px; font-weight: 700; position: relative; cursor: ${isPast ? 'default' : 'pointer'}; ${isToday ? 'background:#004aad; color:white; border-radius:12px; box-shadow:0 4px 10px rgba(0,74,173,0.3);' : ''} ${isPast ? 'opacity:0.3;' : ''}">
                    ${dia}
                    ${temEvento && !isToday ? '<div style="width:5px; height:5px; background:#004aad; border-radius:50%; position:absolute; bottom:5px; left:50%; transform:translateX(-50%);"></div>' : ''}
                </td>`;
        }
        html += '</tr>';
        elGrid.innerHTML = html;
    };

    const atualizarCalendarioCompleto = () => {
        const elTitulo = document.getElementById('titulo-mes-ano');
        if (elTitulo) {
            const mesNome = dataAtual.toLocaleDateString('pt-BR', { month: 'long' });
            const anoNome = dataAtual.getFullYear();
            elTitulo.innerText = `${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)} - ${anoNome}`;
        }
        renderizarDias();
        renderizarListaEventos();
    };

    // Força a renderização visual imediata (vazia) e inicia a busca de dados
    atualizarCalendarioCompleto();
    buscarEventosFirebase();

    return `
    <div class="header-prof">
        <h1 class="UPPERCASE-TITLE" style="color:#003058; font-weight:800; margin-bottom: 30px;">CALENDÁRIO</h1>
    </div>

    <style>
        .container-calendario-clm { 
            display: grid; 
            grid-template-columns: 1fr 350px; 
            gap: 20px; 
            width: 100%; 
            box-sizing: border-box; 
        }
        .calendario-main-card { 
            box-shadow: 0 10px 25px rgba(0,0,0,0.05); 
            border-radius: 20px; 
            background: white; 
            padding: 20px; 
            border: 1px solid #f1f5f9; 
            overflow: hidden; 
        }
        .eventos-side-card { 
            box-shadow: 0 10px 25px rgba(0,0,0,0.05); 
            border-radius: 20px; 
            background: white; 
            padding: 25px; 
            display: flex; 
            flex-direction: column; 
            border: 1px solid #f1f5f9; 
        }
        
        /* Ajuste para Tablet/Mobile */
        @media (max-width: 1100px) { 
            .container-calendario-clm { grid-template-columns: 1fr; } 
            .eventos-side-card { order: 2; } 
            .calendario-main-card { order: 1; } 
        }

        /* Ajuste fino para Celulares */
        @media (max-width: 600px) {
            .calendario-main-card { padding: 15px 5px !important; }
            .header-prof h1 { font-size: 1.4rem !important; }
            
            /* Impede a tabela de achatar os números */
            #corpo-calendario td { 
                padding: 12px 0 !important; 
                font-size: 0.85rem !important; 
                min-width: 35px;
            }
            
            /* Garante que os botões de navegação não sumam */
            .calendario-main-card button {
                width: 35px !important;
                height: 35px !important;
            }

            /* Scroll suave se a tela for MUITO pequena (ex: iPhone SE) */
        .calendario-main-card {
            overflow-x: auto;
        }
        .calendario-main-card table {
            min-width: 300px;
        }

        /* Animação de saída do item */
        .fade-out-cal {
            opacity: 0 !important;
            transform: translateX(20px);
            transition: all 0.4s ease;
            pointer-events: none;
        }

        /* Animação de entrada suave para os dias e lista */
        .fade-in-smooth {
            animation: fadeInSmooth 0.4s ease forwards;
        }

        @keyframes fadeInSmooth {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>

    <div class="container-calendario-clm">
        <div class="calendario-main-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 10px;">
                <h2 id="titulo-mes-ano" style="color: #003058; margin:0; font-size: clamp(1.1rem, 3vw, 1.3rem); font-weight: 800;"></h2>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.navegarMes(-1)" style="width:40px; height:40px; background: #f1f5f9; border:none; cursor:pointer; border-radius:12px;"><i class="fa-solid fa-chevron-left"></i></button>
                    <button onclick="window.navegarMes(1)" style="width:40px; height:40px; background: #f1f5f9; border:none; cursor:pointer; border-radius:12px;"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; text-align: center;">
                <thead>
                    <tr style="color: #94a3b8; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">
                        <th style="padding:10px;">Dom</th><th style="padding:10px;">Seg</th><th style="padding:10px;">Ter</th><th style="padding:10px;">Qua</th><th style="padding:10px;">Qui</th><th style="padding:10px;">Sex</th><th style="padding:10px;">Sáb</th>
                    </tr>
                </thead>
                <tbody id="corpo-calendario"></tbody>
            </table>
        </div>

        <div class="eventos-side-card">
            <h3 style="color: #003058; font-size: 1rem; margin-bottom: 20px; font-weight: 800; text-transform: uppercase; display:flex; align-items:center;">
                <div style="width:8px; height:18px; background:#004aad; border-radius:4px; margin-right:10px;"></div>
                Meus Eventos
            </h3>
            <div id="lista-eventos-dinamica" style="flex: 1; min-height:200px;"></div>
            <div id="paginacao-eventos" style="display: none; justify-content: space-between; align-items: center; margin-top: 15px; border-top:1px solid #f1f5f9; padding-top:15px;">
                <button onclick="window.mudarPaginaEvento(-1)" style="width:30px; height:30px; border-radius:50%; border:1px solid #e2e8f0; background:white; color:${azulPadrao}; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-chevron-left" style="font-size:0.7rem;"></i>
                </button>
                <span id="indicador-paginas" style="font-size: 0.75rem; font-weight: 800; color: #64748b;">1 / 1</span>
                <button onclick="window.mudarPaginaEvento(1)" style="width:30px; height:30px; border-radius:50%; border:1px solid #e2e8f0; background:white; color:${azulPadrao}; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i>
                </button>
            </div>
        </div>
    </div>
    `;
});