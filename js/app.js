// Entry real do bundle. A lógica didática (e a função escolherPersonagem) mora em scripts.js.
// Com webpack, `require` existe; no Live Server, scripts.js já deixou a função no window.
const selecionarPersonagem =
  typeof require === "function" ? require("./scripts.js") : window.escolherPersonagem;

const PERSONAGENS = {
  lucia: { nome: "Lucia", imagem: "img/lucia.webp", cor: "#ff3cac", fundo: "img/background.webp" },
  jason: { nome: "Jason", imagem: "img/jason.webp", cor: "#4cc9f0", fundo: "img/background1.webp" },
  cj: { nome: "CJ", imagem: "img/cj.webp", cor: "#77dd77", fundo: "img/background2.webp" },
};

const FUNDO_VOCE = "img/Gta6carredbg.webp";
const COR_VOCE = "#ffd319";
const TAMANHO_MAXIMO = 32 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// URL publicada pelo Worker Cloudflare (ver worker/wrangler.toml).
const WORKER_URL = "https://devcity-gerador-lenda.devcity-cirleno.workers.dev";
// O modelo pede entradas MENORES que 512x512; 511 evita erro no limite exato.
const LADO_MAXIMO_FOTO = 511;

const botoesPersonagem = document.querySelectorAll("[data-personagem]");
const btnVoce = document.querySelector("#btn-voce");
const btnDownload = document.querySelector("#btn-download");
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
let urlImagemGerada = null;

// O fundo continua sendo regra do CSS; aqui só atualizamos a variável dele.
// A URL vira absoluta porque o url() da variável resolve relativo ao CSS.
function trocarFundo(caminho) {
  const url = new URL(caminho, document.baseURI).href;
  document.body.style.setProperty("--fundo", `url("${url}")`);
}

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

function mensagemErro(status) {
  const mensagens = {
    400: "A foto enviada não é válida. Tente outra imagem.",
    405: "Não foi possível chamar o serviço de imagem. Recarregue a página.",
    422: "Essa foto foi barrada pelo filtro de conteúdo. Tente outra imagem.",
    413: "A imagem é grande demais. Use uma foto menor.",
    429: "Muitas lendas criadas agora. Espere um instante e tente outra vez.",
    500: "O serviço de imagem falhou. Tente outra vez.",
    502: "O serviço de imagem falhou. Tente outra vez.",
    503: "O serviço está ocupado. Tente outra vez em instantes.",
  };
  return mensagens[status] || "Não foi possível criar sua lenda. Tente outra vez.";
}

// O modelo FLUX.2 klein exige entradas menores que 512x512. Reduzimos no
// navegador antes do envio para economizar cota e evitar erro no Worker.
function redimensionarFoto(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();

    imagem.onload = () => {
      URL.revokeObjectURL(url);

      const escala = Math.min(
        1,
        LADO_MAXIMO_FOTO / Math.max(imagem.naturalWidth, imagem.naturalHeight),
      );
      const largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
      const altura = Math.max(1, Math.round(imagem.naturalHeight * escala));
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;

      const contexto = canvas.getContext("2d");
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, largura, altura);
      contexto.drawImage(imagem, 0, 0, largura, altura);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Não foi possível preparar a imagem."));
        }
      }, "image/jpeg", 0.9);
    };

    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler essa imagem."));
    };

    imagem.src = url;
  });
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
    selecionarPersonagem(dados.nome, dados.imagem, dados.cor);
    trocarFundo(dados.fundo);
    limparSelecao();
    btnDownload.hidden = true;
    botao.classList.add("ativo");
    botao.setAttribute("aria-pressed", "true");
  });
});

// Fase 4: o diálogo nativo cuida de foco, Esc e devolução de foco ao botão "Você".
btnVoce.addEventListener("click", () => {
  trocarFundo(FUNDO_VOCE);
  dialogo.showModal();
});
btnCancelar.addEventListener("click", () => dialogo.close());

// Só aparece depois de uma geração bem-sucedida. O blob é local, então o
// download não consome cota nem faz outra chamada ao Worker.
btnDownload.addEventListener("click", () => {
  if (!urlImagemGerada) {
    return;
  }

  const link = document.createElement("a");
  link.href = urlImagemGerada;
  link.download = "lenda-devcity.jpg";
  document.body.appendChild(link);
  link.click();
  link.remove();
});

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

// Fase 5: validação, redimensionamento e geração com Cloudflare Workers AI.
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

  if (WORKER_URL.includes("SEU_SUBDOMINIO")) {
    mostrarErro("Configure a URL do Worker em js/app.js antes de gerar sua lenda.");
    return;
  }

  // Desabilita antes de qualquer await para evitar um segundo clique.
  definirOcupado(true);

  try {
    const foto = await redimensionarFoto(arquivo);
    const dados = new FormData();
    dados.append("foto", foto, "selfie.jpg");

    const resposta = await fetch(WORKER_URL, {
      method: "POST",
      body: dados,
    });

    if (!resposta.ok) {
      let detalhe = "";

      try {
        const corpo = await resposta.json();
        detalhe = corpo && corpo.erro ? corpo.erro : "";
      } catch (falha) {
        // O corpo não é JSON: usa a mensagem padrão pelo status HTTP.
      }

      throw new Error(detalhe || mensagemErro(resposta.status));
    }

    const imagem = await resposta.blob();

    if (!imagem.type.startsWith("image/")) {
      throw new Error("O serviço não devolveu uma imagem. Tente outra vez.");
    }

    if (urlImagemGerada) {
      URL.revokeObjectURL(urlImagemGerada);
    }
    urlImagemGerada = URL.createObjectURL(imagem);

    selecionarPersonagem("Você", urlImagemGerada, COR_VOCE);
    trocarFundo(FUNDO_VOCE);
    limparSelecao();
    btnDownload.hidden = false;
    btnVoce.classList.add("ativo");
    dialogo.close("sucesso");
    definirStatus("Sua lenda de Dev City está pronta!");
  } catch (falha) {
    mostrarErro(falha && falha.message ? falha.message : mensagemErro(0));
  } finally {
    definirOcupado(false);
  }
});
