window.Router.register('turmaclm', async () => {
    const buscarDadosTurma = async () => {
        try {
            const auth = window.authMethods.getAuth();
            const userRef = auth.currentUser;

            if (!userRef) return;

            const alunoDoc = await window.fsMethods.getDoc(window.fsMethods.doc(window.db, "usuarios", userRef.uid));
            if (!alunoDoc.exists()) return;
            
            const dadosAluno = alunoDoc.data();
            
            // CORREÇÃO: Busca o código da turma de forma flexível (turma ou codigoAcesso)
            const codigoTurmaDoAluno = (dadosAluno.turma || dadosAluno.codigoAcesso || "").toString().trim(); 

            if (codigoTurmaDoAluno) {
                const turmasRef = window.fsMethods.collection(window.db, "turmas");
                const qTurma = window.fsMethods.query(turmasRef, window.fsMethods.where("senha", "==", codigoTurmaDoAluno));
                const querySnapshotTurma = await window.fsMethods.getDocs(qTurma);

                const elNomeTurma = document.getElementById('nome-turma-exibicao');
                const elDetalhesTurma = document.getElementById('detalhes-turma-geral');

                if (!querySnapshotTurma.empty) {
                    const dadosTurma = querySnapshotTurma.docs[0].data();
                    
                    if (elNomeTurma) {
                        elNomeTurma.innerText = dadosTurma.nomeCustomizado || "Minha Turma";
                        
                        // Se houver nome longo no Storage, faz o download e atualiza
                        if (dadosTurma.nomeCompletoUrl) {
                            fetch(dadosTurma.nomeCompletoUrl)
                                .then(r => r.text())
                                .then(texto => { elNomeTurma.innerText = texto; })
                                .catch(err => console.error("Erro ao baixar nome da turma:", err));
                        }
                    }

                    if (elDetalhesTurma) {
                        let detalhesHtml = "";
                        const fields = ['nome', 'curso', 'semestre', 'periodo', 'dias', 'horario'];
                        const icons = { nome: 'book', curso: 'book', semestre: 'layer-group', periodo: 'clock', dias: 'calendar-days', horario: 'clock' };
                        
                        fields.forEach(f => {
                            if (dadosTurma[f]) {
                                detalhesHtml += `<span style="background: rgba(0, 74, 173, 0.05); color: #004aad; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 600; border: 1px solid rgba(0, 74, 173, 0.1); display: inline-flex; align-items: center; white-space: nowrap;"><i class="fa-solid fa-${icons[f]}" style="margin-right: 4px;"></i> ${dadosTurma[f]}</span>`;
                            }
                        });
                        elDetalhesTurma.innerHTML = detalhesHtml;
                    }
                } else if (elNomeTurma) {
                    // Se não achou a turma na coleção "turmas", mostra o código bruto
                    elNomeTurma.innerText = codigoTurmaDoAluno;
                }

                // BUSCA COLEGAS: Ajustado para buscar por turma OU codigoAcesso para garantir que todos apareçam
                const qColegas = window.fsMethods.query(
                    window.fsMethods.collection(window.db, "usuarios"),
                    window.fsMethods.where("perfil", "==", "Aluno"),
                    window.fsMethods.where("status", "==", "aprovado")
                );

                window.fsMethods.onSnapshot(qColegas, (snapshot) => {
                    const container = document.getElementById('lista-colegas');
                    if (!container) return;

                    let todosAlunos = [];
                    snapshot.forEach(doc => {
                        const d = doc.data();
                        const vAlu = (d.turma || d.codigoAcesso || "").toString().trim();
                        
                        // Filtra apenas os alunos que pertencem à mesma turma do usuário logado
                        if (vAlu === codigoTurmaDoAluno) {
                            todosAlunos.push({ id: doc.id, ...d });
                        }
                    });

                    let paginaAtual = 0;
                    const itensPorPagina = 7;

                    const renderizarPagina = (p) => {
                        const inicio = p * itensPorPagina;
                        const fim = inicio + itensPorPagina;
                        const sliceAlunos = todosAlunos.slice(inicio, fim);

                        let html = "";
                        sliceAlunos.forEach(aluno => {
                            const eVoce = aluno.id === userRef.uid;

                            html += `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: ${eVoce ? '#f0f7ff' : '#fff'}; border-radius: 12px; border: 1px solid ${eVoce ? '#004aad20' : '#f1f5f9'}; margin-bottom: 6px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 32px; height: 32px; background: #003058; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                        ${aluno.nome ? aluno.nome.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div style="display: flex; flex-direction: column;">
                                        <strong style="color: #003058; font-size: 0.9rem;">${aluno.nome}</strong>
                                        ${eVoce ? '<span style="color:#004aad; font-size:0.6rem; font-weight:800; letter-spacing:0.5px;">VOCÊ</span>' : ''}
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center;">
                                    <i class="fa-solid fa-graduation-cap" style="color: ${eVoce ? '#004aad' : '#e2e8f0'}; font-size: 0.9rem;"></i>
                                </div>
                            </div>`;
                        });

                        container.innerHTML = html || '<p style="text-align:center; color:#94a3b8; padding:20px;">Nenhum colega encontrado.</p>';
                        
                        const btnP = document.getElementById('btn-prev');
                        const btnN = document.getElementById('btn-next');
                        if(btnP) btnP.style.opacity = p === 0 ? "0.3" : "1";
                        if(btnN) btnN.style.opacity = fim >= todosAlunos.length ? "0.3" : "1";
                    };

                    window.mudarPaginaTurma = (direcao) => {
                        if (direcao === 1 && (paginaAtual + 1) * itensPorPagina < todosAlunos.length) {
                            paginaAtual++;
                            renderizarPagina(paginaAtual);
                        } else if (direcao === -1 && paginaAtual > 0) {
                            paginaAtual--;
                            renderizarPagina(paginaAtual);
                        }
                    };

                    renderizarPagina(0);
                });
            } else {
                const elNomeTurma = document.getElementById('nome-turma-exibicao');
                if (elNomeTurma) elNomeTurma.innerText = "Sem Turma";
                const container = document.getElementById('lista-colegas');
                if (container) container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">Você não está vinculado a nenhuma turma.</p>';
            }
        } catch (error) {
            console.error("Erro ao carregar dados da turma:", error);
        }
    };

    setTimeout(buscarDadosTurma, 200);

    return `
    <div class="header-prof">
        <h1>Minha Turma</h1>
        <p>Dados da sua turma e lista de colegas.</p>
    </div>

    <hr class="divisor">

    <div class="card" style="display: flex; align-items: center; justify-content: space-between; border-left: 6px solid #004aad; padding: 10px 25px; min-height: 70px; background: #fff;">
        <div style="flex: 1;">
            <h3 style="color: #64748b; font-size: 0.7rem; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; font-weight: 700;">Informações</h3>
            <div id="detalhes-turma-geral" style="display: flex; flex-wrap: wrap; gap: 8px;">
            </div>
        </div>
        <div style="background: #f0f4f8; padding: 6px 15px; border-radius: 12px; color: #004aad; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-left: 20px; border: 1px solid rgba(0,74,173,0.1); min-width: 110px;">
            <span style="font-size: 0.65rem; font-weight: 800; color: #004aad; margin-bottom: 2px; text-transform: uppercase;">TURMA:</span>
            <p id="nome-turma-exibicao" style="font-size: 1rem; font-weight: 800; color: #003058; margin: 0; text-align: center; line-height: 1.1;">Buscando...</p>
        </div>
    </div>

    <div class="card" style="padding: 15px 25px; border-radius: 24px;">
        <h2 style="color: #003058; margin-bottom: 12px; font-size: 1.05rem; display: flex; align-items: center; gap: 10px; font-weight: 700;">
            <i class="fa-solid fa-address-book" style="color: #004aad;"></i> Colegas de classe
        </h2>
        
        <div id="lista-colegas" style="display: flex; flex-direction: column; min-height: 220px;">
            <p style="color: #94a3b8; font-size: 0.9rem; text-align: center; padding: 20px;">Carregando colegas...</p>
        </div>

        <div style="display: flex; justify-content: center; gap: 20px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #edf2f7;">
            <button id="btn-prev" onclick="window.mudarPaginaTurma(-1)" style="border: none; background: #004aad; color: white; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button id="btn-next" onclick="window.mudarPaginaTurma(1)" style="border: none; background: #004aad; color: white; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>
    </div>
    `;
});