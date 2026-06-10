// netlify/functions/gerar-codigo-slides.js

export const handler = async (event) => {
    // Trata requisições de pre-flight (CORS) que o Codespaces faz
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
                body: JSON.stringify({ erro: "A chave GEMINI_API_KEY não foi detectada no ambiente." }) 
            };
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

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

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userPrompt }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { temperature: 0.1 }
            })
        });

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("A IA não gerou nenhuma resposta válida.");
        }

        let codigoGerado = data.candidates[0].content.parts[0].text;

        // Limpeza profunda de qualquer caractere markdown que a IA teime em colocar
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