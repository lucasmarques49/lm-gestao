# Checklist de Limpeza — L&M Residências

App conectado ao Supabase (banco de dados) para uso pela equipe.

## O que você já deve ter feito no Supabase
1. Rodado o `supabase-schema.sql` no SQL Editor
2. Criado o bucket `checklist-midia` no Storage (marcado como público)
3. Copiado a **Project URL** e a **anon public key** em Project Settings → API

## Passo a passo — publicar no Vercel

### 1. Criar conta no GitHub (se ainda não tiver)
- Vá em github.com → Sign up

### 2. Subir este projeto para o GitHub
- No github.com, clique em **New repository**
- Nome: `lm-checklist` (ou o que preferir) → **Create repository**
- Na página do repositório vazio, clique em **uploading an existing file**
- Arraste TODOS os arquivos e pastas deste projeto para a área de upload
  (inclusive a pasta `src` inteira — o GitHub aceita arrastar a pasta)
- Role para baixo, clique em **Commit changes**

### 3. Criar conta no Vercel
- Vá em vercel.com → Sign Up → escolha **Continue with GitHub** (mais fácil, conecta direto)

### 4. Importar o projeto
- No painel do Vercel, clique em **Add New** → **Project**
- Encontre o repositório `lm-checklist` na lista → **Import**
- O Vercel detecta sozinho que é um projeto Vite — não precisa mexer em nada nessa tela

### 5. Configurar as variáveis de ambiente (passo mais importante)
- Ainda na tela de importação, procure **Environment Variables**
- Adicione uma por uma (nome à esquerda, valor à direita):
  - `VITE_SUPABASE_URL` → cole a Project URL do Supabase
  - `VITE_SUPABASE_ANON_KEY` → cole a anon public key do Supabase
  - `VITE_ADMIN_PIN` → escolha o PIN que a equipe vai usar pra entrar na área administrativa (ex: `1508`)
- Clique em **Add** depois de cada uma

### 6. Deploy
- Clique em **Deploy**
- Espere cerca de 1 minuto
- Aparece "Congratulations" com um link tipo `lm-checklist.vercel.app` — esse é o link final, sem senha do Claude, sem precisar instalar nada

### 7. Testar
- Abra o link no celular
- Cadastre um imóvel e uma funcionária pela área administrativa (PIN que você definiu)
- Rode um checklist de teste

## Atualizando o app no futuro
Sempre que quiser mudar algo:
1. Peça o ajuste aqui na conversa com o Claude
2. Baixe os arquivos atualizados
3. No GitHub, vá no repositório → **Add file** → **Upload files** → suba os arquivos alterados → Commit
4. O Vercel publica a nova versão sozinho em ~1 minuto (deploy automático a cada commit)
