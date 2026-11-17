// Entry real do bundle. A lógica didática (e a função escolherPersonagem) mora em scripts.js.
const escolherPersonagem = require("./scripts.js");

const PERSONAGENS = {
  lucia: { nome: "Lucia", imagem: "img/lucia.png", cor: "#ff3cac" },
  jason: { nome: "Jason", imagem: "img/jason.png", cor: "#4cc9f0" },
  cj: { nome: "CJ", imagem: "img/cj.png", cor: "#77dd77" },
};

const COR_VOCE = "#ffd319";
const TAMANHO_MAXIMO = 32 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const PROMPT_GTA =
  "Transforme esta foto em um personagem jogável de GTA 6 em Dev City: " +
  "visual cinematográfico de pôster de jogo, cores neon rosa e amarelo, " +
  "iluminação de cidade à noite, rosto reconhecível, atitude de lenda, " +
  "tom satírico e divertido, alta qualidade.";

const botoesPersonagem = document.querySelectorAll("[data-personagem]");
const btnVoce = document.querySelector("#btn-voce");
const dialogo = document.querySelector("#dialogo-voce");
const form = document.querySelector("#form-voce");
const inputFoto = document.querySelector("#foto-voce");
const preview = document.querySelector("#preview-voce");
const progresso = document.querySelector("#progresso-voce");
const erro = document.querySelector("#erro-voce");
const status = document.querySelector("#status-voce");
const btnGerar = document.querySelector("#btn-gerar");
const btnCancelar = document.querySelector("#btn-cancelar");

let urlPreview = null;

function limparSelecao() {
  botoesPersonagem.forEach((botao) => {
    botao.classList.remove("ativo");
    botao.setAttribute("aria-pressed", "false");
  });
  btnVoce.classList.remove("ativo");
}

function mostrarErro(mensagem) {
  erro.textContent = mensagem;
  erro.hidden = false;
}

function limparErro() {
  inputFoto.setCustomValidity("");
  erro.textContent = "";
  erro.hidden = true;
}

function definirStatus(mensagem) {
  status.textContent = mensagem;
}

function mensagemAutenticacao(falha) {
  const codigo = falha && (falha.error || falha.code);
  const mensagens = {
    popup_blocked: "O navegador bloqueou o login. Permita pop-ups para este site e tente outra vez.",
    auth_window_closed: "Você fechou a janela de login. Tente outra vez quando quiser.",
    unsupported_origin: "Abra a página pelo servidor local (npm start), não direto do disco.",
  };
  return mensagens[codigo] || "Não foi possível entrar na conta Puter. Tente outra vez.";
}

function mensagemGeracao(falha) {
  const codigo = falha && (falha.errorCode || falha.code || falha.error);
  const mensagens = {
    insufficient_funds: "Seus créditos do Puter não cobrem a imagem. Recarregue a conta e tente outra vez.",
    moderation_flagged: "A foto ou o texto foi barrado pelo filtro de conteúdo. Tente outra imagem.",
    upstream_failed: "O serviço de imagem falhou do outro lado. Tente outra vez.",
    access_denied: "O Puter não conseguiu ler essa imagem. Tente outra foto.",
  };
  return mensagens[codigo] || "Não foi possível criar sua lenda. Tente outra vez.";
}

function definirOcupado(ocupado) {
  btnGerar.disabled = ocupado;
  btnGerar.textContent = ocupado ? "Criando sua lenda..." : "Gerar lenda";
  progresso.hidden = !ocupado;
}

// Fase 3: Lucia, Jason e CJ trocam nome, imagem e cor na hora.
botoesPersonagem.forEach((botao) => {
  botao.addEventListener("click", () => {
    const dados = PERSONAGENS[botao.dataset.personagem];
    escolherPersonagem(dados.nome, dados.imagem, dados.cor);
    limparSelecao();
    botao.classList.add("ativo");
    botao.setAttribute("aria-pressed", "true");
  });
});

// Fase 4: o diálogo nativo cuida de foco, Esc e devolução de foco ao botão "Você".
btnVoce.addEventListener("click", () => dialogo.showModal());
btnCancelar.addEventListener("click", () => dialogo.close());

inputFoto.addEventListener("input", () => {
  // Só limpa mensagens enquanto a pessoa escolhe o arquivo; valida de verdade no submit.
  limparErro();

  if (urlPreview) {
    URL.revokeObjectURL(urlPreview);
    urlPreview = null;
  }

  const arquivo = inputFoto.files[0];
  if (!arquivo) {
    preview.hidden = true;
    preview.removeAttribute("src");
    return;
  }

  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    preview.hidden = true;
    preview.removeAttribute("src");
    mostrarErro("Use uma imagem PNG, JPG, WebP ou GIF.");
    return;
  }

  if (arquivo.size > TAMANHO_MAXIMO) {
    preview.hidden = true;
    preview.removeAttribute("src");
    mostrarErro("A imagem deve ter no máximo 32 MB.");
    return;
  }

  urlPreview = URL.createObjectURL(arquivo);
  preview.src = urlPreview;
  preview.hidden = false;
});

dialogo.addEventListener("close", () => {
  // Esc e outros fechamentos podem deixar um valor antigo preso no returnValue.
  const gerouComSucesso = dialogo.returnValue === "sucesso";
  dialogo.returnValue = "";

  if (urlPreview) {
    URL.revokeObjectURL(urlPreview);
    urlPreview = null;
  }
  preview.hidden = true;
  preview.removeAttribute("src");
  form.reset();
  limparErro();
  definirOcupado(false);

  // O evento close dispara depois do close(); não apaga a mensagem de sucesso.
  if (!gerouComSucesso) {
    definirStatus("");
  }
});

// Fase 5: validação, login e geração image-to-image com o Puter.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  limparErro();

  const arquivo = inputFoto.files[0];

  if (!arquivo) {
    inputFoto.setCustomValidity("Escolha uma foto antes de continuar.");
    inputFoto.reportValidity();
    mostrarErro("Escolha uma foto antes de continuar.");
    return;
  }

  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    inputFoto.setCustomValidity("Use uma imagem PNG, JPG, WebP ou GIF.");
    inputFoto.reportValidity();
    mostrarErro("Use uma imagem PNG, JPG, WebP ou GIF.");
    return;
  }

  if (arquivo.size > TAMANHO_MAXIMO) {
    inputFoto.setCustomValidity("A imagem deve ter no máximo 32 MB.");
    inputFoto.reportValidity();
    mostrarErro("A imagem deve ter no máximo 32 MB.");
    return;
  }

  if (!window.puter) {
    mostrarErro("O Puter não carregou. Verifique sua conexão e recarregue a página.");
    return;
  }

  // Desabilita antes de qualquer await para evitar um segundo clique durante o popup.
  definirOcupado(true);

  try {
    // signIn() precisa ser chamado no gesto do usuário, antes de qualquer await.
    if (!puter.auth.isSignedIn()) {
      await puter.auth.signIn();
    }

    const imagem = await puter.ai.txt2img({
      prompt: PROMPT_GTA,
      input_image: arquivo,
      input_image_mime_type: arquivo.type,
      model: "gemini-3.1-flash-image",
      test_mode: false, // trocar para false quando quiser gerar de verdade (gasta créditos)
    });

    escolherPersonagem("Você", imagem.src, COR_VOCE);
    limparSelecao();
    btnVoce.classList.add("ativo");
    dialogo.close("sucesso");
    definirStatus("Sua lenda de Dev City está pronta!");
  } catch (falha) {
    const mensagem = falha && falha.error === "popup_blocked"
      ? mensagemAutenticacao(falha)
      : mensagemGeracao(falha);
    mostrarErro(mensagem);
  } finally {
    definirOcupado(false);
  }
});
