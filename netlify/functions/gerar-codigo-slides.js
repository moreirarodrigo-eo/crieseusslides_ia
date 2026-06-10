// netlify/functions/gerar-codigo-slides.js
const https = require('https');

exports.handler = async (event, context) => {
    // Trata requisições de pre-flight (CORS)
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            },
            body: ""
        };
    }

    if (event.httpMethod !== "POST") {
        return { 
            statusCode: 405, 
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ erro: "Método Não Permitido" }) 
        };
    }

    try {
        const { tema, curso, publico, duracao, estilo } = JSON.parse(event.body);
        const API_KEY = process.env.GEMINI_API_KEY; 

        if (!API_KEY) {
            return { 
                statusCode: 500, 
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ erro: "A chave GEMINI_API_KEY não foi configurada no painel do Netlify." }) 
            };
        }

        const systemInstruction = `
            Você é um programador especialista na biblioteca PptxGenJS.
            Sua única tarefa é gerar código JavaScript puro, limpo e perfeitamente executável para configurar slides.
            
            REGRAS CRÍTICAS:
            1. Retorne APENAS o código JavaScript.
            2. NUNCA use blocos de código markdown como \`\`\`javascript ou \`\`\`. 
            3. Não inclua nenhuma introdução, comentários textuais ou saudações.
            4. Use a variável global pré-existente 'pptx'. Não declare "let pptx".
            5. Termine estritamente com: pptx.writeFile({ fileName: "Apresentacao_Academica.pptx" });
        `;

        const userPrompt = `
            Gere uma estrutura de slides acadêmicos sobre:
            Tema: ${tema}
            Curso: ${curso}
            Público: ${publico}
            Duração: ${duracao} minutos
            Estilo visual: ${estilo}
        `;

        const payload = JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.1 }
        });

        // Requisição HTTPS nativa do Node.js (Sem depender de pacotes externos ou fetch global)
        const respostaIA = await new Promise((resolve, reject) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
            const req = https.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, data }));
            });

            req.on('error', (e) => reject(e));
            req.write(payload);
            req.end();
        });

        if (respostaIA.statusCode !== 200) {
            throw new Error(`Erro na API do Gemini (Status ${respostaIA.statusCode}): ${respostaIA.data}`);
        }

        const dataJson = JSON.parse(respostaIA.data);
        
        if (!dataJson.candidates || dataJson.candidates.length === 0) {
            throw new Error("A IA não gerou nenhuma resposta válida.");
        }

        let codigoGerado = dataJson.candidates[0].content.parts[0].text;

        // Limpeza rigorosa de qualquer caractere markdown residual
        codigoGerado = codigoGerado.replace(/```javascript/gi, "")
                                   .replace(/```html/gi, "")
                                   .replace(/```/gi, "")
                                   .trim();

        return {
            statusCode: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
            },
            body: JSON.stringify({ codigo: codigoGerado })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ erro: error.message })
        };
    }
};
