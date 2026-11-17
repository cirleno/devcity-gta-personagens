// Worker gratuito: recebe a selfie e devolve a lenda gerada pelo Workers AI.
// Prompt e tamanhos ficam aqui para o navegador não precisar enviar textos livres.

const MODELO = "@cf/black-forest-labs/flux-2-klein-4b";

const PROMPT_GTA =
  "Transforme a pessoa desta selfie em um personagem jogável de GTA 6 em Dev City: " +
  "visual cinematográfico de pôster de jogo, cores neon rosa e amarelo, " +
  "iluminação de cidade à noite, rosto reconhecível, atitude de lenda, " +
  "tom satírico e divertido, alta qualidade.";

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

    // O modelo exige imagens de entrada menores que 512x512. O front-end já
    // redimensiona; esta checagem protege o Worker contra chamadas diretas.
    const corpo = new FormData();
    corpo.append("prompt", PROMPT_GTA);
    corpo.append("input_image_0", foto, "selfie.jpg");
    corpo.append("width", LARGURA_SAIDA);
    corpo.append("height", ALTURA_SAIDA);

    // FormData não expõe o boundary: passar por Response gera o Content-Type correto.
    const respostaFormulario = new Response(corpo);

    try {
      const resultado = await env.AI.run(MODELO, {
        multipart: {
          body: respostaFormulario.body,
          contentType: respostaFormulario.headers.get("content-type"),
        },
      });

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

      if (/flagged|moderation|safety/i.test(detalhe)) {
        return erroJson("Essa foto foi barrada pelo filtro de conteúdo. Tente outra imagem.", 422);
      }

      return erroJson("O serviço de imagem falhou. Tente outra vez em instantes.", 502);
    }
  },
};
