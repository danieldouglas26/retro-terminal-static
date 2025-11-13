document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores DOM ---
    // Mapeia os elementos HTML para variáveis para fácil acesso.
    const terminal = document.getElementById('terminal');
    const screen = document.querySelector('.screen');
    const inputBar = document.querySelector('.input-bar');
    const mobileInputArea = inputBar.querySelector('.input-area');
    const mobileBarLabel = inputBar.querySelector('.prompt-label');
    const mobileAboveLabel = document.querySelector('.mobile-prompt-label');
    const historyUpBtn = document.getElementById('history-up');
    const historyDownBtn = document.getElementById('history-down');

    // --- Variáveis de Estado ---
    let commandHistory = []; // Armazena os comandos digitados
    let historyIndex = 0; // Posição atual no histórico de comandos
    let isFormatting = false; // Controla a formatação de CNPJ para evitar loops
    let currentInputArea; // Referência ao input (desktop ou mobile) que está ativo

    // --- Sequência de Boot ---
    // Define as linhas que aparecem ao carregar o terminal.
    const bootSequence = [
        { text: "Booting Capsys OS v4.0 (Consulta Mode)...", class: 'text-info' },
        { text: "Loading API modules... [STATIC]", class: 'text-success' },
        // Link para o projeto em produção
        { text: "Acesse a versão de produção (<a href='https://terminal.opencnpj.com' target='_blank'>https://terminal.opencnpj.com</a>)...", class: 'text-success' },
        { text: " ", delay: 100 },
        { text: "Terminal de Consulta de CNPJ pronto.", class: 'text-info' },
        { text: " ", delay: 100 },
        { text: `Data: ${new Date().toString()}`, class: 'text-comment' },
        { text: " ", delay: 100 }
    ];

    /**
     * Inicia o terminal executando a sequência de boot.
     */
    function start() {
        terminal.innerHTML = '';
        runBootSequence(bootSequence, () => {
            createPrompt('Digite o CNPJ para consulta:');
        });
    }

    /**
     * Exibe a sequência de boot linha por linha com um pequeno atraso.
     */
    function runBootSequence(sequence, finalCallback) {
        let index = 0;
        const nextLine = () => {
            if (index < sequence.length) {
                const item = sequence[index++];
                setTimeout(() => addLine(item.text, item.class, nextLine), item.delay || 50);
            } else if (finalCallback) {
                finalCallback(); // Chama o callback (createPrompt) ao final
            }
        };
        nextLine();
    }
    
    /**
     * Pula a animação de boot e exibe tudo imediatamente.
     */
    function skipBootSequence() {
        terminal.innerHTML = '';
        bootSequence.forEach(line => addLine(line.text, line.class));
        createPrompt('Digite o CNPJ para consulta:');
    }

    /**
     * Cria um novo prompt de entrada ('input') no terminal.
     */
    function createPrompt(label) {
        // Remove o prompt desktop antigo, se existir
        const oldDesktopPrompt = terminal.querySelector('.prompt.desktop-only');
        if (oldDesktopPrompt) oldDesktopPrompt.remove();
        
        // Cria o novo prompt para desktop
        const desktopPromptWrapper = document.createElement('div');
        desktopPromptWrapper.className = 'line prompt desktop-only';
        desktopPromptWrapper.innerHTML = `<span>${label}&nbsp;</span><span class="input-area" contenteditable="true"></span><span class="cursor"></span>`;
        terminal.appendChild(desktopPromptWrapper);
        const desktopInputArea = desktopPromptWrapper.querySelector('.input-area');
        
        // Atualiza os labels do input mobile
        mobileAboveLabel.textContent = label;
        mobileBarLabel.innerHTML = `>&nbsp;`;
        
        // Define qual input está ativo (desktop vs mobile)
        currentInputArea = window.innerWidth <= 768 ? mobileInputArea : desktopInputArea;
        
        // Adiciona os event listeners aos inputs (desktop e mobile)
        [desktopInputArea, mobileInputArea].forEach(input => {
            input.removeEventListener('keydown', handleKeyDown);
            input.removeEventListener('input', handleInput);
            input.addEventListener('keydown', handleKeyDown);
            input.addEventListener('input', handleInput);
        });
        
        focusAndMoveCursorToEnd(currentInputArea);
        terminal.scrollTop = terminal.scrollHeight;
    }

    /**
     * Navega pelo histórico de comandos (seta para cima/baixo).
     */
    function navigateHistory(direction) {
        if (direction === 'up' && historyIndex > 0) {
            historyIndex--;
        } else if (direction === 'down') {
            if (historyIndex < commandHistory.length) {
                historyIndex++;
            } else { return; }
        } else { return; }
        
        currentInputArea.innerText = commandHistory[historyIndex] || '';
        focusAndMoveCursorToEnd(currentInputArea);
    }
    
    // Listeners para os botões de histórico (mobile)
    historyUpBtn.addEventListener('click', () => navigateHistory('up'));
    historyDownBtn.addEventListener('click', () => navigateHistory('down'));

    /**
     * Formata a entrada do usuário em tempo real como um CNPJ (XX.XXX.XXX/XXXX-XX).
     */
    function handleInput(e) {
        if (isFormatting) return;
        const inputArea = e.target;
        const rawText = inputArea.innerText;
        
        // Remove caracteres não numéricos que não sejam parte da máscara
        if (/[^0-9.\/-]/.test(rawText)) {
            isFormatting = true;
            inputArea.innerText = rawText.replace(/[.\/-]/g, '');
            isFormatting = false;
            focusAndMoveCursorToEnd(inputArea);
            return;
        }
        
        // Aplica a máscara de CNPJ
        const digitsOnly = rawText.replace(/\D/g, '');
        isFormatting = true;
        const formatted = formatCnpj(digitsOnly);
        inputArea.innerText = formatted;
        isFormatting = false;
        focusAndMoveCursorToEnd(inputArea);
    }

    /**
     * Função utilitária para aplicar a máscara de CNPJ.
     */
    function formatCnpj(value) {
        value = (value || "").replace(/\D/g, '').substring(0, 14);
        if (value.length <= 2) return value;
        if (value.length <= 5) return value.replace(/(\d{2})(\d+)/, '$1.$2');
        if (value.length <= 8) return value.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
        if (value.length <= 12) return value.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
        return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
    }

    /**
     * Lida com os eventos de tecla (Enter, Seta para Cima, Seta para Baixo).
     */
    function handleKeyDown(e) {
        switch(e.key) {
            case 'Enter':
                e.preventDefault();
                
                const command = currentInputArea.innerText.trim();
                const currentPrompt = terminal.querySelector('.prompt');
                
                // "Trava" o comando digitado no log do terminal
                if (currentPrompt) {
                    const label = currentPrompt.querySelector('span:first-child').innerText;
                    currentPrompt.innerHTML = `<span>${label}</span>${command}`;
                    currentPrompt.classList.remove('prompt', 'desktop-only');
                } else if(window.innerWidth <= 768){
                    // Lógica para "travar" o comando no mobile
                    addLine(`>&nbsp;${command}`);
                }
                
                // Processa o comando
                if (command) {
                    if (command !== commandHistory[commandHistory.length - 1]) {
                        commandHistory.push(command);
                    }
                    historyIndex = commandHistory.length;
                    processInput(command);
                } else {
                    // Se o usuário apertar Enter sem digitar nada, cria um novo prompt
                    createPrompt('Digite o CNPJ para consulta:');
                }
                currentInputArea.innerText = '';
                break;

            case 'ArrowUp': e.preventDefault(); navigateHistory('up'); break;
            case 'ArrowDown': e.preventDefault(); navigateHistory('down'); break;
            default:
                break; // Outras teclas são ignoradas aqui
        }
    }
    
    /**
     * Direciona a entrada do usuário: ou é um CNPJ ou é um erro.
     */
    function processInput(input) {
        // Se a entrada contiver letras (não for um CNPJ)
        if (/[^0-9.\/-]/.test(input)) {
            // Exibe um erro padrão de comando não encontrado
            addLine(`bash: comando não encontrado: ${input}`, 'text-error');
            createPrompt('Digite o CNPJ para consulta:');
        } else {
            // Se for um CNPJ, limpa e valida o comprimento
            const cleanedInput = input.replace(/\D/g, '');
            if (cleanedInput.length !== 14) {
                displayError("CNPJ deve ter 14 dígitos.");
                return createPrompt('Digite outro CNPJ ou CTRL+R para reiniciar:');
            }
          
            // Chama a função que exibe os dados estáticos
            fetchCnpjData(cleanedInput);
        }
    }

    /**
     * (Opcional) Valida o dígito verificador do CNPJ.
     * Esta função não é estritamente necessária para o layout, mas é uma
     * boa prática mantê-la se o projeto final for usá-la.
     */
    function validateCnpj(cnpj) {
        cnpj = cnpj.replace(/[^\d]+/g,'');
        if(cnpj === '' || cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
        let tamanho = 12, numeros = cnpj.substring(0,tamanho), digitos = cnpj.substring(12), soma = 0, pos = 5;
        for (let i = tamanho; i >= 1; i--) { soma += parseInt(numeros.charAt(tamanho - i)) * pos--; if (pos < 2) pos = 9; }
        let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        if (resultado !== parseInt(digitos.charAt(0))) return false;
        tamanho = 13; numeros = cnpj.substring(0,tamanho); soma = 0, pos = 6;
        for (let i = tamanho; i >= 1; i--) { soma += parseInt(numeros.charAt(tamanho - i)) * pos--; if (pos < 2) pos = 9; }
        resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        if (resultado !== parseInt(digitos.charAt(1))) return false;
        return true;
    }

    /**
     * Ponto principal do layout: Simula uma busca de API com dados estáticos.
     * Em um projeto real, esta função faria a chamada (fetch) para a API.
     */
    async function fetchCnpjData(cnpj) {
        addLine('Consultando CNPJ (Modo Estático)...', 'text-comment');
        
        // Dados fixos (mock data) para exibir o layout de resultado.
        // É aqui que os dados da sua API real entrariam.
        const dadosFixos = {
            "success": true,
            "message": null,
            "data": {
                "cnpj": "00.000.000/0001-91", // Será substituído pelo CNPJ digitado
                "situacaoCadastral": "Ativa",
                "dataSituacaoCadastral": "03/11/2005",
                "motivoSituacaoCadastral": "SEM MOTIVO",
                "razaoSocial": "EMPRESA DE EXEMPLO LTDA",
                "nomeFantasia": "NOME FANTASIA DE EXEMPLO",
                "dataInicioAtividades": "01/08/1966",
                "matriz": "Sim",
                "naturezaJuridica": "Sociedade Empresária Limitada (2062)",
                "capitalSocial": 100000.00,
                "email": "contato@empresaexemplo.com.br",
                "telefone": "(11) 5555-4444",
                "logradouro": "RUA DO EXEMPLO",
                "numero": "123",
                "complemento": "SALA 456",
                "bairro": "CENTRO",
                "municipio": "SAO PAULO",
                "uf": "SP",
                "cep": "01000-000",
                "dataSituacaoEspecial": null,
                "situacaoEspecial": null,
                "opcaoSimples": "N",
                "opcaoMei": "N",
                "cnaes": [
                    { "cnae": "6201501", "descricao": "Desenvolvimento de programas de computador sob encomenda" },
                    { "cnae": "6204000", "descricao": "Consultoria em tecnologia da informação" }
                ],
                "socios": [
                    { "nomeSocio": "Fulano de Tal", "descricao": "Sócio-Administrador", "identificadorSocio": 2, "cnpjCpfSocio": "***123456**", "dataEntradaSociedade": "01/08/1966", "nomeRepresentante": null, "faixaEtaria": "41-50 anos" },
                    { "nomeSocio": "Ciclana da Silva", "descricao": "Sócio", "identificadorSocio": 2, "cnpjCpfSocio": "***654321**", "dataEntradaSociedade": "10/05/2010", "nomeRepresentante": null, "faixaEtaria": "51-60 anos" }
                ]
            }
        };

        // Simula um atraso de rede (loading)
        setTimeout(() => {
            if (dadosFixos.success && dadosFixos.data) {
                // Atualiza o CNPJ nos dados fixos para refletir a entrada do usuário
                dadosFixos.data.cnpj = formatCnpj(cnpj); 
                displayDataAsTable(dadosFixos.data);
            } else {
                displayError("Erro ao carregar dados fixos.");
            }
            
            // Cria o próximo prompt para uma nova consulta
            createPrompt('Digite outro CNPJ ou CTRL+R para reiniciar:');
        }, 500); // Atraso de 0.5 segundos
    }

    /**
     * Exibe os dados do CNPJ formatados em tabela (desktop) ou lista (mobile).
     */
    function displayDataAsTable(cnpjData) {
        const d = cnpjData;
        const keyWidth = 25; // Largura da coluna "chave" na tabela
        const contentWidth = 70; // Largura total da tabela
        const valueWidth = contentWidth - keyWidth - 7;
        const border = `+${'-'.repeat(contentWidth)}+`;
        let textToCopy = '*** Dados da Empresa ***\n\n'; // Texto para o botão "Copiar"

        // --- Funções Auxiliares de Formatação ---
        const formatCurrency = (value) => {
            const num = parseFloat(value);
            return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };
        const formatYesNo = (value) => value === 'S' || value === 'Sim' ? 'SIM' : 'NÃO';

        // --- Mapeamento dos Dados Principais ---
        const formattedData = {
            "CNPJ": d.cnpj ? formatCnpj(d.cnpj) : "N/A",
            "Razão Social": d.razaoSocial,
            "Nome Fantasia": d.nomeFantasia || "N/A",
            "Situação Cadastral": d.situacaoCadastral,
            "Data Situação": d.dataSituacaoCadastral,
            "Data Início Atividades": d.dataInicioAtividades,
            "Natureza Jurídica": d.naturezaJuridica,
            "Capital Social": formatCurrency(d.capitalSocial),
            "Opção Simples": formatYesNo(d.opcaoSimples),
            "Opção MEI": formatYesNo(d.opcaoMei),
            "Email": d.email || "N/A",
            "Telefone": d.telefone || "N/A",
            "Logradouro": d.logradouro,
            "Número": d.numero,
            "Complemento": d.complemento || "N/A",
            "Bairro": d.bairro,
            "Município / UF": `${d.municipio} - ${d.uf}`,
            "CEP": d.cep
        };
        
        // --- Exibição no Terminal (Desktop vs Mobile) ---
        addLine(' ', 'text-success');
        addLine('--- DADOS CADASTRAIS (Fictícios para teste do layout) ---', 'text-info');
        
        if (window.innerWidth <= 768) {
            // Layout de Lista para Mobile
            for (const key in formattedData) {
                const value = formattedData[key] || "N/A";
                addLine(`${key}: ${value}`, 'text-info');
                textToCopy += `${key}: ${value}\n`;
            }
        } else {
            // Layout de Tabela para Desktop
            addLine(border, 'text-success');
            for (const key in formattedData) {
                const value = formattedData[key] || "N/A";
                const displayValue = value.toString().substring(0, valueWidth);
                const line = `| ${key.padEnd(keyWidth)}: ${displayValue.padEnd(valueWidth)}|`;
                addLine(line, 'text-success');
                textToCopy += `${key}: ${value}\n`;
            }
            addLine(border, 'text-success');
        }

        // --- Exibição dos CNAEs ---
        if (d.cnaes && d.cnaes.length > 0) {
            textToCopy += '\n*** Atividades Econômicas (CNAEs) ***\n'; 
            addLine(' ', 'text-info');
            addLine('--- ATIVIDADES ECONÔMICAS (CNAEs) ---', 'text-info');

            const cnaePrincipal = d.cnaes[0];
             addLine('PRINCIPAL:');
             textToCopy += 'PRINCIPAL:\n';

            let cnaeLine = `${cnaePrincipal.cnae} - ${cnaePrincipal.descricao}`;
            addLine(cnaeLine, 'text-success');
            textToCopy += cnaeLine + '\n';
            
            const cnaesSecundarios = d.cnaes.slice(1);
            if (cnaesSecundarios.length > 0) {
                addLine('SECUNDÁRIAS:', 'text-comment');
                textToCopy += 'SECUNDÁRIAS:\n';
                cnaesSecundarios.forEach(cnae => {
                    cnaeLine = `- ${cnae.cnae} - ${cnae.descricao}`;
                    addLine(cnaeLine, 'text-success');
                    textToCopy += cnaeLine + '\n';
                });
            }
        }

        // --- Exibição dos Sócios ---
        if (d.socios && d.socios.length > 0) {
            const maxSociosDisplay = 10; // Limita a exibição no terminal
            textToCopy += `\n*** Quadro de Sócios e Administradores (${d.socios.length} no total) ***\n`; 
            addLine(' ', 'text-info');
            addLine(`--- QUADRO DE SÓCIOS E ADMINISTRADORES (Exibindo ${Math.min(maxSociosDisplay, d.socios.length)}) ---`, 'text-info');

            const sociosParaMostrar = d.socios.slice(0, maxSociosDisplay);
            sociosParaMostrar.forEach(socio => {
                const socioLine = `> ${socio.nomeSocio} (${socio.faixaEtaria || 'N/A'}) - ${socio.descricao} (Desde: ${socio.dataEntradaSociedade})`;
                addLine(socioLine, 'text-success');
            });

            if (d.socios.length > maxSociosDisplay) {
                const remaining = d.socios.length - maxSociosDisplay;
                addLine(`... e mais ${remaining} sócios/administradores (Apenas na cópia).`, 'text-comment');
            }
            
            // Adiciona TODOS os sócios ao texto de cópia
            d.socios.forEach(socio => {
                const socioCopyLine = `> ${socio.nomeSocio} (CPF/CNPJ: ${socio.cnpjCpfSocio}) - ${socio.descricao} (Desde: ${socio.dataEntradaSociedade} / Faixa Etária: ${socio.faixaEtaria || 'N/A'})`;
                textToCopy += socioCopyLine + '\n';
            });
        }

        // --- Botão de Copiar ---
        addLine(' ', 'text-success');
        const buttonWrapper = document.createElement('div');
        const copyButton = document.createElement('button');
        copyButton.innerText = '[ Copiar Resultado ]';
        copyButton.className = 'copy-button';

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(textToCopy.trim())
                .then(() => {
                    copyButton.innerText = 'Copiado para a área de transferência!';
                    setTimeout(() => {
                        copyButton.innerText = '[ Copiar Resultado ]';
                    }, 2500);
                })
                .catch(err => {
                    console.error('Falha ao copiar o texto: ', err);
                    copyButton.innerText = 'Erro ao copiar!';
                });
        });

        buttonWrapper.appendChild(copyButton);
        terminal.appendChild(buttonWrapper);
        
        addLine(' ', 'text-success');
    }

    /**
     * Exibe uma mensagem de erro formatada em uma caixa.
     */
    function displayError(message) {
        const contentWidth = 70;
        const border = `+${'-'.repeat(contentWidth)}+`;
        addLine(' ', 'text-error');
        addLine(border, 'text-error');
        addLine(`| ERRO: ${message.padEnd(contentWidth - 8)}|`, 'text-error');
        addLine(border, 'text-error');
        addLine(' ', 'text-error');
    }

    /**
     * Adiciona uma nova linha de texto ao terminal.
     */
    function addLine(text, className, callback) {
        const line = document.createElement('div');
        if (className) line.className = `line ${className}`;
        line.innerHTML = text.replace(/ /g, '&nbsp;'); // Preserva espaços
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight; // Auto-scroll para o final
        if (callback) callback();
    }

    /**
     * Utilitário para focar um campo 'contenteditable' e mover o cursor para o final.
     */
    function focusAndMoveCursorToEnd(el) {
        if (!el) return;
        el.focus();
        if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    // --- Listeners Globais ---

    // Foca no input ao clicar na tela (exceto na própria barra de input)
    screen.addEventListener('click', (e) => {
        if (!inputBar.contains(e.target)) focusAndMoveCursorToEnd(currentInputArea);
    });

    // Permite pular o boot com 'Enter'
    document.addEventListener('keydown', (e) => {
        // A variável 'isBooting' não está definida, mas a lógica pode ser
        // re-implementada se você adicionar um estado 'isBooting = true' no início
        // e 'isBooting = false' no final da sequência de boot.
        // if (isBooting && e.key === 'Enter') {
        //     skipBootSequence();
        // }
    });
    
    // Ajusta a referência do input ativo ao redimensionar a janela
    window.addEventListener('resize', () => {
        currentInputArea = window.innerWidth <= 768 ? mobileInputArea : terminal.querySelector('.prompt.desktop-only .input-area');
    });
    
    // Inicia a aplicação
    start();
});