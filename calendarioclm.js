window.Router.register('calendarioclm', async () => {
    let dataAtual = new Date();
    let paginaEvento = 0;
    const ITENS_POR_PAGINA = 4;
    const azulPadrao = "#003058";
    let eventosCache = [];

    const carregarEventosDoMeuProfessor = async () => {
        try {
            const auth = window.authMethods.getAuth();
            if (!auth.currentUser) return;

            // 1. Busca os dados do aluno para saber o código da turma (senha)
            const alunoDoc = await window.fsMethods.getDoc(
                window.fsMethods.doc(window.db, "usuarios", auth.currentUser.uid)
            );
            
            if (!alunoDoc.exists()) return;
            const dadosAluno = alunoDoc.data();
            const meuCodigoTurma = (dadosAluno.codigoAcesso || dadosAluno.turma || "").toString().trim();

            if (!meuCodigoTurma) {
                renderizarTudo();
                return;
            }

            // 2. Busca na coleção "turmas" quem é o professor dessa senha
            const qTurma = window.fsMethods.query(
                window.fsMethods.collection(window.db, "turmas"),
                window.fsMethods.where("senha", "==", meuCodigoTurma)
            );
            const snapTurma = await window.fsMethods.getDocs(qTurma);

            if (snapTurma.empty) {
                renderizarTudo();
                return;
            }

            // Pega o ID do professor responsável salvo na turma
            const professorId = snapTurma.docs[0].data().professorResponsavelId;

            // 3. Busca na coleção global "eventos" (que o prof agora usa) filtrando por esse ID
            const qEventos = window.fsMethods.query(
                window.fsMethods.collection(window.db, "eventos"),
                window.fsMethods.where("professorResponsavelId", "==", professorId)
            );
            
            const snapEventos = await window.fsMethods.getDocs(qEventos);
            
            eventosCache = snapEventos.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            // Ordena os eventos por data para a lista lateral
            eventosCache.sort((a, b) => a.data.localeCompare(b.data));

            renderizarTudo();
        } catch (error) {
            console.error("Erro ao carregar calendário do aluno:", error);
        }
    };

    // --- RENDERIZAÇÃO E UI ---
    window.navegarMesAlu = (dir) => { dataAtual.setMonth(dataAtual.getMonth() + dir); renderizarTudo(); };
    window.mudarPaginaEventoAlu = (dir) => { paginaEvento += dir; renderizarListaLateral(); };

    const renderizarListaLateral = () => {
        const container = document.getElementById('lista-eventos-alu');
        const hoje = new Date().setHours(0,0,0,0);
        
        // Filtra para mostrar apenas eventos de hoje em diante
        const futuros = eventosCache.filter(e => new Date(e.data + 'T00:00:00') >= hoje);
        
        const totalPaginas = Math.ceil(futuros.length / ITENS_POR_PAGINA);
        if (paginaEvento >= totalPaginas) paginaEvento = Math.max(0, totalPaginas - 1);
        
        const paginacao = document.getElementById('paginacao-alu');
        if(paginacao) paginacao.style.display = futuros.length > ITENS_POR_PAGINA ? 'flex' : 'none';
        
        const indicador = document.getElementById('indicador-pag-alu');
        if(indicador) indicador.innerText = `${paginaEvento + 1} / ${totalPaginas || 1}`;

        const exibidos = futuros.slice(paginaEvento * ITENS_POR_PAGINA, (paginaEvento * ITENS_POR_PAGINA) + ITENS_POR_PAGINA);

        if (exibidos.length === 0) {
            container.innerHTML = `<p style="color:#64748b; font-size:0.8rem; text-align:center; padding:20px;">Nenhum evento agendado pelo seu professor.</p>`;
            return;
        }

       container.innerHTML = '';
        for (const ev of exibidos) {
            const d = new Date(ev.data + 'T00:00:00');
            const item = document.createElement('div');
            item.style = "border-left: 4px solid #003058; padding: 12px; background: #f8fafc; border-radius: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;";
            
            item.innerHTML = `
                <div>
                    <p id="titulo-alu-ev-${ev.id}" style="font-weight: 800; font-size: 0.85rem; color: #003058; margin:0;">${ev.titulo}</p>
                    <p style="font-size: 0.7rem; color: #64748b; margin:0; text-transform: uppercase;">
                        ${d.getDate()} de ${d.toLocaleDateString('pt-BR', { month: 'short' })}
                    </p>
                </div>`;
            
            container.appendChild(item);

            if (ev.tituloUrl) {
                fetch(ev.tituloUrl)
                    .then(response => response.ok ? response.text() : null)
                    .then(textoCompleto => {
                        if (textoCompleto) {
                            const p = document.getElementById(`titulo-alu-ev-${ev.id}`);
                            if (p) p.innerText = textoCompleto;
                        }
                    })
                    .catch(err => console.error("Erro ao carregar título do storage", err));
            }
        }
    };

    const renderizarGrade = () => {
        const corpo = document.getElementById('corpo-calendario-alu');
        if (!corpo) return;
        const mes = dataAtual.getMonth();
        const ano = dataAtual.getFullYear();
        const primeiroDia = new Date(ano, mes, 1).getDay();
        const diasNoMes = new Date(ano, mes + 1, 0).getDate();
        const hoje = new Date().setHours(0,0,0,0);

        let html = '<tr>';
        for (let i = 0; i < primeiroDia; i++) html += '<td></td>';
        
        for (let dia = 1; dia <= diasNoMes; dia++) {
            if ((primeiroDia + dia - 1) % 7 === 0 && dia > 1) html += '</tr><tr>';
            
            const dataISO = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            const dTime = new Date(ano, mes, dia).getTime();
            const temEvento = eventosCache.some(e => e.data === dataISO);
            
            const estiloDia = dTime === hoje 
                ? 'background:#003058; color:white; border-radius:10px;' 
                : '';

            html += `
                <td style="padding: 12px; font-weight: 700; position: relative; ${estiloDia}">
                    ${dia}
                    ${temEvento && dTime !== hoje ? '<div style="width:4px; height:4px; background:#003058; border-radius:50%; position:absolute; bottom:4px; left:50%; transform:translateX(-50%);"></div>' : ''}
                </td>`;
        }
        corpo.innerHTML = html + '</tr>';
    };

    const renderizarTudo = () => {
        const mesAno = document.getElementById('mes-ano-alu');
        if(mesAno) {
            const mesNome = dataAtual.toLocaleDateString('pt-BR', { month: 'long' });
            mesAno.innerText = `${mesNome.toUpperCase()} ${dataAtual.getFullYear()}`;
        }
        renderizarGrade();
        renderizarListaLateral();
    };

    // Inicia o processo
    setTimeout(carregarEventosDoMeuProfessor, 100);

    return `
    <div class="header-prof">
        <h1 style="font-size: 1.6rem; font-weight: 900; color: #003058; text-transform: uppercase;">Calendário</h1>
        <p style="font-size: 0.85rem; color: #64748b;">Eventos e aulas da sua turma.</p>
    </div>
    <hr style="border:0; border-top:2px solid #f1f5f9; margin: 15px 0 25px 0;">

    <div class="cal-container-mobile">
        <div style="background: white; border-radius: 16px; padding: 20px; border: 1px solid #f1f5f9;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 id="mes-ano-alu" style="margin:0; font-size:1.1rem; color:#003058; font-weight:800;"></h2>
                <div style="display:flex; gap:8px;">
                    <button onclick="window.navegarMesAlu(-1)" style="border:none; background:#f1f5f9; padding:8px 12px; border-radius:8px; cursor:pointer;"><i class="fa-solid fa-chevron-left"></i></button>
                    <button onclick="window.navegarMesAlu(1)" style="border:none; background:#f1f5f9; padding:8px 12px; border-radius:8px; cursor:pointer;"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>
            <table style="width:100%; text-align:center; border-collapse:collapse;">
                <thead>
                    <tr style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase;">
                        <th style="padding-bottom:15px;">Dom</th><th style="padding-bottom:15px;">Seg</th><th style="padding-bottom:15px;">Ter</th><th style="padding-bottom:15px;">Qua</th><th style="padding-bottom:15px;">Qui</th><th style="padding-bottom:15px;">Sex</th><th style="padding-bottom:15px;">Sáb</th>
                    </tr>
                </thead>
                <tbody id="corpo-calendario-alu"></tbody>
            </table>
        </div>

        <div style="background: white; border-radius: 16px; padding: 20px; border: 1px solid #f1f5f9; display:flex; flex-direction:column;">
            <h3 style="font-size:0.8rem; color:#003058; font-weight:900; text-transform:uppercase; margin-bottom:15px;">Próximas Datas</h3>
            <div id="lista-eventos-alu" style="flex:1;"></div>
            <div id="paginacao-alu" style="display:none; justify-content:space-between; align-items:center; margin-top:15px;">
                <button onclick="window.mudarPaginaEventoAlu(-1)" style="background:none; border:none; cursor:pointer; color:#003058;"><i class="fa-solid fa-arrow-left"></i></button>
                <span id="indicador-pag-alu" style="font-size:0.7rem; font-weight:800; color:#64748b;"></span>
                <button onclick="window.mudarPaginaEventoAlu(1)" style="background:none; border:none; cursor:pointer; color:#003058;"><i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </div>
    </div>

    <style>
    /* Desktop e telas maiores */
    .cal-container-mobile { 
        display: grid; 
        grid-template-columns: 1fr 300px; 
        gap: 20px; 
    }

    /* Ajuste para Celular */
    @media (max-width: 850px) {
        .cal-container-mobile { 
            grid-template-columns: 1fr !important; 
        }
        
        /* Evita que os dias fiquem muito apertados em telas como iPhone SE */
        #corpo-calendario-alu td {
            padding: 10px 2px !important;
            font-size: 0.8rem !important;
            min-width: 30px;
        }

        /* Adiciona scroll lateral se a tela for menor que o calendário */
        .cal-container-mobile > div:first-child {
            overflow-x: auto;
        }
        
        .cal-container-mobile table {
            min-width: 280px;
        }

        .header-prof h1 {
            font-size: 1.3rem !important;
        }
    }
</style>
    `;
});