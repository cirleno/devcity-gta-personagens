// Worker gratuito: recebe a selfie e devolve a lenda gerada pelo Workers AI.
// Prompt e tamanhos ficam aqui para o navegador não precisar enviar textos livres.

const MODELO = "@cf/black-forest-labs/flux-2-klein-4b";

// Um prompt fixo faz o modelo repetir sempre a mesma composição de fundo.
// Sortear o cenário e a semente dá variedade sem perder a identidade da selfie.
const CENARIOS = [
  "na orla de Vice City ao pôr do sol, palmeiras recortadas contra um céu laranja e magenta, areia úmida refletindo luz dourada e um skyline distante",
  "no centro de Leonida ao anoitecer, letreiros neon brilhantes em ciano e vermelho, calçada molhada refletindo as luzes, céu com luz azul e trânsito colorido desfocado ao fundo",
  "no campus de tecnologia de Dev City, fachadas de vidro, luzes verdes e magenta, drones passando ao longe e clima de comédia corporativa satírica",
  "em um bairro colorido de Little Haiti em plena luz do dia, casas em tons pastel, grafites vibrantes, palmeiras e um carro customizado estacionado na rua",
  "em um show ao ar livre com palco muito iluminado, lasers coloridos, confete e multidão animada desfocada atrás, energia vibrante de festival",
  "na rodovia de Leonida ao entardecer, asfalto extenso, poeira dourada, palmeiras baixas e um carro esportivo vermelho passando ao fundo",
];

const BASE_PROMPT =
  "Retrato cinematográfico de pôster de videogame: a pessoa desta selfie como " +
  "um personagem jogável de GTA 6 ";

const ESTILO_PROMPT =
  ". Rosto e traços faciais reconhecíveis, expressão confiante de lenda, " +
  "atitude satírica e divertida. Fotografia realista de alta qualidade, lente 35mm, " +
  "profundidade de campo rasa, luz de contorno dramática, sujeito muito bem iluminado, " +
  "cores saturadas e alegres, evite imagem escura ou monótona, " +
  "estética dos trailers oficiais de GTA 6. Sem texto, sem letras, sem logotipos, sem marca d'água.";

function montarPrompt() {
  const cenario = CENARIOS[Math.floor(Math.random() * CENARIOS.length)];
  return `${BASE_PROMPT}${cenario}${ESTILO_PROMPT}`;
}

const LARGURA_SAIDA = "768";
const ALTURA_SAIDA = "1024";
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

const TIPOS_ACEITOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const CABECALHOS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function erroJson(mensagem, status) {
  return new Response(JSON.stringify({ erro: mensagem }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CABECALHOS_CORS,
    },
  });
}

function ehModeracao(falha) {
  const detalhe = String(falha && falha.message ? falha.message : falha);
  return /flagged|moderation|safety/i.test(detalhe);
}

async function gerarImagem(env, foto) {
  // Cada chamada usa um cenário e uma semente novos para variar o fundo.
  const corpo = new FormData();
  corpo.append("prompt", montarPrompt());
  corpo.append("input_image_0", foto, "selfie.jpg");
  corpo.append("width", LARGURA_SAIDA);
  corpo.append("height", ALTURA_SAIDA);
  corpo.append("seed", String(Math.floor(Math.random() * 2147483647)));

  // FormData não expõe o boundary: passar por Response gera o Content-Type correto.
  const respostaFormulario = new Response(corpo);

  return env.AI.run(MODELO, {
    multipart: {
      body: respostaFormulario.body,
      contentType: respostaFormulario.headers.get("content-type"),
    },
  });
}

function base64ParaBytes(base64) {
  const limpo = String(base64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const binario = atob(limpo);
  const bytes = new Uint8Array(binario.length);

  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }

  return bytes;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CABECALHOS_CORS });
    }

    if (request.method !== "POST") {
      return erroJson("Use o método POST para gerar sua lenda.", 405);
    }

    const tamanho = Number(request.headers.get("content-length") || 0);
    if (tamanho > TAMANHO_MAXIMO) {
      return erroJson("A imagem é grande demais. Use uma foto menor.", 413);
    }

    let dados;
    try {
      dados = await request.formData();
    } catch (falha) {
      return erroJson("Não foi possível ler a imagem enviada.", 400);
    }

    const foto = dados.get("foto");

    if (!foto || typeof foto === "string" || typeof foto.arrayBuffer !== "function") {
      return erroJson("Escolha uma foto antes de continuar.", 400);
    }

    if (!TIPOS_ACEITOS.has(foto.type)) {
      return erroJson("Use uma imagem PNG, JPG, WebP ou GIF.", 400);
    }

    if (foto.size > TAMANHO_MAXIMO) {
      return erroJson("A imagem é grande demais. Use uma foto menor.", 413);
    }

    try {
      let resultado;

      try {
        resultado = await gerarImagem(env, foto);
      } catch (falha) {
        // O filtro do modelo às vezes barra uma foto que passa na tentativa
        // seguinte com outro cenário/semente; evita o erro 422 intermitente.
        if (!ehModeracao(falha)) {
          throw falha;
        }
        console.warn("Filtro de conteúdo barrou a primeira tentativa; repetindo.", falha);
        resultado = await gerarImagem(env, foto);
      }

      if (!resultado || !resultado.image) {
        throw new Error("O modelo não devolveu uma imagem.");
      }

      return new Response(base64ParaBytes(resultado.image), {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          ...CABECALHOS_CORS,
        },
      });
    } catch (falha) {
      console.error("Falha ao gerar lenda:", falha);
      const detalhe = String(falha && falha.message ? falha.message : falha);

      if (/rate limit|too many requests|429/i.test(detalhe)) {
        return erroJson("Muitas lendas criadas agora. Espere um instante e tente outra vez.", 429);
      }

      if (ehModeracao(falha)) {
        return erroJson("Essa foto foi barrada pelo filtro de conteúdo. Tente outra imagem.", 422);
      }

      return erroJson("O serviço de imagem falhou. Tente outra vez em instantes.", 502);
    }
  },
};
